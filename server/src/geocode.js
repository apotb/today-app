const zipCache = new Map()

/**
 * Enriches location with latitude/longitude when only ZIP is known (improves TM/EB radius + Google Places).
 */
export async function resolveSearchLocation(location = {}) {
  const out = { ...location }
  if (out.latitude != null && out.longitude != null) return out
  const zip = out.zip?.trim()
  if (!zip) return out

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return out

  if (zipCache.has(zip)) {
    const coords = zipCache.get(zip)
    return { ...out, ...coords }
  }

  try {
    const params = new URLSearchParams({ address: zip, key })
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    )
    if (!response.ok) return out
    const body = await response.json()
    const loc = body?.results?.[0]?.geometry?.location
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      const coords = { latitude: loc.lat, longitude: loc.lng }
      zipCache.set(zip, coords)
      return { ...out, ...coords }
    }
  } catch {
    /* ignore */
  }
  return out
}
