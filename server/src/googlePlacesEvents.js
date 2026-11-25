import { randomUUID } from 'node:crypto'
import { stripDateTimeFromTitle } from './titleClean.js'

const mapCategoryFromTypes = (types = []) => {
  const t = types.join(' ').toLowerCase()
  if (t.includes('restaurant') || t.includes('food')) return 'food-drink'
  if (t.includes('night_club') || t.includes('bar')) return 'music-nightlife'
  if (t.includes('gym')) return 'sports-fitness'
  if (t.includes('movie') || t.includes('theater')) return 'film-media'
  if (t.includes('museum') || t.includes('art_gallery')) return 'arts-culture'
  if (t.includes('park')) return 'outdoor-nature'
  return 'social-meetups'
}

const cleanTitle = (value = '') =>
  String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

export async function fetchGooglePlacesEvents({ location = {}, radius = 25, unit = 'miles' } = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key || !location.latitude || !location.longitude) return []

  const radiusMeters = Math.min(
    Math.round((unit === 'km' ? radius * 1000 : radius * 1609.34)),
    50000,
  )
  const params = new URLSearchParams({
    key,
    location: `${location.latitude},${location.longitude}`,
    radius: `${radiusMeters}`,
    keyword: 'live events concert festival show today',
  })

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
    )
    if (!response.ok) return []
    const body = await response.json()
    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') return []

    const now = Date.now()
    return (body.results ?? []).slice(0, 25).map((place, i) => {
      const start = new Date(now + (2 + i) * 60 * 60 * 1000)
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
      const photoRef = place.photos?.[0]?.photo_reference
      const imageUrl = photoRef
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${key}`
        : null

      return {
        id: `gp_${place.place_id ?? randomUUID()}`,
        title: stripDateTimeFromTitle(cleanTitle(place.name ?? 'Local spot')),
        description: `Nearby venue: ${place.vicinity ?? place.formatted_address ?? 'your area'}.`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        cost: place.price_level != null ? Number(place.price_level) * 8 : null,
        imageUrl,
        category: mapCategoryFromTypes(place.types ?? []),
        location: place.name ?? 'Venue',
        address: place.vicinity ?? place.formatted_address ?? place.name ?? '',
        latitude: place.geometry?.location?.lat ?? null,
        longitude: place.geometry?.location?.lng ?? null,
        sourceUrl: place.place_id
          ? `https://www.google.com/maps/search/?api=1&query_place_id=${place.place_id}`
          : null,
        provider: 'google-places',
        tags: (place.types ?? []).slice(0, 6).map((x) => x.replace(/_/g, '-')),
        organizerKey: null,
      }
    })
  } catch {
    return []
  }
}
