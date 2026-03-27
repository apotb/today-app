import { randomUUID } from 'node:crypto'
import { localEventFeed } from './localEvents.js'

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

export const fetchExternalEvents = async (location = {}) => {
  const key = process.env.TICKETMASTER_API_KEY
  if (!key) {
    return localEventFeed
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
      return localEventFeed
    }
    const body = await response.json()
    const events = (body?._embedded?.events ?? [])
      .map(normalizeTicketmasterEvent)
      .filter(Boolean)
    return events.length > 0 ? events : localEventFeed
  } catch {
    return localEventFeed
  }
}
