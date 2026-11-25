import './env.js'
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { all, get, initDb, run } from './db.js'
import { fetchExternalEvents } from './eventsProvider.js'

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors())
app.use(express.json())

const categories = [
  'sports-fitness',
  'arts-culture',
  'music-nightlife',
  'food-drink',
  'volunteering-community',
  'social-meetups',
  'dating-singles',
  'family-friendly',
  'outdoor-nature',
  'wellness-self-care',
  'learning-workshops',
  'networking-professional',
  'entrepreneurship-startups',
  'finance-business',
  'gaming-esports',
  'tech-ai',
  'film-media',
  'fashion-popups',
  'comedy-improv',
  'festivals-fairs',
  'holidays-seasonal',
  'markets',
  'religious-spiritual',
  'activism-politics',
  'travel-exploration',
]

const preferenceSchema = z.object({
  sessionId: z.string().min(1),
  categories: z.array(z.enum(categories)).min(1),
})

const interactionSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  action: z.enum(['like', 'dislike']),
})

const questionnaireSchema = z.object({
  sessionId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.boolean(),
        categories: z.array(z.enum(categories)).min(1),
        tags: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(10),
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

const syncSchema = z.object({
  sessionId: z.string().min(1).optional(),
  location: locationSchema.optional(),
  radius: z.number().positive().max(200).optional(),
  unit: z.enum(['miles', 'km']).optional(),
  force: z.boolean().optional(),
})

/** How long a synced area's events are reused before the providers are called again. */
const SYNC_FRESH_MS = 30 * 60 * 1000

/**
 * Identifies a synced area. Coordinates are rounded to 2 decimals (~1 km), so
 * nearby users and small GPS jitter share the same cached sync.
 */
const syncAreaKey = (latitude, longitude, radius, unit) =>
  `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}|${radius}${unit}`

/** Discover / sync / providers: now → 48h ahead */
const FEED_WINDOW_MS = 48 * 60 * 60 * 1000

const getWindow = () => {
  const from = new Date()
  const to = new Date(Date.now() + FEED_WINDOW_MS)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Liked events on calendar: load a bit past 3 local calendar days */
const getMyEventsFetchWindow = () => {
  const from = new Date()
  const to = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

const KM_PER_MILE = 1.609344

const toMiles = (radius, unit) => (unit === 'km' ? radius / KM_PER_MILE : radius)

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

const haversineMiles = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) return null
  const R = 3958.8
  const toRad = (d) => (Number(d) * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

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

app.post('/api/onboarding/responses', async (req, res, next) => {
  try {
    const parsed = questionnaireSchema.parse(req.body)
    await run('DELETE FROM user_questionnaire_answers WHERE session_id = ?', [
      parsed.sessionId,
    ])
    await run('DELETE FROM user_tag_scores WHERE session_id = ?', [parsed.sessionId])

    const tagAccum = new Map()
    for (const item of parsed.answers) {
      await run(
        `INSERT INTO user_questionnaire_answers
          (session_id, question_id, answer, categories_json, tags_json, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          parsed.sessionId,
          item.questionId,
          item.answer ? 1 : 0,
          JSON.stringify(item.categories),
          JSON.stringify(item.tags ?? []),
        ],
      )
      const tagList =
        item.tags && item.tags.length > 0 ? item.tags : item.categories
      const delta = item.answer ? 2 : -1
      for (const tag of tagList) {
        tagAccum.set(tag, (tagAccum.get(tag) ?? 0) + delta)
      }
    }
    for (const [tag, score] of tagAccum) {
      await run(`INSERT INTO user_tag_scores (session_id, tag, score) VALUES (?, ?, ?)`, [
        parsed.sessionId,
        tag,
        score,
      ])
    }
    res.status(201).json({ success: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/attendance', async (req, res, next) => {
  try {
    const parsed = attendanceSchema.parse(req.body)
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
    await run(
      `INSERT OR IGNORE INTO user_interactions (session_id, event_id, action)
       VALUES (?, ?, ?)`,
      [parsed.sessionId, parsed.eventId, parsed.action],
    )
    res.status(201).json({ success: true })
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
    res.json({
      success: true,
      cached: false,
      imported: fetchedEvents.length,
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

    const parseCoord = (v) => {
      if (v == null || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const userLat = parseCoord(req.query.latitude)
    const userLon = parseCoord(req.query.longitude)
    const hasUserLocation = userLat != null && userLon != null
    const requestedRadius = Number(req.query.radius)
    const radius =
      Number.isFinite(requestedRadius) && requestedRadius > 0 ? Math.min(requestedRadius, 200) : 25
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

    const questionRows = await all(
      `SELECT answer, categories_json
       FROM user_questionnaire_answers
       WHERE session_id = ?`,
      [sessionId],
    )
    const questionScoreMap = new Map()
    for (const row of questionRows) {
      let parsedCategories = []
      try {
        parsedCategories = JSON.parse(row.categories_json)
      } catch {
        parsedCategories = []
      }
      for (const category of parsedCategories) {
        const current = questionScoreMap.get(category) ?? 0
        questionScoreMap.set(category, current + (row.answer ? 2 : -1))
      }
    }

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
    const nearby = events.filter((event) => {
      if (!hasUserLocation) return true
      if (event.id.startsWith('seed-')) return true
      const d = haversineMiles(userLat, userLon, event.latitude, event.longitude)
      return d != null && d <= radiusMiles
    })

    const enriched = nearby.map((event) => {
      let eventTags = []
      try {
        eventTags = JSON.parse(event.tags || '[]')
      } catch {
        eventTags = []
      }
      let tagScreeningScore = 0
      for (const t of eventTags) {
        tagScreeningScore += userTagScores.get(t) ?? 0
      }

      const prefWeight = prefMap.get(event.category) ?? 0
      const categoryQuestionScore = questionScoreMap.get(event.category) ?? 0
      const behaviorScore = scoreByCategory.get(event.category) ?? 0

      const distanceMiles = haversineMiles(userLat, userLon, event.latitude, event.longitude)
      const hoursUntil =
        (new Date(event.starts_at).getTime() - Date.now()) / (60 * 60 * 1000)
      const dateRelevance = Math.max(0, 12 - Math.floor(hoursUntil))

      const preferenceScore =
        prefWeight * 150 +
        categoryQuestionScore * 50 +
        tagScreeningScore * 22 +
        behaviorScore * 18
      const score = preferenceScore + dateRelevance * 0.25

      return {
        ...event,
        preferenceScore,
        prefWeight,
        categoryQuestionScore,
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
      const da = a.distanceMiles ?? 1e9
      const db = b.distanceMiles ?? 1e9
      if (da !== db) return da - db
      const ta = new Date(a.starts_at).getTime()
      const tb = new Date(b.starts_at).getTime()
      if (ta !== tb) return ta - tb
      return a.tieBreak - b.tieBreak
    })

    res.json({
      events: enriched.map(({ tieBreak, ...rest }) => rest),
    })
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
    const events = await all(
      `SELECT DISTINCT e.*
       FROM user_interactions ui
       JOIN events e ON e.id = ui.event_id
       WHERE ui.session_id = ?
         AND ui.action IN ('like', 'attended')
         AND (e.id LIKE 'evt_%' OR e.id LIKE 'seed-%')
         AND e.starts_at BETWEEN ? AND ?
       ORDER BY e.starts_at ASC`,
      [sessionId, from, to],
    )
    const withAttendance = await Promise.all(
      events.map(async (event) => {
        const attendance = await get(
          `SELECT status FROM user_event_attendance
           WHERE session_id = ? AND event_id = ?`,
          [sessionId, event.id],
        )
        return { ...event, attendance_status: attendance?.status ?? null }
      }),
    )
    res.json({ events: withAttendance })
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
