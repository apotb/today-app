import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { VibeChips } from '../components/VibeChips'
import { filterByVibes, getStoredVibes, saveStoredVibes, type VibeId } from '../lib/vibes'

export function HomePage() {
  const { notifyFirstLike, setSwipeTutorialActive } = useNavigationHints()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [swipeError, setSwipeError] = useState('')
  const [tutorialDismissed, setTutorialDismissed] = useState(
    () => localStorage.getItem(TUTORIAL_SWIPE_KEY) === '1',
  )
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null)
  const [vibes, setVibes] = useState<VibeId[]>(getStoredVibes)
  // "Tonight" is judged against the time the feed was loaded.
  const [loadedAtMs, setLoadedAtMs] = useState(() => Date.now())
  // The most recent swipe and the cards it took off the deck, so it can be undone.
  const [lastSwipe, setLastSwipe] = useState<{
    action: 'like' | 'dislike'
    removed: EventItem[]
  } | null>(null)
  const [undoing, setUndoing] = useState(false)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    document.documentElement.classList.add('page-home')
    return () => document.documentElement.classList.remove('page-home')
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    setSwipeError('')
    setLastSwipe(null)
    try {
      const settings = getStoredDiscoverySettings()
      const loc = getStoredLocation()
      if (!loc) {
        throw new Error('Location needed. Open Settings and allow location.')
      }
      await api.syncEvents(getSessionId(), loc, settings.radius, settings.unit)
      const { events: list } = await api.discoverEvents(
        getSessionId(),
        loc,
        settings.radius,
        settings.unit,
      )
      setEvents(list)
      setLoadedAtMs(Date.now())
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

  const visibleEvents = useMemo(
    () => filterByVibes(events, vibes, loadedAtMs),
    [events, vibes, loadedAtMs],
  )
  const current = visibleEvents[0]

  const changeVibes = (next: VibeId[]) => {
    setVibes(next)
    saveStoredVibes(next)
  }

  const seriesDedupeKey = (e: EventItem) => {
    const sk = e.series_key?.trim()
    if (sk) return `s:${sk}`
    return `f:${e.title.trim().toLowerCase()}|${e.location.trim().toLowerCase()}`
  }

  const swipe = async (direction: 'left' | 'right') => {
    if (!current) return
    const action = direction === 'right' ? 'like' : 'dislike'
    try {
      await api.submitInteraction(getSessionId(), current.id, action)
    } catch (e) {
      setSwipeError("Couldn't save that swipe. Check your connection and try again.")
      // Rethrow so SwipeCard animates the card back into place.
      throw e
    }
    setSwipeError('')
    if (direction === 'right') notifyFirstLike()

    // Remove by id rather than position: with vibes on, the card shown isn't
    // necessarily the first event in the full list. A like also removes other
    // showtimes of the same series.
    const likedKey = direction === 'right' ? seriesDedupeKey(current) : null
    const removed = [
      current,
      ...events.filter((e) => e.id !== current.id && likedKey && seriesDedupeKey(e) === likedKey),
    ]
    const removedIds = new Set(removed.map((e) => e.id))
    setEvents((prev) => prev.filter((e) => !removedIds.has(e.id)))
    setLastSwipe({ action, removed })
  }

  const undoLastSwipe = async () => {
    if (!lastSwipe || undoing) return
    const [event] = lastSwipe.removed
    setUndoing(true)
    try {
      await api.undoInteraction(getSessionId(), event.id, lastSwipe.action)
      const restoredIds = new Set(lastSwipe.removed.map((e) => e.id))
      // Put the cards back on top of the deck, the undone one first.
      setEvents((prev) => [...lastSwipe.removed, ...prev.filter((e) => !restoredIds.has(e.id))])
      setLastSwipe(null)
      setSwipeError('')
    } catch {
      setSwipeError("Couldn't undo that swipe. Check your connection and try again.")
    } finally {
      setUndoing(false)
    }
  }

  const showTutorial = !loading && !error && !tutorialDismissed
  // Lock the other tabs as soon as Home is going to show the tutorial, including
  // while the deck is still loading. A load error unlocks them so Settings stays reachable.
  const lockNavForTutorial = !error && !tutorialDismissed

  useEffect(() => {
    setSwipeTutorialActive(lockNavForTutorial)
    return () => setSwipeTutorialActive(false)
  }, [lockNavForTutorial, setSwipeTutorialActive])

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
      {!showTutorial && events.length > 0 ? (
        <VibeChips selected={vibes} onChange={changeVibes} />
      ) : null}
      {!showTutorial && (current || lastSwipe) ? (
        <p className="home-swipe-hint">
          <button
            type="button"
            className={`home-undo-btn${lastSwipe ? '' : ' is-reserved'}`}
            onClick={() => void undoLastSwipe()}
            disabled={!lastSwipe || undoing}
            aria-hidden={lastSwipe ? undefined : true}
          >
            ↩ Undo {lastSwipe?.action === 'dislike' ? 'skip' : 'like'}
          </button>
        </p>
      ) : null}
      {swipeError ? (
        <p className="error" role="alert">
          {swipeError}
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
      {!showTutorial && !current && events.length > 0 ? (
        <section className="panel home-empty-panel">
          <p>Nothing left that matches these vibes. Try a different mix.</p>
          <button type="button" className="btn btn-primary" onClick={() => changeVibes([])}>
            Clear filters
          </button>
        </section>
      ) : null}
      {!showTutorial && events.length === 0 ? (
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
