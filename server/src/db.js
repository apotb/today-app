import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dbPath =
  process.env.TODAY_DB_PATH?.trim() || path.join(process.cwd(), 'server', 'today.db')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

/** Built-in SQLite (Node ≥22.13)—no native `sqlite3` addon, avoids GLIBC/prebuild issues on hosts like Render. */
const db = new DatabaseSync(dbPath)

const run = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql)
    const result = stmt.run(...params)
    return Promise.resolve({
      lastID: Number(result.lastInsertRowid ?? 0),
      changes: Number(result.changes ?? 0),
    })
  } catch (err) {
    return Promise.reject(err)
  }
}

const all = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql)
    return Promise.resolve(stmt.all(...params))
  } catch (err) {
    return Promise.reject(err)
  }
}

const get = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql)
    return Promise.resolve(stmt.get(...params))
  } catch (err) {
    return Promise.reject(err)
  }
}

const now = Date.now()
const inHours = (hours) => new Date(now + hours * 60 * 60 * 1000).toISOString()

const seedEvents = [
  {
    id: 'seed-sunrise-harbor-run',
    title: 'Sunrise Harbor Run',
    description: 'Join a community-paced 5K run along the waterfront.',
    startsAt: inHours(2),
    endsAt: inHours(4),
    cost: 0,
    imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80',
    category: 'sports-fitness',
    location: 'Harbor Park',
    address: '110 Harbor Park Dr, Waterfront District',
  },
  {
    id: 'seed-downtown-jazz-night',
    title: 'Downtown Jazz Night',
    description: 'Enjoy live local jazz artists with open seating.',
    startsAt: inHours(6),
    endsAt: inHours(9),
    cost: 15,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=80',
    category: 'music-nightlife',
    location: 'Blue Room Club',
    address: '22 Main St, Downtown',
  },
  {
    id: 'seed-neighborhood-cleanup',
    title: 'Neighborhood Trail Cleanup',
    description: 'Join a volunteer team to help clean nearby city trails.',
    startsAt: inHours(8),
    endsAt: inHours(10),
    cost: 0,
    imageUrl: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?w=900&q=80',
    category: 'volunteering-community',
    location: 'Riverside Trail',
    address: '501 Riverside Trailhead, Greenway',
  },
  {
    id: 'seed-city-museum-tour',
    title: 'City Museum Night Tour',
    description: 'Take an after-hours guided tour through rotating exhibits.',
    startsAt: inHours(12),
    endsAt: inHours(14),
    cost: 22,
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=900&q=80',
    category: 'arts-culture',
    location: 'City Museum',
    address: '15 Museum Ave, Arts Quarter',
  },
  {
    id: 'seed-street-food-social',
    title: 'Street Food Social',
    description: 'Explore pop-up food stalls and local live performers.',
    startsAt: inHours(20),
    endsAt: inHours(23),
    cost: 8,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80',
    category: 'food-drink',
    location: 'Market Square',
    address: '300 Market Square, Central District',
  },
  {
    id: 'seed-startup-pitch-practice',
    title: 'Startup Pitch Practice Session',
    description: 'Practice short pitches and get peer feedback in a friendly setting.',
    startsAt: inHours(16),
    endsAt: inHours(19),
    cost: 0,
    imageUrl: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=900&q=80',
    category: 'entrepreneurship-startups',
    location: 'Launch House',
    address: '87 Innovation Blvd, Tech Park',
  },
]

const ensureColumn = async (table, column, definition) => {
  const columns = await all(`PRAGMA table_info(${table})`)
  const hasColumn = columns.some((item) => item.name === column)
  if (!hasColumn) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export const initDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      cost REAL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      address TEXT
    )
  `)

  await ensureColumn('events', 'address', 'TEXT')
  await ensureColumn('events', 'latitude', 'REAL')
  await ensureColumn('events', 'longitude', 'REAL')
  await ensureColumn('events', 'tags', 'TEXT')
  await ensureColumn('events', 'source_url', 'TEXT')
  await ensureColumn('events', 'series_key', 'TEXT')

  await run(`
    CREATE TABLE IF NOT EXISTS user_tag_scores (
      session_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, tag)
    )
  `)

  await run(
    `DELETE FROM user_interactions
     WHERE event_id IN (
       SELECT id FROM events
       WHERE id LIKE 'local-%'
          OR id LIKE 'seed-%'
          OR title LIKE '%AI Mereting%'
     )`,
  )
  await run(
    `DELETE FROM user_event_attendance
     WHERE event_id IN (
       SELECT id FROM events
       WHERE id LIKE 'local-%'
          OR id LIKE 'seed-%'
          OR title LIKE '%AI Mereting%'
     )`,
  )
  await run(
    `DELETE FROM events
     WHERE id LIKE 'local-%'
        OR id LIKE 'seed-%'
        OR title LIKE '%AI Mereting%'`,
  )

  await run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      session_id TEXT NOT NULL,
      category TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, category)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS user_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, event_id, action),
      FOREIGN KEY(event_id) REFERENCES events(id)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS user_questionnaire_answers (
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer INTEGER NOT NULL,
      categories_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, question_id)
    )
  `)

  await ensureColumn('user_questionnaire_answers', 'tags_json', 'TEXT')

  await run(`
    CREATE TABLE IF NOT EXISTS user_event_attendance (
      session_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, event_id),
      FOREIGN KEY(event_id) REFERENCES events(id)
    )
  `)

  const row = await get('SELECT COUNT(*) as count FROM events')
  if (row?.count === 0) {
    for (const event of seedEvents) {
      await run(
        `INSERT INTO events (
          id, title, description, starts_at, ends_at, cost, image_url, category, location, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
      )
    }
  }
}

export { db, run, all, get }
