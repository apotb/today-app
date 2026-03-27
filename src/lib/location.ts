export type StoredLocation = {
  mode: 'geolocation' | 'zip'
  zip?: string
  latitude?: number
  longitude?: number
}

import { api } from '../api/client'

const LOCATION_KEY = 'today.location'

export const getStoredLocation = (): StoredLocation | null => {
  const raw = localStorage.getItem(LOCATION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredLocation
  } catch {
    return null
  }
}

export const saveStoredLocation = (location: StoredLocation) => {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(location))
}

/** Fills latitude/longitude from ZIP via API when missing (improves discover ordering and sync). */
export async function ensureStoredLocationHasCoordinates(
  loc: StoredLocation | null,
): Promise<StoredLocation | null> {
  if (!loc) return null
  if (loc.latitude != null && loc.longitude != null) return loc
  const z = loc.zip?.trim()
  if (!z) return loc
  try {
    const { latitude, longitude } = await api.geocodeZip(z)
    const next: StoredLocation = { ...loc, latitude, longitude }
    saveStoredLocation(next)
    return next
  } catch {
    return loc
  }
}

export const requestBrowserLocation = () =>
  new Promise<StoredLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          mode: 'geolocation',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => reject(new Error('Could not access your location.')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
