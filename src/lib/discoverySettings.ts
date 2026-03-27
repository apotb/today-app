export type DistanceUnit = 'miles' | 'km'

export type DiscoverySettings = {
  radius: number
  unit: DistanceUnit
}

const DISCOVERY_SETTINGS_KEY = 'today.discovery.settings'
const UPDATE_EVENT = 'today:discovery-settings-updated'

const defaults: DiscoverySettings = {
  radius: 25,
  unit: 'miles',
}

export const getStoredDiscoverySettings = (): DiscoverySettings => {
  const raw = localStorage.getItem(DISCOVERY_SETTINGS_KEY)
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<DiscoverySettings>
    return {
      radius:
        typeof parsed.radius === 'number' && Number.isFinite(parsed.radius) && parsed.radius > 0
          ? parsed.radius
          : defaults.radius,
      unit: parsed.unit === 'km' ? 'km' : 'miles',
    }
  } catch {
    return defaults
  }
}

export const saveDiscoverySettings = (settings: DiscoverySettings) => {
  localStorage.setItem(DISCOVERY_SETTINGS_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event(UPDATE_EVENT))
}

export const onDiscoverySettingsChanged = (handler: () => void) => {
  window.addEventListener(UPDATE_EVENT, handler)
  return () => window.removeEventListener(UPDATE_EVENT, handler)
}

