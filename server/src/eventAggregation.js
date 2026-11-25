import { createHash } from 'node:crypto'
import { tagsForCategory } from './categoryTags.js'
import { stripDateTimeFromTitle } from './titleClean.js'

const DATE_TIME_PATTERNS = [
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/gi,
  /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/gi,
  /\b tonight\b/gi,
  /\b today\b/gi,
]

export const normalizeTitleForDedup = (raw = '') => {
  let s = String(raw).toLowerCase().trim()
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  for (const re of DATE_TIME_PATTERNS) s = s.replace(re, ' ')
  s = s.replace(/[^a-z0-9\s]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

const venueKeyFromString = (venue = '', address = '') => {
  const combined = `${venue} ${address}`.toLowerCase().trim()
  const cleaned = combined.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'unknown-venue'
  return createHash('sha256').update(cleaned).digest('hex').slice(0, 16)
}

export const seriesKey = (normTitle, venueKey, organizerKey) => {
  const org = organizerKey ?? 'na'
  return createHash('sha256')
    .update(`${normTitle}|${venueKey}|${org}`)
    .digest('hex')
    .slice(0, 20)
}

const timeBucket = (iso) => Math.floor(new Date(iso).getTime() / (30 * 60 * 1000))

const dedupeKey = (normTitle, venueKey, startIso) =>
  `${normTitle}|${venueKey}|${timeBucket(startIso)}`

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(v))) return Infinity
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const titleSimilar = (a, b) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return Math.abs(a.length - b.length) <= 8
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 2))
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 2))
  let overlap = 0
  for (const w of wordsA) if (wordsB.has(w)) overlap += 1
  const min = Math.min(wordsA.size, wordsB.size) || 1
  return overlap / min >= 0.66
}

const providerRank = (p) => {
  if (p === 'ticketmaster') return 3
  if (p === 'eventbrite') return 2
  if (p === 'google-places') return 1
  return 0
}

function mergePair(a, b) {
  const best = providerRank(a.provider) >= providerRank(b.provider) ? a : b
  const other = best === a ? b : a
  const tags = Array.from(new Set([...(best.tags ?? []), ...(other.tags ?? [])]))
  return {
    ...best,
    title: stripDateTimeFromTitle(
      best.title.length >= other.title.length ? best.title : other.title,
    ),
    description: (best.description?.length ?? 0) >= (other.description?.length ?? 0)
      ? best.description
      : other.description,
    imageUrl: best.imageUrl || other.imageUrl,
    cost: best.cost ?? other.cost,
    sourceUrl: best.sourceUrl || other.sourceUrl,
    latitude: best.latitude ?? other.latitude,
    longitude: best.longitude ?? other.longitude,
    organizerKey: best.organizerKey ?? other.organizerKey,
    provider: best.provider,
    tags,
  }
}

const categoryPlaceholderImage = (category, salt) =>
  `https://picsum.photos/seed/today-${encodeURIComponent(category)}-${salt.slice(0, 14)}/1200/675`

export function aggregateAndDedupeEvents(rawEvents) {
  const enriched = rawEvents.map((e, idx) => {
    const normTitle = normalizeTitleForDedup(e.title)
    const vKey = venueKeyFromString(e.location ?? '', e.address ?? '')
    const orgKey = e.organizerKey ? String(e.organizerKey) : null
    const sKey = seriesKey(normTitle, vKey, orgKey)
    const tags = Array.from(
      new Set([...(e.tags ?? []), ...tagsForCategory(e.category)]),
    )
    return {
      ...e,
      normTitle,
      venueKey: vKey,
      seriesKey: sKey,
      tags,
      _dedupe: dedupeKey(normTitle, vKey, e.startsAt),
      _idx: idx,
    }
  })

  const byDedupe = new Map()
  for (const e of enriched) {
    const existing = byDedupe.get(e._dedupe)
    if (!existing) byDedupe.set(e._dedupe, e)
    else byDedupe.set(e._dedupe, mergePair(existing, e))
  }
  let merged = [...byDedupe.values()]

  const consumed = new Set()
  const fuzzyMerged = []
  for (let i = 0; i < merged.length; i += 1) {
    if (consumed.has(i)) continue
    let acc = merged[i]
    for (let j = i + 1; j < merged.length; j += 1) {
      if (consumed.has(j)) continue
      const o = merged[j]
      const dt = Math.abs(new Date(acc.startsAt) - new Date(o.startsAt))
      const dist = haversineMeters(acc.latitude, acc.longitude, o.latitude, o.longitude)
      if (titleSimilar(acc.normTitle, o.normTitle) && dt < 2 * 60 * 60 * 1000 && dist < 800) {
        acc = mergePair(acc, o)
        consumed.add(j)
      }
    }
    fuzzyMerged.push(acc)
  }
  merged = fuzzyMerged

  const bySeries = new Map()
  for (const e of merged) {
    const list = bySeries.get(e.seriesKey) ?? []
    list.push(e)
    bySeries.set(e.seriesKey, list)
  }

  const urlOwnerSeries = new Map()
  const seriesChosenImage = new Map()

  for (const [sKey, list] of bySeries) {
    const sorted = [...list].sort((a, b) => providerRank(b.provider) - providerRank(a.provider))
    let chosen = null
    for (const ev of sorted) {
      const url = ev.imageUrl && String(ev.imageUrl).trim() ? String(ev.imageUrl).trim() : null
      if (!url) continue
      const owner = urlOwnerSeries.get(url)
      if (!owner) {
        chosen = url
        urlOwnerSeries.set(url, sKey)
        break
      }
      if (owner === sKey) {
        chosen = url
        break
      }
    }
    seriesChosenImage.set(sKey, chosen)
  }

  for (const [sKey, list] of bySeries) {
    if (seriesChosenImage.get(sKey)) continue
    const ev = list[0]
    const fallback = categoryPlaceholderImage(ev.category, sKey)
    seriesChosenImage.set(sKey, fallback)
    if (urlOwnerSeries.has(fallback)) {
      seriesChosenImage.set(sKey, categoryPlaceholderImage(ev.category, `${sKey}-ph`))
    }
    urlOwnerSeries.set(seriesChosenImage.get(sKey), sKey)
  }

  return merged.map((e) => {
    let imageUrl = seriesChosenImage.get(e.seriesKey)
    const owner = imageUrl ? urlOwnerSeries.get(imageUrl) : null
    if (owner && owner !== e.seriesKey) {
      imageUrl = categoryPlaceholderImage(e.category, `${e.seriesKey}-split`)
      urlOwnerSeries.set(imageUrl, e.seriesKey)
    }

    const canonicalId = `evt_${createHash('sha256')
      .update(`${e.normTitle}|${e.venueKey}|${e.startsAt}`)
      .digest('hex')
      .slice(0, 18)}`

    return {
      id: canonicalId,
      title: stripDateTimeFromTitle(e.title),
      description: e.description,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      cost: e.cost,
      imageUrl,
      category: e.category,
      location: e.location,
      address: e.address ?? e.location,
      latitude: e.latitude ?? null,
      longitude: e.longitude ?? null,
      sourceUrl: e.sourceUrl ?? null,
      provider: e.provider ?? 'merged',
      tags: e.tags,
      seriesKey: e.seriesKey,
    }
  })
}
