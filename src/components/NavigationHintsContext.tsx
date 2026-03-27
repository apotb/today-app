/* eslint-disable react-refresh/only-export-components -- paired context + hook module */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { FIRST_LIKE_EVENTS_TAB_KEY } from '../lib/onboardingStorage'

type Ctx = {
  pulseEventsTab: boolean
  firstLikeMessage: string | null
  notifyFirstLike: () => void
  dismissFirstLikeMessage: () => void
}

const NavigationHintsContext = createContext<Ctx | null>(null)

export function NavigationHintsProvider({ children }: { children: ReactNode }) {
  const [pulseEventsTab, setPulseEventsTab] = useState(false)
  const [firstLikeMessage, setFirstLikeMessage] = useState<string | null>(null)

  const notifyFirstLike = useCallback(() => {
    if (localStorage.getItem(FIRST_LIKE_EVENTS_TAB_KEY)) return
    localStorage.setItem(FIRST_LIKE_EVENTS_TAB_KEY, '1')
    setPulseEventsTab(true)
    setFirstLikeMessage('See your events in one place')
    window.setTimeout(() => setPulseEventsTab(false), 5000)
    window.setTimeout(() => setFirstLikeMessage(null), 6000)
  }, [])

  const dismissFirstLikeMessage = useCallback(() => {
    setFirstLikeMessage(null)
  }, [])

  const value = useMemo(
    () => ({
      pulseEventsTab,
      firstLikeMessage,
      notifyFirstLike,
      dismissFirstLikeMessage,
    }),
    [pulseEventsTab, firstLikeMessage, notifyFirstLike, dismissFirstLikeMessage],
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
