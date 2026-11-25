const EARTH_RADIUS_MILES = 3958.8

export const KM_PER_MILE = 1.609344
export const METERS_PER_MILE = 1609.344

const toRad = (deg) => (Number(deg) * Math.PI) / 180

/**
 * Great-circle distance in miles between two coordinates.
 * Returns null if any coordinate is missing or not a number.
 */
export const haversineMiles = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) return null
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Converts a radius in the given unit ('miles' or 'km') to miles. */
export const toMiles = (radius, unit) => (unit === 'km' ? radius / KM_PER_MILE : radius)
