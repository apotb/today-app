export type StoredLocation = {
  mode: 'geolocation'
  latitude: number
  longitude: number
}

const LOCATION_KEY = 'today.location'

export const getStoredLocation = (): StoredLocation | null => {
  const raw = localStorage.getItem(LOCATION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as {
      latitude?: unknown
      longitude?: unknown
    }
    const lat = Number(parsed.latitude)
    const lon = Number(parsed.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      localStorage.removeItem(LOCATION_KEY)
      return null
    }
    return {
      mode: 'geolocation',
      latitude: lat,
      longitude: lon,
    }
  } catch {
    return null
  }
}

export const saveStoredLocation = (location: StoredLocation) => {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(location))
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
