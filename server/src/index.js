import './env.js'
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { all, get, initDb, run } from './db.js'
import { fetchExternalEvents } from './eventsProvider.js'
import { CATEGORY_TAGS } from './categoryTags.js'
import { haversineMiles, toMiles } from './geo.js'
import { buildEventIcs } from './calendarIcs.js'
import {
  adjustTasteScores,
  attendanceTasteDelta,
  parseTags,
  swipeTasteDelta,
  tasteSignals,
} from './taste.js'

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors())
app.use(express.json())

// The iOS release app fetches the API through URLSession. Without this, a GET
// discover response can be stored and replayed, which keeps showing the sample
// events after a real sync. The website and the debug app do not use that cache.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store')
  next()
})

// Single source of truth for category ids on the server (must match CATEGORY_OPTIONS in
// src/types/models.ts on the frontend).
const categories = Object.keys(CATEGORY_TAGS)

const preferenceSchema = z.object({
  sessionId: z.string().min(1),
  categories: z.array(z.enum(categories)).min(1),
})

const resetAccountSchema = z.object({
  sessionId: z.string().min(1),
})

const interactionSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  action: z.enum(['like', 'dislike']),
})

const attendanceSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  status: z.enum(['attended', 'missed']),
})

const optionalFiniteNumber = z.preprocess((val) => {
  if (val == null || val === '') return undefined
  const n = Number(val)
  return Number.isFinite(n) ? n : undefined
}, z.number().optional())

const locationSchema = z.object({
  latitude: optionalFiniteNumber,
  longitude: optionalFiniteNumber,
})

/** Larger requested radii are reduced to this instead of being rejected. */
const MAX_RADIUS = 200

const syncSchema = z.object({
  sessionId: z.string().min(1).optional(),
  location: locationSchema.optional(),
  radius: z
    .number()
    .nonnegative()
    .transform((r) => Math.min(r, MAX_RADIUS))
    .optional(),
  unit: z.enum(['miles', 'km']).optional(),
  force: z.boolean().optional(),
})

/** How long a synced area's events are reused before the providers are called again. */
const SYNC_FRESH_MS = 30 * 60 * 1000

/**
 * Identifies a synced area. Coordinates are rounded to 2 decimals (~1 km), so
 * nearby users and small GPS jitter share the same cached sync.
 */
/*
 * Limits on calls to Ticketmaster, which has a daily request quota. Without them,
 * anyone could call POST /api/events/sync with force: true in a loop (or vary their
 * location to make every call a new area) and use up the quota for everyone.
 * Both limits are in memory, so they reset when the server restarts.
 */
/** One provider fetch per area per minute, even when forced. */
const AREA_FETCH_COOLDOWN_MS = 60 * 1000
/** At most this many provider fetches per hour across all users and areas. */
const MAX_PROVIDER_FETCHES_PER_HOUR = 120
const HOUR_MS = 60 * 60 * 1000

/** area key -> time of the last provider fetch for that area */
const lastAreaFetchAt = new Map()
/** times of provider fetches in the last hour */
let recentProviderFetches = []
/**
 * area key -> provider sync already running. A second caller for the same area
 * waits for this instead of discovering before the import finishes (that race
 * returns the built-in sample events).
 */
const inFlightSyncs = new Map()

/**
 * Returns true and records the fetch if the providers may be called for this area
 * now; returns false if the area was fetched within the cooldown or the hourly
 * budget is used up.
 */
const takeProviderFetch = (areaKey, nowMs = Date.now()) => {
  const last = lastAreaFetchAt.get(areaKey)
  if (last != null && nowMs - last < AREA_FETCH_COOLDOWN_MS) return false

  recentProviderFetches = recentProviderFetches.filter((t) => nowMs - t < HOUR_MS)
  if (recentProviderFetches.length >= MAX_PROVIDER_FETCHES_PER_HOUR) return false

  recentProviderFetches.push(nowMs)
  lastAreaFetchAt.set(areaKey, nowMs)
  // Keep the map small: forget areas fetched longer ago than the cooldown.
  if (lastAreaFetchAt.size > 1000) {
    for (const [key, t] of lastAreaFetchAt) {
      if (nowMs - t >= AREA_FETCH_COOLDOWN_MS) lastAreaFetchAt.delete(key)
    }
  }
  return true
}

