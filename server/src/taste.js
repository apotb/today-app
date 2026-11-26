import { run } from './db.js'

const TASTE_PREFIXES = ['genre:', 'subgenre:', 'time:', 'price:']

const named = (value) => {
  const text = `${value ?? ''}`.trim()
  if (!text || text.toLowerCase() === 'undefined') return ''
  return text
}

/** Stable tag slug: "Hip-Hop/Rap" → "hip-hop-rap". */
export const slugSignal = (value) =>
  named(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Local hour buckets: 5–11 morning, 12–16 afternoon, 17–20 evening, 21–4 night. */
export const timeBucket = (localTime) => {
  if (localTime == null || `${localTime}`.trim() === '') return null
  const hour = Number(String(localTime).split(':')[0])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (hour >= 5 && hour <= 11) return 'morning'
  if (hour >= 12 && hour <= 16) return 'afternoon'
  if (hour >= 17 && hour <= 20) return 'evening'
  return 'night'
}

/** null when the source didn't list a price. 0 is free, then low / mid / high. */
export const priceBucket = (cost) => {
  if (cost == null || cost === '') return null
  const amount = Number(cost)
  if (!Number.isFinite(amount)) return null
  if (amount <= 0) return 'free'
  if (amount < 25) return 'low'
  if (amount < 75) return 'mid'
  return 'high'
}

/**
 * Genre, subgenre, local time of day, and price bucket.
 * Category default tags are not included; those are the same for every event in a category.
 */
export const buildTasteTags = ({ genre, subgenre, localTime, cost } = {}) => {
  const tags = []
  const genreSlug = slugSignal(genre)
  const subgenreSlug = slugSignal(subgenre)
  if (genreSlug) tags.push(`genre:${genreSlug}`)
  if (subgenreSlug && subgenreSlug !== genreSlug) tags.push(`subgenre:${subgenreSlug}`)
  const time = timeBucket(localTime)
  if (time) tags.push(`time:${time}`)
  const price = priceBucket(cost)
  if (price) tags.push(`price:${price}`)
  return tags
}

export const parseTags = (raw) => {
  if (Array.isArray(raw)) return raw.filter((tag) => typeof tag === 'string')
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === 'string') : []
  } catch {
    return []
  }
}

export const tasteSignals = (tags) =>
  parseTags(tags).filter((tag) => TASTE_PREFIXES.some((prefix) => tag.startsWith(prefix)))

export const swipeTasteDelta = (action) => {
  if (action === 'like') return 1
  if (action === 'dislike') return -1
  return 0
}

export const attendanceTasteDelta = (status) => {
  if (status === 'attended') return 2
  if (status === 'missed') return -1
  return 0
}

/** Add `delta` to each taste signal. A later undo passes the opposite delta. */
export const adjustTasteScores = async (sessionId, tags, delta) => {
  if (!delta) return
  for (const tag of tasteSignals(tags)) {
    await run(
      `INSERT INTO user_tag_scores (session_id, tag, score) VALUES (?, ?, ?)
       ON CONFLICT(session_id, tag) DO UPDATE SET score = score + excluded.score`,
      [sessionId, tag, delta],
    )
  }
}
