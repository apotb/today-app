import { stripDateTimeFromTitle } from './titleClean.js'

/** Preserve common leagues / acronyms when normalizing title casing */
const ACRONYMS = new Set([
  'mlb',
  'nhl',
  'nba',
  'nfl',
  'mls',
  'ncaa',
  'wwe',
  'nascar',
  'ufc',
  'pga',
  'wta',
  'atp',
  'dj',
  'vip',
  'usa',
  'uk',
  'eu',
  'llc',
  'inc',
])

/**
 * Cleaner, readable titles: spacing, no ALL-CAPS walls, league acronyms, dates stripped elsewhere.
 */
export function professionalizeTitle(raw = '') {
  let s = String(raw)
    .replace(/\s+/g, ' ')
    .replace(/[|•]+/g, ' ')
    .replace(/[_~`^*]+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()

  if (!s) return s

  const mostlyShout = s.length > 8 && s === s.toUpperCase() && /[A-Z]{2,}/.test(s)
  if (mostlyShout) {
    s = s.toLowerCase().replace(/\b([a-z])([a-z]*)\b/g, (_, a, rest) => a.toUpperCase() + rest)
  }

  s = stripDateTimeFromTitle(s)

  for (const a of ACRONYMS) {
    const re = new RegExp(`\\b${a}\\b`, 'gi')
    s = s.replace(re, a.toUpperCase())
  }

  s = s.replace(/\s+/g, ' ').trim()
  return s || String(raw).trim()
}

export function professionalizeDescription(raw = '', maxLen = 520) {
  let s = String(raw)
    .replace(/<[^>]{0,200}>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  if (!s) return 'Details for this event are available from the ticket or venue link.'

  s = s.charAt(0).toUpperCase() + s.slice(1)
  if (!/[.!?]$/.test(s)) s += '.'

  if (s.length > maxLen) {
    const cut = s.slice(0, maxLen - 1)
    const lastSpace = cut.lastIndexOf(' ')
    s = `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
  }

  return s
}

/** Ticketmaster: only treat as free when price ranges explicitly say 0; else unknown → null (not “free”). */
export function ticketmasterCostFromApi(event) {
  const ranges = event?.priceRanges
  if (!Array.isArray(ranges) || ranges.length === 0) return null

  let minPositive = null
  for (const r of ranges) {
    const mn = r?.min != null ? Number(r.min) : NaN
    const mx = r?.max != null ? Number(r.max) : NaN
    if (Number.isFinite(mn) && mn > 0) {
      minPositive = minPositive == null ? mn : Math.min(minPositive, mn)
    }
    if (minPositive == null && Number.isFinite(mx) && mx > 0) {
      minPositive = mx
    }
  }
  if (minPositive != null && minPositive > 0) return minPositive

  const allExplicitlyFree = ranges.every((r) => {
    const mn = Number(r?.min)
    const mx = Number(r?.max)
    return Number.isFinite(mn) && mn === 0 && Number.isFinite(mx) && mx === 0
  })
  if (allExplicitlyFree) return 0

  return null
}

/** Prefer sharp, wide 16∶9–ish images; drop tiny thumbnails. */
export function pickBestTicketmasterImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null

  const scored = images
    .map((img) => {
      const w = Number(img.width) || 0
      const h = Number(img.height) || 0
      const ratio = h > 0 ? w / h : 0
      const ratioBonus = Math.abs(ratio - 16 / 9) < 0.35 ? 800 : Math.abs(ratio - 4 / 3) < 0.35 ? 400 : 0
      const url = img.url || null
      return { url, w, h, score: w * 2 + ratioBonus + (img.fallback ? 0 : 50) }
    })
    .filter((x) => x.url && x.w >= 240)

  if (scored.length === 0) {
    const fallback = images.find((i) => i.url && (Number(i.width) || 0) >= 120)
    return fallback?.url ?? images[0]?.url ?? null
  }
  scored.sort((a, b) => b.score - a.score)
  return scored[0].url
}

export function eventbriteCostFromApi(event) {
  if (event?.is_free === true) return 0
  const minP = event?.ticket_availability?.minimum_ticket_price
  if (minP?.major_value != null) {
    const n = Number(minP.major_value)
    if (Number.isFinite(n) && n >= 0) return n > 0 ? n : null
  }
  if (minP?.value != null) {
    const n = Number(minP.value)
    if (Number.isFinite(n) && n > 0) return n >= 100 ? n / 100 : n
  }
  return null
}

export function pickBestGooglePhoto(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return null
  let best = photos[0]
  let bestW = Number(best.width) || 0
  for (const p of photos) {
    const w = Number(p.width) || 0
    if (w > bestW) {
      best = p
      bestW = w
    }
  }
  return best?.photo_reference ?? null
}