const syncAreaKey = (latitude, longitude, radius, unit) =>
  `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}|${radius}${unit}`

/** Discover / sync / providers: now → 48h ahead */
const FEED_WINDOW_MS = 48 * 60 * 60 * 1000

const getWindow = () => {
  const from = new Date()
  const to = new Date(Date.now() + FEED_WINDOW_MS)
  return { from: from.toISOString(), to: to.toISOString() }
}

/**
 * Saved events for the Events tab: anything that hasn't ended yet (so events already
 * in progress stay visible) and starts within the next 4 days.
 */
const getMyEventsFetchWindow = () => {
  const from = new Date()
  const to = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

/**
 * Removes external events that have already ended and that no user has swiped on
 * or marked attendance for. Events with interactions are kept so My Events never
 * loses saved events and swipe history keeps counting toward recommendations.
 */
const pruneEndedEvents = () =>
  run(
    `DELETE FROM events
     WHERE ends_at < ?
       AND id NOT LIKE 'seed-%'
       AND id NOT IN (SELECT event_id FROM user_interactions)
       AND id NOT IN (SELECT event_id FROM user_event_attendance)`,
    [new Date().toISOString()],
  )

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/debug/providers', (_req, res) => {
  res.json({
    ticketmasterConfigured: Boolean(process.env.TICKETMASTER_API_KEY),
  })
})

