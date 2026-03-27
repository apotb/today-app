import { randomUUID } from 'node:crypto'
import { fetchEventbriteEvents } from './eventbriteProvider.js'
import { fetchGooglePlacesEvents } from './googlePlacesEvents.js'
import { aggregateAndDedupeEvents } from './eventAggregation.js'
import { resolveSearchLocation } from './geocode.js'
import { stripDateTimeFromTitle } from './titleClean.js'

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
  const promoter = event?.promoter?._embedded?.promoters?.[0] ?? event?.promoter
  const organizerKey = promoter?.id ?? promoter?.name ?? null
  const lat = venue?.location?.latitude != null ? Number(venue.location.latitude) : null
  const lng = venue?.location?.longitude != null ? Number(venue.location.longitude) : null

  return {
    id: `tm_${event.id ?? randomUUID()}`,
    title: stripDateTimeFromTitle(cleanTitle(event.name ?? 'Local Event')),
    description: cleanDescription(event.info ?? event.pleaseNote ?? ''),
    startsAt: new Date(start).toISOString(),
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

  const now = new Date()
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    apikey: key,
    size: '50',
    sort: 'date,asc',
    startDateTime: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endDateTime: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })

  const hasCoords =
    location.latitude != null &&
    location.longitude != null &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))

  if (hasCoords) {
    params.set('latlong', `${location.latitude},${location.longitude}`)
    params.set('radius', `${radius}`)
    params.set('unit', unit === 'km' ? 'km' : 'miles')
  } else if (location.zip) {
    const zip = `${location.zip}`.trim()
    params.set('postalCode', zip)
    params.set('radius', `${radius}`)
    params.set('unit', unit === 'km' ? 'km' : 'miles')
    if (/^\d{5}(-\d{4})?$/.test(zip)) {
      params.set('countryCode', 'US')
    }
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

export const fetchExternalEvents = async (options = {}) => {
  const { radius = 25, unit = 'miles', preferredCategories = [] } = options
  let { location = {} } = options
  location = await resolveSearchLocation(location)

  const [ticketmaster, eventbrite, googlePlaces] = await Promise.all([
    fetchTicketmasterEvents(location, radius, unit),
    fetchEventbriteEvents({ location, radius, unit }),
    fetchGooglePlacesEvents({ location, radius, unit }),
  ])

  let merged = uniqEvents([...ticketmaster, ...eventbrite, ...googlePlaces])
  if (merged.length === 0) {
    return []
  }

  let aggregate = aggregateAndDedupeEvents(merged)

  if (preferredCategories.length > 0) {
    const set = new Set(preferredCategories)
    const filtered = aggregate.filter((e) => set.has(e.category))
    if (filtered.length > 0) {
      aggregate = filtered
    }
  }

  return aggregate
}
