import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { all, get, initDb, run } from './db.js'

const app = express()
const port = 4000

app.use(cors())
app.use(express.json())

const categories = ['sports', 'arts', 'volunteering', 'culture']

const preferenceSchema = z.object({
  sessionId: z.string().min(1),
  categories: z.array(z.enum(categories)).min(1),
})

const interactionSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  action: z.enum(['like', 'dislike', 'attended']),
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

    const scored = events
      .map((event) => {
        const prefScore = prefMap.get(event.category) ? 4 : 0
        const behaviorScore = scoreByCategory.get(event.category) ?? 0
        const startsSoonScore = Math.max(
          0,
          10 -
            Math.floor(
              (new Date(event.starts_at).getTime() - Date.now()) / (60 * 60 * 1000),
            ),
        )
        return { ...event, score: prefScore + behaviorScore + startsSoonScore }
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
    app.listen(port, () => {
      console.log(`Today API running at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize database', error)
    process.exit(1)
  })
