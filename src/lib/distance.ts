import { KM_PER_MILE, type DistanceUnit } from './discoverySettings'
import { getStoredLocation, type StoredLocation } from './location'
import type { EventItem } from '../types/models'

const EARTH_RADIUS_MILES = 3958.8

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in miles. Null when a coordinate is missing. */
export const haversineMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return null
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Short distance label, such as "0.1 mi" or "12 km".
 * Under 10 keeps a tenth when it isn't a whole number. Farther distances are whole numbers.
 * Anything that would round to 0 is shown as 0.1.
 */
export const formatDistance = (miles: number, unit: DistanceUnit) => {
  const value = unit === 'km' ? miles * KM_PER_MILE : miles
  const suffix = unit === 'km' ? 'km' : 'mi'
  if (!Number.isFinite(value) || value < 0) return `0.1 ${suffix}`
  if (value < 9.95) {
    const tenths = Math.max(0.1, Math.round(value * 10) / 10)
    if (tenths >= 10) return `10 ${suffix}`
    const text = Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
    return `${text} ${suffix}`
  }
  return `${Math.round(value)} ${suffix}`
}

/** Miles from the saved location to the event, or the distance discover already computed. */
export const eventDistanceMiles = (
  event: EventItem,
  location: StoredLocation | null = getStoredLocation(),
) => {
  const lat = event.latitude
  const lon = event.longitude
  if (location && lat != null && lon != null) {
    const miles = haversineMiles(location.latitude, location.longitude, Number(lat), Number(lon))
    if (miles != null) return miles
  }
  return typeof event.distanceMiles === 'number' && Number.isFinite(event.distanceMiles)
    ? event.distanceMiles
    : null
}
