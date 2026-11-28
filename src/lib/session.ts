import {
  FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY,
  FIRST_LIKE_PENDING_OPEN_EVENTS_KEY,
} from './onboardingStorage'

const SESSION_KEY = 'today.session.id'

/** Earlier build stored this on first like. */
const LEGACY_FIRST_LIKE_HINT_KEY = 'today.hint.firstLikeEventsTab'
const VIBES_KEY = 'today.home.vibes'
const NOTIFIED_KEY = 'today.notified.events'

/** Session-scoped browser data. Leaves location, discovery radius, and the swipe tutorial in place. */
const LOCAL_ACCOUNT_KEYS = [
  SESSION_KEY,
  FIRST_LIKE_PENDING_OPEN_EVENTS_KEY,
  FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY,
  LEGACY_FIRST_LIKE_HINT_KEY,
  VIBES_KEY,
  NOTIFIED_KEY,
]

const createSessionId = () =>
  `today_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

let memoryFallback: string | null = null

export const getSessionId = () => {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing) {
      return existing
    }
    const created = createSessionId()
    localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    if (memoryFallback) return memoryFallback
    memoryFallback = createSessionId()
    return memoryFallback
  }
}

/** Drop this browser's session so the next load starts onboarding again. */
export const resetLocalAccount = () => {
  memoryFallback = null
  try {
    for (const key of LOCAL_ACCOUNT_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    /* storage unavailable */
  }
}

/** Drop every saved key for this browser, including location, radius, and tutorials. */
export const resetEverythingLocal = () => {
  memoryFallback = null
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith('today.')) keys.push(key)
    }
    for (const key of keys) {
      localStorage.removeItem(key)
    }
  } catch {
    /* storage unavailable */
  }
}
