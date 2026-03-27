import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { all, get, initDb, run } from './db.js'
import { localEventFeed } from './localEvents.js'

const app = express()
const port = 4000

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
      }),
    )
    .min(1),
})

const attendanceSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  status: z.enum(['attended', 'missed']),
})

const getWindow = () => {
  const from = new Date()
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
    for (const category of parsed.categories) {
      await run(
        `INSERT INTO user_preferences (session_id, category, weight, updated_at)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
        [parsed.sessionId, category],
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
    for (const item of parsed.answers) {
      await run(
        `INSERT INTO user_questionnaire_answers
          (session_id, question_id, answer, categories_json, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          parsed.sessionId,
          item.questionId,
          item.answer ? 1 : 0,
          JSON.stringify(item.categories),
        ],
      )
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

app.post('/api/events/import-local', async (req, res, next) => {
  try {
    const location = `${req.body?.location ?? 'Local City'}`
    for (const event of localEventFeed) {
      await run(
        `INSERT OR REPLACE INTO events (
          id, title, description, starts_at, ends_at, cost, image_url, category, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.title,
          event.description,
          event.startsAt,
          event.endsAt,
          event.cost,
          event.imageUrl,
          event.category,
          location,
        ],
      )
    }
    res.json({ success: true, imported: localEventFeed.length })
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

    const { from, to } = getWindow()
    const events = await all(
      `SELECT e.*
       FROM events e
       WHERE e.starts_at BETWEEN ? AND ?
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
      if (row.action === 'attended') scoreByCategory.set(row.category, current + row.count * 3)
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

    const scored = events
      .map((event) => {
        const prefScore = prefMap.get(event.category) ? 4 : 0
        const questionScore = questionScoreMap.get(event.category) ?? 0
        const behaviorScore = scoreByCategory.get(event.category) ?? 0
        const startsSoonScore = Math.max(
          0,
          10 -
            Math.floor(
              (new Date(event.starts_at).getTime() - Date.now()) / (60 * 60 * 1000),
            ),
        )
        return {
          ...event,
          score: prefScore + questionScore + behaviorScore + startsSoonScore,
        }
      })
      .sort((a, b) => b.score - a.score)

    res.json({ events: scored })
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
    const events = await all(
      `SELECT DISTINCT e.*
       FROM user_interactions ui
       JOIN events e ON e.id = ui.event_id
       WHERE ui.session_id = ?
         AND ui.action IN ('like', 'attended')
       ORDER BY e.starts_at ASC`,
      [sessionId],
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
    app.listen(port, () => {
      console.log(`Today API running at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize database', error)
    process.exit(1)
  })
