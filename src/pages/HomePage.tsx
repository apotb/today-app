import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { SwipeCard } from '../components/SwipeCard'
import { SwipeTutorialOverlay } from '../components/SwipeTutorialOverlay'
import { useNavigationHints } from '../components/NavigationHintsContext'
import { FEED_REFRESH_EVENT } from '../lib/feedEvents'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'
import { getStoredLocation } from '../lib/location'
import { useIsDesktop } from '../lib/useIsDesktop'
import {
  getStoredDiscoverySettings,
  onDiscoverySettingsChanged,
} from '../lib/discoverySettings'
import { TUTORIAL_SWIPE_KEY } from '../lib/onboardingStorage'

export function HomePage() {
  const { notifyFirstLike } = useNavigationHints()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tutorialDismissed, setTutorialDismissed] = useState(
    () => localStorage.getItem(TUTORIAL_SWIPE_KEY) === '1',
  )
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    document.documentElement.classList.add('page-home')
    return () => document.documentElement.classList.remove('page-home')
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = getStoredDiscoverySettings()
      const loc = getStoredLocation()
      if (!loc) {
        throw new Error('Location needed. Open Settings and allow location.')
      }
      await api.syncEvents(getSessionId(), loc, settings.radius, settings.unit)
      const { events: list } = await api.discoverEvents(getSessionId(), loc)
      setEvents(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => onDiscoverySettingsChanged(() => void loadEvents()), [loadEvents])

  useEffect(() => {
    const onRefresh = () => void loadEvents()
    window.addEventListener(FEED_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(FEED_REFRESH_EVENT, onRefresh)
  }, [loadEvents])

  const current = events[0]

  const seriesDedupeKey = (e: EventItem) => {
    const sk = e.series_key?.trim()
    if (sk) return `s:${sk}`
    return `f:${e.title.trim().toLowerCase()}|${e.location.trim().toLowerCase()}`
  }

  const swipe = async (direction: 'left' | 'right') => {
    if (!current) return
    const action = direction === 'right' ? 'like' : 'dislike'
    await api.submitInteraction(getSessionId(), current.id, action)
    if (direction === 'right') notifyFirstLike()

    setEvents((prev) => {
      const tail = prev.slice(1)
      if (direction !== 'right') return tail
      const likedKey = seriesDedupeKey(current)
      return tail.filter((e) => seriesDedupeKey(e) !== likedKey)
    })
  }

  const showTutorial = !loading && !error && !tutorialDismissed

  const completeTutorial = () => {
    localStorage.setItem(TUTORIAL_SWIPE_KEY, '1')
    setTutorialDismissed(true)
  }

  if (loading) {
    return (
      <div className="page home-swipe-page">
        <h1>What&apos;s happening today?</h1>
        <p className="status home-loading-copy">Loading events...</p>
        <section className="swipe-card skeleton-card home-deck-card" aria-hidden="true">
          <div className="skeleton-image shimmer" />
          <div className="card-body">
            <div className="skeleton-line short shimmer" />
            <div className="skeleton-line shimmer" />
            <div className="skeleton-line shimmer" />
          </div>
        </section>
      </div>
    )
  }
  if (error) return <p className="error">{error}</p>

  return (
    <div className="page home-swipe-page">
      <h1>What&apos;s happening today?</h1>
      {showTutorial ? <SwipeTutorialOverlay onComplete={completeTutorial} /> : null}
      {!showTutorial && current ? (
        <p className="home-swipe-hint">
          Swipe up for details
          {isDesktop ? ' · Use ↑ ← →' : ''}
        </p>
      ) : null}
      {!showTutorial && current ? (
        <div className="home-deck">
          <SwipeCard
            key={current.id}
            event={current}
            onSwipe={swipe}
            onOpenDetails={() => setDetailEvent(current)}
            showDesktopNav={isDesktop}
            deckLayout
          />
        </div>
      ) : null}
      {!showTutorial && !current ? (
        <section className="panel home-empty-panel">
          <p>No events in your feed window. Try widening radius in Settings or refreshing.</p>
          <button type="button" className="btn btn-primary" onClick={() => void loadEvents()}>
            Refresh
          </button>
        </section>
      ) : null}
      {detailEvent ? (
        <EventDetailsModal event={detailEvent} onClose={() => setDetailEvent(null)} />
      ) : null}
    </div>
  )
}
