/* eslint-disable react-refresh/only-export-components -- paired context + hook module */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import {
  FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY,
  FIRST_LIKE_PENDING_OPEN_EVENTS_KEY,
} from '../lib/onboardingStorage'

/** Earlier build stored this on first like; treat as completed hint flow. */
const LEGACY_FIRST_LIKE_HINT_KEY = 'today.hint.firstLikeEventsTab'

type Ctx = {
  blockUntilEventsTab: boolean
  notifyFirstLike: () => void
}

const NavigationHintsContext = createContext<Ctx | null>(null)

function syncBlockingState(): boolean {
  try {
    if (localStorage.getItem(LEGACY_FIRST_LIKE_HINT_KEY) === '1') {
      localStorage.removeItem(LEGACY_FIRST_LIKE_HINT_KEY)
      localStorage.setItem(FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY, '1')
    }
    if (localStorage.getItem(FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY) === '1') return false
    return localStorage.getItem(FIRST_LIKE_PENDING_OPEN_EVENTS_KEY) === '1'
  } catch {
    return false
  }
}

export function NavigationHintsProvider({ children }: { children: ReactNode }) {
  const [blockUntilEventsTab, setBlockUntilEventsTab] = useState(syncBlockingState)
  const location = useLocation()

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const path = location.pathname
        const onMyEvents = path === '/my-events' || path.endsWith('/my-events')
        if (onMyEvents && localStorage.getItem(FIRST_LIKE_PENDING_OPEN_EVENTS_KEY) === '1') {
          localStorage.removeItem(FIRST_LIKE_PENDING_OPEN_EVENTS_KEY)
          localStorage.setItem(FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY, '1')
        }
      } catch {
        /* ignore */
      }
      setBlockUntilEventsTab(syncBlockingState())
    }, 0)
    return () => window.clearTimeout(id)
  }, [location.pathname])

  const notifyFirstLike = useCallback(() => {
    try {
      if (localStorage.getItem(FIRST_LIKE_EVENTS_TAB_COMPLETE_KEY) === '1') return
      if (localStorage.getItem(FIRST_LIKE_PENDING_OPEN_EVENTS_KEY) === '1') {
        setBlockUntilEventsTab(true)
        return
      }
      localStorage.setItem(FIRST_LIKE_PENDING_OPEN_EVENTS_KEY, '1')
      setBlockUntilEventsTab(true)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      blockUntilEventsTab,
      notifyFirstLike,
    }),
    [blockUntilEventsTab, notifyFirstLike],
  )

  return <NavigationHintsContext.Provider value={value}>{children}</NavigationHintsContext.Provider>
}

export function useNavigationHints(): Ctx {
  const ctx = useContext(NavigationHintsContext)
  if (!ctx) {
    throw new Error('useNavigationHints must be used within NavigationHintsProvider')
  }
  return ctx
}
