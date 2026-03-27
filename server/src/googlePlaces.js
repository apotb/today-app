const placeCache = new Map()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const pickPhotoUrl = (photoRef, key) => {
  if (!photoRef || !key) return null
  const params = new URLSearchParams({
    maxwidth: '1200',
    photoreference: photoRef,
    key,
  })
  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`
}

async function textSearch(query, { location = {}, radius = 25, unit = 'miles' } = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return null

  const cacheKey = `${query}::${location.zip ?? ''}::${location.latitude ?? ''},${location.longitude ?? ''}`
  if (placeCache.has(cacheKey)) return placeCache.get(cacheKey)

  const params = new URLSearchParams({
    query,
    key,
  })

  if (location.latitude && location.longitude) {
    params.set('location', `${location.latitude},${location.longitude}`)
    const metersPerUnit = unit === 'km' ? 1000 : 1609.34
    params.set('radius', `${Math.round(radius * metersPerUnit)}`)
  }

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const body = await response.json()

    if (body?.status === 'OVER_QUERY_LIMIT') {
      return null
    }

    const result = body?.results?.[0] ?? null
    placeCache.set(cacheKey, result)
    return result
  } catch {
    return null
  }
}

export async function enrichWithPlaces(events, { location = {}, radius = 25, unit = 'miles' } = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return events

  const enriched = []
  for (const event of events) {
    // Keep enrichment lightweight: only try if we have a vague location or placeholder image.
    const shouldTry =
      !event?.location ||
      event.location === 'Local Venue' ||
      String(event.imageUrl ?? '').includes('images.unsplash.com/photo-1492684223066-81342ee5ff30')
    if (!shouldTry) {
      enriched.push(event)
      continue
    }

    const query = `${event.title} ${event.location ?? ''}`.trim()
    const place = await textSearch(query, { location, radius, unit })
    if (!place) {
      enriched.push(event)
      continue
    }

    const photoRef = place?.photos?.[0]?.photo_reference
    const photoUrl = pickPhotoUrl(photoRef, key)
    const formattedAddress = place?.formatted_address
    const name = place?.name
    const betterLocation =
      name && formattedAddress ? `${name} · ${formattedAddress}` : formattedAddress ?? event.location

    enriched.push({
      ...event,
      location: betterLocation ?? event.location,
      address: formattedAddress ?? event.address ?? event.location,
      imageUrl: photoUrl ?? event.imageUrl,
    })

    // Small delay to reduce accidental bursts when many events need enrichment.
    await sleep(80)
  }

  return enriched
}

