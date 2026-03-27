import { randomUUID } from 'node:crypto'
import { localEventFeed } from './localEvents.js'
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

const normalizeTicketmasterEvent = (event) => {
  const start = event?.dates?.start?.dateTime
  if (!start) return null
  const venue = event?._embedded?.venues?.[0]
  const classification = event?.classifications?.[0]
  const categoryRaw = classification?.segment?.name ?? classification?.genre?.name ?? ''
  const image = event?.images?.find((img) => img.ratio === '16_9')?.url ?? event?.images?.[0]?.url
  return {
    id: `tm_${event.id ?? randomUUID()}`,
    title: event.name ?? 'Untitled Event',
    description: event.info ?? event.pleaseNote ?? 'No description available.',
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    cost: event?.priceRanges?.[0]?.min ?? 0,
    imageUrl: image ?? 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80',
    category: mapCategory(categoryRaw),
    location: venue?.name ?? 'Local Venue',
  }
}

const uniqById = (events) => {
  const seen = new Set()
  const out = []
  for (const event of events) {
    if (!event?.id) continue
    if (seen.has(event.id)) continue
    seen.add(event.id)
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

const fetchTicketmasterEvents = async (location = {}) => {
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
    params.set('radius', '25')
    params.set('unit', 'miles')
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
  preferredCategories = [],
} = {}) => {
  const [ticketmaster, eventbrite] = await Promise.all([
    fetchTicketmasterEvents(location),
    fetchEventbriteEvents({ location }),
  ])

  let merged = uniqById([...ticketmaster, ...eventbrite])
  merged = filterByPreferences(merged, preferredCategories)

  if (merged.length === 0) {
    return localEventFeed
  }

  const enriched = await enrichWithPlaces(merged, { location })
  return enriched.length > 0 ? enriched : merged
}
