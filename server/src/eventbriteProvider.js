import { randomUUID } from 'node:crypto'
import { stripDateTimeFromTitle } from './titleClean.js'

const mapCategory = (raw = '') => {
  const value = raw.toLowerCase()
  if (value.includes('music') || value.includes('night')) return 'music-nightlife'
  if (value.includes('sport') || value.includes('fitness')) return 'sports-fitness'
  if (value.includes('art') || value.includes('museum') || value.includes('theatre')) return 'arts-culture'
  if (value.includes('food') || value.includes('drink')) return 'food-drink'
  if (value.includes('comedy') || value.includes('improv')) return 'comedy-improv'
  if (value.includes('festival') || value.includes('fair')) return 'festivals-fairs'
  if (value.includes('family') || value.includes('kids')) return 'family-friendly'
  if (value.includes('film') || value.includes('media')) return 'film-media'
  if (value.includes('tech') || value.includes('ai') || value.includes('software')) return 'tech-ai'
  if (value.includes('volunteer')) return 'volunteering-community'
  if (value.includes('outdoor') || value.includes('nature')) return 'outdoor-nature'
  if (value.includes('wellness') || value.includes('yoga')) return 'wellness-self-care'
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

const normalizeEventbrite = (event) => {
  const start = event?.start?.utc
  const end = event?.end?.utc
  if (!start || !end) return null

  const venue = event?.venue
  const venueName = venue?.name
  const venueAddress =
    venue?.address?.localized_address_display ?? venue?.address?.localized_multi_line_address_display

  const image = event?.logo?.original?.url ?? event?.logo?.url
  const categoryRaw =
    event?.category?.name ??
    event?.subcategory?.name ??
    event?.format?.name ??
    event?.name?.text ??
    ''

  const lat = venue?.latitude != null ? Number(venue.latitude) : null
  const lng = venue?.longitude != null ? Number(venue.longitude) : null

  return {
    id: `eb_${event.id ?? randomUUID()}`,
    title: stripDateTimeFromTitle(cleanTitle(event?.name?.text ?? 'Local Event')),
    description: cleanDescription(event?.description?.text ?? ''),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    cost: event?.is_free ? 0 : 0,
    imageUrl: image ?? null,
    category: mapCategory(categoryRaw),
    location: venueName && venueAddress ? `${venueName} · ${venueAddress}` : venueName ?? 'Local Venue',
    address: venueAddress ?? venueName ?? 'Local Venue',
    sourceUrl: event?.url ?? null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    provider: 'eventbrite',
    organizerKey: event?.organizer_id ? String(event.organizer_id) : venue?.id ? String(venue.id) : null,
    tags: [],
  }
}

export async function fetchEventbriteEvents({ location = {}, radius = 25, unit = 'miles' } = {}) {
  const token = process.env.EVENTBRITE_API_TOKEN
  if (!token) return []

  const now = new Date()
  const end = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    'start_date.range_start': now.toISOString(),
    'start_date.range_end': end.toISOString(),
    expand: 'venue,category,subcategory,format',
    sort_by: 'date',
  })

  const within = `${radius}${unit === 'km' ? 'km' : 'mi'}`
  if (location.latitude != null && location.longitude != null) {
    params.set('location.latitude', `${location.latitude}`)
    params.set('location.longitude', `${location.longitude}`)
    params.set('location.within', within)
  } else {
    return []
  }

  try {
    const response = await fetch(`https://www.eventbriteapi.com/v3/events/search/?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) return []
    const body = await response.json()
    const events = (body?.events ?? []).map(normalizeEventbrite).filter(Boolean)
    return events
  } catch {
    return []
  }
}

