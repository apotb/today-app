import { randomUUID } from 'node:crypto'
import { fetchEventbriteEvents } from './eventbriteProvider.js'
import { fetchGooglePlacesEvents } from './googlePlacesEvents.js'
import { aggregateAndDedupeEvents } from './eventAggregation.js'
import { stripDateTimeFromTitle } from './titleClean.js'

const FEED_RANGE_MS = 48 * 60 * 60 * 1000

const ticketmasterStartIso = (event) => {
  const d = event?.dates?.start
  if (!d) return null
  if (d.dateTime) {
    const parsed = new Date(d.dateTime)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  if (d.localDate) {
    const lt = d.localTime ? String(d.localTime) : ''
    let timePart = '12:00:00'
    if (lt.length >= 8) timePart = lt.slice(0, 8)
    else if (lt.length === 5) timePart = `${lt}:00`
    const combined = `${d.localDate}T${timePart}`
    const parsed = new Date(combined)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    const fallback = new Date(`${d.localDate}T12:00:00.000Z`)
    if (!Number.isNaN(fallback.getTime())) return fallback.toISOString()
  }
  return null
}

const mapCategory = (raw = '') => {
  const value = raw.toLowerCase()
  if (value.includes('music')) return 'music-nightlife'
  if (value.includes('sport')) return 'sports-fitness'
  if (value.includes('art') || value.includes('museum') || value.includes('theatre')) return 'arts-culture'
  if (value.includes('food')) return 'food-drink'
  if (value.includes('comedy')) return 'comedy-improv'
  if (value.includes('festival') || value.includes('fair')) return 'festivals-fairs'
  if (value.includes('family')) return 'family-friendly'
  if (value.includes('film') || value.includes('media')) return 'film-media'
  if (value.includes('tech')) return 'tech-ai'
  return 'social-meetups'
}

const cleanTitle = (value = '') =>
  String(value)
    .replace(/\s+/g, ' ')
    .replace(/[|•]+/g, ' ')
    .replace(/[_~`^*]+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const cleanDescription = (value = '') => {
  const trimmed = String(value).replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'Event details will be available soon.'
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`
}

const normalizeTicketmasterEvent = (event) => {
  const start = ticketmasterStartIso(event)
  if (!start) return null
  const venue = event?._embedded?.venues?.[0]
  const classification = event?.classifications?.[0]
  const categoryRaw = classification?.segment?.name ?? classification?.genre?.name ?? ''
  const image = event?.images?.find((img) => img.ratio === '16_9')?.url ?? event?.images?.[0]?.url
  const venueAddress = [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode]
    .filter(Boolean)
    .join(', ')
  const promoter = event?.promoter?._embedded?.promoters?.[0] ?? event?.promoter
  const organizerKey = promoter?.id ?? promoter?.name ?? null
  const lat = venue?.location?.latitude != null ? Number(venue.location.latitude) : null
  const lng = venue?.location?.longitude != null ? Number(venue.location.longitude) : null

  return {
    id: `tm_${event.id ?? randomUUID()}`,
    title: stripDateTimeFromTitle(cleanTitle(event.name ?? 'Local Event')),
    description: cleanDescription(event.info ?? event.pleaseNote ?? ''),
    startsAt: start,
    endsAt: new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    cost: event?.priceRanges?.[0]?.min ?? 0,
    imageUrl: image ?? null,
    category: mapCategory(categoryRaw),
    location: venue?.name ?? 'Local Venue',
    address: venueAddress || venue?.name || 'Local Venue',
    sourceUrl: event?.url ?? null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    provider: 'ticketmaster',
    organizerKey: organizerKey ? String(organizerKey) : null,
    tags: [],
  }
}

const normalizeText = (value = '') => value.toLowerCase().replace(/\s+/g, ' ').trim()

const uniqEvents = (events) => {
  const seenIds = new Set()
  const seenUrls = new Set()
  const out = []
  for (const event of events) {
    if (!event?.id) continue
    const eventUrl = normalizeText(event?.sourceUrl ?? '')
    if (seenIds.has(event.id)) continue
    if (eventUrl && seenUrls.has(eventUrl)) continue
    seenIds.add(event.id)
    if (eventUrl) seenUrls.add(eventUrl)
    out.push(event)
  }
  return out
}

const fetchTicketmasterEvents = async (location = {}, radius = 25, unit = 'miles') => {
  const key = process.env.TICKETMASTER_API_KEY
  if (!key) {
    return []
  }

  const hasCoords =
    location.latitude != null &&
    location.longitude != null &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
  if (!hasCoords) return []

  const now = new Date()
  const end = new Date(Date.now() + FEED_RANGE_MS)
  const params = new URLSearchParams({
    apikey: key,
    size: '200',
    sort: 'date,asc',
    startDateTime: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endDateTime: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })

  params.set('latlong', `${location.latitude},${location.longitude}`)
  params.set('radius', `${radius}`)
  params.set('unit', unit === 'km' ? 'km' : 'miles')

  try {
    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`,
    )
    if (!response.ok) {
      return []
    }
    const body = await response.json()
    const events = (body?._embedded?.events ?? [])
      .map(normalizeTicketmasterEvent)
      .filter(Boolean)
    return events
  } catch {
    return []
  }
}

export const fetchExternalEvents = async (options = {}) => {
  const { radius = 25, unit = 'miles' } = options
  const { location = {} } = options

  const hasCoords =
    location.latitude != null &&
    location.longitude != null &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
  if (!hasCoords) {
    return []
  }

  const [ticketmaster, eventbrite, googlePlaces] = await Promise.all([
    fetchTicketmasterEvents(location, radius, unit),
    fetchEventbriteEvents({ location, radius, unit }),
    fetchGooglePlacesEvents({ location, radius, unit }),
  ])

  let merged = uniqEvents([...ticketmaster, ...eventbrite, ...googlePlaces])
  if (merged.length === 0) {
    return []
  }

  return aggregateAndDedupeEvents(merged)
}
