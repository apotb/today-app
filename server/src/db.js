import sqlite3 from 'sqlite3'
import { randomUUID } from 'node:crypto'

const db = new sqlite3.Database('./server/today.db')

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err)
        return
      }
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(row)
    })
  })

const now = Date.now()
const inHours = (hours) => new Date(now + hours * 60 * 60 * 1000).toISOString()

const seedEvents = [
  {
    id: randomUUID(),
    title: 'Sunrise Harbor Run',
    description: 'Community-paced 5K run by the waterfront.',
    startsAt: inHours(2),
    endsAt: inHours(4),
    cost: 0,
    imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80',
    category: 'sports',
    location: 'Harbor Park',
  },
  {
    id: randomUUID(),
    title: 'Downtown Jazz Night',
    description: 'Live local jazz artists and open seating.',
    startsAt: inHours(6),
    endsAt: inHours(9),
    cost: 15,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=80',
    category: 'arts',
    location: 'Blue Room Club',
  },
  {
    id: randomUUID(),
    title: 'Neighborhood Clean-Up',
    description: 'Volunteer team meetup to clean city trails.',
    startsAt: inHours(8),
    endsAt: inHours(10),
    cost: 0,
    imageUrl: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?w=900&q=80',
    category: 'volunteering',
    location: 'Riverside Trail',
  },
  {
    id: randomUUID(),
    title: 'City Museum Night Tour',
    description: 'After-hours guided tour through rotating exhibits.',
    startsAt: inHours(12),
    endsAt: inHours(14),
    cost: 22,
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=900&q=80',
    category: 'culture',
    location: 'City Museum',
  },
  {
    id: randomUUID(),
    title: 'Street Food Social',
    description: 'Pop-up food stalls and local performers.',
    startsAt: inHours(20),
    endsAt: inHours(23),
    cost: 8,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80',
    category: 'culture',
    location: 'Market Square',
  },
  {
    id: randomUUID(),
    title: 'Weekend Soccer Clinic',
    description: 'Skill drills and mini-games for all levels.',
    startsAt: inHours(30),
    endsAt: inHours(33),
    cost: 10,
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900&q=80',
    category: 'sports',
    location: 'Central Field',
  },
]

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
      location TEXT NOT NULL
    )
  `)

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
      action TEXT NOT NULL CHECK(action IN ('like', 'dislike', 'attended')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, event_id, action),
      FOREIGN KEY(event_id) REFERENCES events(id)
    )
  `)

  const row = await get('SELECT COUNT(*) as count FROM events')
  if (row?.count === 0) {
    for (const event of seedEvents) {
      await run(
        `INSERT INTO events (
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
          event.location,
        ],
      )
    }
  }
}

export { db, run, all, get }
