import { randomUUID } from 'node:crypto'
import { fetchEventbriteEvents } from './eventbriteProvider.js'
import { enrichWithPlaces } from './googlePlaces.js'

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
  const start = event?.dates?.start?.dateTime
  if (!start) return null
  const venue = event?._embedded?.venues?.[0]
  const classification = event?.classifications?.[0]
  const categoryRaw = classification?.segment?.name ?? classification?.genre?.name ?? ''
  const image = event?.images?.find((img) => img.ratio === '16_9')?.url ?? event?.images?.[0]?.url
  const venueAddress = [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode]
    .filter(Boolean)
    .join(', ')
  return {
    id: `tm_${event.id ?? randomUUID()}`,
    title: cleanTitle(event.name ?? 'Local Event'),
    description: cleanDescription(event.info ?? event.pleaseNote ?? ''),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    cost: event?.priceRanges?.[0]?.min ?? 0,
    imageUrl: image ?? null,
    category: mapCategory(categoryRaw),
    location: venue?.name ?? 'Local Venue',
    address: venueAddress || venue?.name || 'Local Venue',
    sourceUrl: event?.url ?? null,
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

const filterByPreferences = (events, preferredCategories) => {
  if (!preferredCategories || preferredCategories.length === 0) return events
  const set = new Set(preferredCategories)
  const filtered = events.filter((e) => set.has(e.category))
  return filtered.length > 0 ? filtered : events
}

const ensureUniqueImages = (events) => {
  const seen = new Set()
  return events.map((event) => {
    const currentImage = event?.imageUrl ? String(event.imageUrl) : ''
    if (currentImage && !seen.has(currentImage)) {
      seen.add(currentImage)
      return event
    }
    const fallback = `https://picsum.photos/seed/today-${encodeURIComponent(event.id)}/1200/675`
    seen.add(fallback)
    return { ...event, imageUrl: fallback }
  })
}

const fetchTicketmasterEvents = async (location = {}, radius = 25, unit = 'miles') => {
  const key = process.env.TICKETMASTER_API_KEY
  if (!key) {
    return []
  }

  const now = new Date()
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    apikey: key,
    size: '50',
    sort: 'date,asc',
    startDateTime: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endDateTime: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })

  if (location.zip) params.set('postalCode', location.zip)
  if (location.latitude && location.longitude) {
    params.set('latlong', `${location.latitude},${location.longitude}`)
    params.set('radius', `${radius}`)
    params.set('unit', unit === 'km' ? 'km' : 'miles')
  }

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

export const fetchExternalEvents = async ({
  location = {},
  radius = 25,
  unit = 'miles',
  preferredCategories = [],
} = {}) => {
  const [ticketmaster, eventbrite] = await Promise.all([
    fetchTicketmasterEvents(location, radius, unit),
    fetchEventbriteEvents({ location, radius, unit }),
  ])

  let merged = uniqEvents([...ticketmaster, ...eventbrite])
  merged = filterByPreferences(merged, preferredCategories)
  merged = ensureUniqueImages(merged)

  if (merged.length === 0) {
    return []
  }

  const enriched = await enrichWithPlaces(merged, { location, radius, unit })
  return ensureUniqueImages(enriched.length > 0 ? enriched : merged)
}
