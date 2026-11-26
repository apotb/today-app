export type DistanceUnit = 'miles' | 'km'

export type DiscoverySettings = {
  radius: number
  unit: DistanceUnit
}

const DISCOVERY_SETTINGS_KEY = 'today.discovery.settings'
const UPDATE_EVENT = 'today:discovery-settings-updated'

/** Upper end of the radius slider. 160 km is the 100-mile limit in round kilometers. */
export const MAX_RADIUS: Record<DistanceUnit, number> = { miles: 100, km: 160 }

/** Lower end of the radius slider. 2 km is the 1-mile floor in whole kilometers. */
export const MIN_RADIUS: Record<DistanceUnit, number> = { miles: 1, km: 2 }

export const KM_PER_MILE = 1.609344

/** Rounds to a whole number and keeps it within the slider's range for the unit. */
const clampRadius = (radius: number, unit: DistanceUnit) =>
  Math.min(Math.max(Math.round(radius), MIN_RADIUS[unit]), MAX_RADIUS[unit])

/** Converts a radius between units, keeping the result within the slider's range. */
export const convertRadius = (radius: number, from: DistanceUnit, to: DistanceUnit) => {
  if (from === to) return clampRadius(radius, to)
  return clampRadius(to === 'km' ? radius * KM_PER_MILE : radius / KM_PER_MILE, to)
}

const defaults: DiscoverySettings = {
  radius: 25,
  unit: 'miles',
}

export const getStoredDiscoverySettings = (): DiscoverySettings => {
  const raw = localStorage.getItem(DISCOVERY_SETTINGS_KEY)
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<DiscoverySettings>
    const unit: DistanceUnit = parsed.unit === 'km' ? 'km' : 'miles'
    // Clamp on read: values saved before the slider existed can be above the limit.
    const radius =
      typeof parsed.radius === 'number' && Number.isFinite(parsed.radius) && parsed.radius >= 0
        ? clampRadius(parsed.radius, unit)
        : defaults.radius
    return { radius, unit }
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