app.get('/api/preferences/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params
    const prefs = await all(
      `SELECT category, weight FROM user_preferences WHERE session_id = ? ORDER BY weight DESC`,
      [sessionId],
    )
    res.json({ preferences: prefs.map((p) => p.category) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/preferences', async (req, res, next) => {
  try {
    const parsed = preferenceSchema.parse(req.body)
    await run('DELETE FROM user_preferences WHERE session_id = ?', [parsed.sessionId])
    const n = parsed.categories.length
    for (let i = 0; i < n; i += 1) {
      const category = parsed.categories[i]
      const weight = n - i
      await run(
        `INSERT INTO user_preferences (session_id, category, weight, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [parsed.sessionId, category, weight],
      )
    }
    res.status(201).json({ success: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/account/reset', async (req, res, next) => {
  try {
    const parsed = resetAccountSchema.parse(req.body)
    const { sessionId } = parsed
    await run('DELETE FROM user_preferences WHERE session_id = ?', [sessionId])
    await run('DELETE FROM user_interactions WHERE session_id = ?', [sessionId])
    await run('DELETE FROM user_event_attendance WHERE session_id = ?', [sessionId])
    await run('DELETE FROM user_tag_scores WHERE session_id = ?', [sessionId])
    await run('DELETE FROM user_questionnaire_answers WHERE session_id = ?', [sessionId])
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/attendance', async (req, res, next) => {
  try {
    const parsed = attendanceSchema.parse(req.body)
    const existing = await get(
      `SELECT status FROM user_event_attendance WHERE session_id = ? AND event_id = ?`,
      [parsed.sessionId, parsed.eventId],
    )
    if (existing?.status !== parsed.status) {
      const event = await get('SELECT tags FROM events WHERE id = ?', [parsed.eventId])
      const delta = attendanceTasteDelta(parsed.status) - attendanceTasteDelta(existing?.status)
      await adjustTasteScores(parsed.sessionId, parseTags(event?.tags), delta)
    }
    await run(
      `INSERT INTO user_event_attendance (session_id, event_id, status, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id, event_id) DO UPDATE SET
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
      [parsed.sessionId, parsed.eventId, parsed.status],
    )
    if (parsed.status === 'attended') {
      await run(
        `INSERT OR IGNORE INTO user_interactions (session_id, event_id, action)
         VALUES (?, ?, 'attended')`,
        [parsed.sessionId, parsed.eventId],
      )
    }
    res.status(201).json({ success: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/interactions', async (req, res, next) => {
  try {
    const parsed = interactionSchema.parse(req.body)
    const result = await run(
      `INSERT OR IGNORE INTO user_interactions (session_id, event_id, action)
       VALUES (?, ?, ?)`,
      [parsed.sessionId, parsed.eventId, parsed.action],
    )
    if (result.changes > 0) {
      const event = await get('SELECT tags FROM events WHERE id = ?', [parsed.eventId])
      await adjustTasteScores(
        parsed.sessionId,
        parseTags(event?.tags),
        swipeTasteDelta(parsed.action),
      )
    }
    res.status(201).json({ success: true })
  } catch (error) {
    next(error)
  }
})

/** Undo a swipe: removes that like/dislike so the event returns to the feed. */
app.post('/api/interactions/undo', async (req, res, next) => {
  try {
    const parsed = interactionSchema.parse(req.body)
    const result = await run(
      `DELETE FROM user_interactions WHERE session_id = ? AND event_id = ? AND action = ?`,
      [parsed.sessionId, parsed.eventId, parsed.action],
    )
    if (result.changes > 0) {
      const event = await get('SELECT tags FROM events WHERE id = ?', [parsed.eventId])
      await adjustTasteScores(
        parsed.sessionId,
        parseTags(event?.tags),
        -swipeTasteDelta(parsed.action),
      )
    }
    res.json({ success: true, removed: result.changes })
  } catch (error) {
    next(error)
  }
})

app.post('/api/events/sync', async (req, res, next) => {
  try {
    const parsed = syncSchema.parse(req.body ?? {})
    const location = locationSchema.parse(parsed.location ?? {})
    const radius = parsed.radius ?? 25
    const unit = parsed.unit ?? 'miles'

    if (
      location.latitude == null ||
      location.longitude == null ||
      !Number.isFinite(Number(location.latitude)) ||
      !Number.isFinite(Number(location.longitude))
    ) {
      res.status(400).json({ message: 'latitude and longitude are required' })
      return
    }

    const areaKey = syncAreaKey(location.latitude, location.longitude, radius, unit)
    if (!parsed.force) {
      const lastSync = await get('SELECT synced_at FROM sync_areas WHERE area_key = ?', [areaKey])
      const ageMs = lastSync ? Date.now() - new Date(lastSync.synced_at).getTime() : Infinity
      if (ageMs < SYNC_FRESH_MS) {
        res.json({ success: true, imported: 0, cached: true })
        return
      }
    }

    // A sync for this area may already be calling Ticketmaster. Wait for it so this
    // request does not discover the feed before those events are stored.
    let pending = inFlightSyncs.get(areaKey)
    if (!pending) {
      // Rate limit (applies to forced syncs too). The feed still loads from the events
      // already stored, so callers just get a cached response.
      if (!takeProviderFetch(areaKey)) {
        res.json({ success: true, imported: 0, cached: true, limited: true })
        return
      }
      pending = (async () => {
        const fetchedEvents = await fetchExternalEvents({
          location,
          radius,
          unit,
        })
        // Shared events table: never wipe other users' events here. Upsert this area's
        // events and only prune ones that have already ended and nobody saved.
        await pruneEndedEvents()
        for (const event of fetchedEvents) {
          await run(
            `INSERT INTO events (
              id, title, description, starts_at, ends_at, cost, image_url, category, location, address,
              latitude, longitude, tags, source_url, series_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              description = excluded.description,
              starts_at = excluded.starts_at,
              ends_at = excluded.ends_at,
              cost = excluded.cost,
              image_url = excluded.image_url,
              category = excluded.category,
              location = excluded.location,
              address = excluded.address,
              latitude = excluded.latitude,
              longitude = excluded.longitude,
              tags = excluded.tags,
              source_url = excluded.source_url,
              series_key = excluded.series_key`,
            [
              event.id,
              event.title,
              event.description,
              event.startsAt,
              event.endsAt,
              event.cost,
              event.imageUrl,
              event.category,
              event.location,
              event.address ?? event.location,
              event.latitude ?? null,
              event.longitude ?? null,
              JSON.stringify(event.tags ?? []),
              event.sourceUrl ?? null,
              event.seriesKey ?? null,
            ],
          )
        }
        // Providers swallow their own errors and return [], so an empty result might be a
        // failure. Only remember the sync when it actually returned events.
        if (fetchedEvents.length > 0) {
          await run(
            `INSERT INTO sync_areas (area_key, synced_at) VALUES (?, ?)
             ON CONFLICT(area_key) DO UPDATE SET synced_at = excluded.synced_at`,
            [areaKey, new Date().toISOString()],
          )
        }
        return fetchedEvents.length
      })()
      inFlightSyncs.set(areaKey, pending)
      pending.finally(() => {
        if (inFlightSyncs.get(areaKey) === pending) inFlightSyncs.delete(areaKey)
      })
    }

    const imported = await pending
    res.json({
      success: true,
      cached: false,
      imported,
      providers: {
        ticketmasterConfigured: Boolean(process.env.TICKETMASTER_API_KEY),
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/events/discover', async (req, res, next) => {
  try {
    const sessionId = `${req.query.sessionId ?? ''}`.trim()
    if (!sessionId) {
      res.status(400).json({ message: 'sessionId is required' })
      return
    }

    const parseNumber = (v) => {
      if (v == null || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const userLat = parseNumber(req.query.latitude)
    const userLon = parseNumber(req.query.longitude)
    const hasUserLocation = userLat != null && userLon != null
    const requestedRadius = parseNumber(req.query.radius)
    const radius =
      requestedRadius != null && requestedRadius >= 0 ? Math.min(requestedRadius, MAX_RADIUS) : 25
    const unit = req.query.unit === 'km' ? 'km' : 'miles'
    const radiusMiles = toMiles(radius, unit)

    const { from, to } = getWindow()
    const events = await all(
      `SELECT e.*
       FROM events e
       WHERE e.starts_at BETWEEN ? AND ?
         AND (e.id LIKE 'evt_%' OR e.id LIKE 'seed-%')
         AND NOT EXISTS (
           SELECT 1 FROM user_interactions ui
           WHERE ui.session_id = ?
             AND ui.event_id = e.id
             AND ui.action IN ('like', 'dislike')
         )`,
      [from, to, sessionId],
    )

    const prefs = await all(
      'SELECT category, weight FROM user_preferences WHERE session_id = ?',
      [sessionId],
    )
    const prefMap = new Map(prefs.map((p) => [p.category, p.weight]))

    const tagRows = await all('SELECT tag, score FROM user_tag_scores WHERE session_id = ?', [
      sessionId,
    ])
    const userTagScores = new Map(tagRows.map((r) => [r.tag, r.score]))

    const historical = await all(
      `SELECT e.category, ui.action, COUNT(*) as count
       FROM user_interactions ui
       JOIN events e ON e.id = ui.event_id
       WHERE ui.session_id = ?
       GROUP BY e.category, ui.action`,
      [sessionId],
    )

    const scoreByCategory = new Map()
    for (const row of historical) {
      const current = scoreByCategory.get(row.category) ?? 0
      if (row.action === 'like') scoreByCategory.set(row.category, current + row.count * 2)
      // 'attended' is also written to user_event_attendance, which is scored below.
      // Counting it here too would double its weight.
      if (row.action === 'dislike') scoreByCategory.set(row.category, current - row.count * 2)
    }

    const attendance = await all(
      `SELECT e.category, a.status, COUNT(*) as count
       FROM user_event_attendance a
       JOIN events e ON e.id = a.event_id
       WHERE a.session_id = ?
       GROUP BY e.category, a.status`,
      [sessionId],
    )
    for (const row of attendance) {
      const current = scoreByCategory.get(row.category) ?? 0
      if (row.status === 'attended') scoreByCategory.set(row.category, current + row.count * 3)
      if (row.status === 'missed') scoreByCategory.set(row.category, current - row.count)
    }

    // The events table holds every user's area, so only keep events near this user.
    // Events without coordinates can't be placed, so they're only shown when the
    // request has no location (or they're the built-in sample events).
    const isNearUser = (event) => {
      if (!hasUserLocation) return true
      const d = haversineMiles(userLat, userLon, event.latitude, event.longitude)
      return d != null && d <= radiusMiles
    }

    // Sample events are only a fallback: show them only when this area has no real
    // events at all in the window. Swiped events still count as real, so swiping
    // through every real event doesn't bring the samples back.
    const realEventsInWindow = await all(
      `SELECT latitude, longitude FROM events
       WHERE starts_at BETWEEN ? AND ? AND id LIKE 'evt_%'`,
      [from, to],
    )
    const areaHasRealEvents = realEventsInWindow.some(isNearUser)

    const nearby = events.filter((event) =>
      event.id.startsWith('seed-') ? !areaHasRealEvents : isNearUser(event),
    )

    const enriched = nearby.map((event) => {
      let tagScreeningScore = 0
      for (const tag of tasteSignals(event.tags)) {
        tagScreeningScore += userTagScores.get(tag) ?? 0
      }

      const prefWeight = prefMap.get(event.category) ?? 0
      const behaviorScore = scoreByCategory.get(event.category) ?? 0

      const distanceMiles = haversineMiles(userLat, userLon, event.latitude, event.longitude)
      const hoursUntil =
        (new Date(event.starts_at).getTime() - Date.now()) / (60 * 60 * 1000)
      const dateRelevance = Math.max(0, 12 - Math.floor(hoursUntil))

      const preferenceScore = prefWeight * 150 + tagScreeningScore * 22 + behaviorScore * 18
      const score = preferenceScore + dateRelevance * 0.25

      return {
        ...event,
        preferenceScore,
        prefWeight,
        tagScreeningScore,
        behaviorScore,
        distanceMiles,
        dateRelevance,
        score,
        tieBreak: Math.random(),
      }
    })

    enriched.sort((a, b) => {
      if (b.preferenceScore !== a.preferenceScore) {
        return b.preferenceScore - a.preferenceScore
      }
      const ta = new Date(a.starts_at).getTime()
      const tb = new Date(b.starts_at).getTime()
      if (ta !== tb) return ta - tb
      const da = a.distanceMiles ?? 1e9
      const db = b.distanceMiles ?? 1e9
      if (da !== db) return da - db
      return a.tieBreak - b.tieBreak
    })

    res.json({
      events: enriched.map(({ tieBreak, ...rest }) => rest),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/events/:eventId/calendar.ics', async (req, res, next) => {
  try {
    const event = await get('SELECT * FROM events WHERE id = ?', [req.params.eventId])
    if (!event) {
      res.status(404).json({ message: 'Event not found' })
      return
    }
    const ics = buildEventIcs(event)
    if (!ics) {
      res.status(400).json({ message: 'Event is missing a start time' })
      return
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="event.ics"')
    res.send(ics)
  } catch (error) {
    next(error)
  }
})

app.get('/api/events/:eventId', async (req, res, next) => {
  try {
    const event = await get('SELECT * FROM events WHERE id = ?', [req.params.eventId])
    if (!event) {
      res.status(404).json({ message: 'Event not found' })
      return
    }
    res.json({ event })
  } catch (error) {
    next(error)
  }
})

app.get('/api/my-events', async (req, res, next) => {
  try {
    const sessionId = `${req.query.sessionId ?? ''}`.trim()
    if (!sessionId) {
      res.status(400).json({ message: 'sessionId is required' })
      return
    }
    const { from, to } = getMyEventsFetchWindow()
    // One query: saved events plus this user's attendance status (previously one extra
    // query per event).
    const events = await all(
      `SELECT e.*, a.status AS attendance_status
       FROM events e
       LEFT JOIN user_event_attendance a
         ON a.event_id = e.id AND a.session_id = ?
       WHERE e.id IN (
           SELECT event_id FROM user_interactions
           WHERE session_id = ? AND action IN ('like', 'attended')
         )
         AND (e.id LIKE 'evt_%' OR e.id LIKE 'seed-%')
         AND e.ends_at > ?
         AND e.starts_at <= ?
       ORDER BY e.starts_at ASC`,
      [sessionId, sessionId, from, to],
    )
    res.json({ events })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: 'Validation error', issues: error.issues })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

initDb()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Today API listening on ${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize database', error)
    process.exit(1)
  })
