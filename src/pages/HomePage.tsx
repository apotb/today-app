import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { SwipeCard } from '../components/SwipeCard'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'
import { getStoredLocation } from '../lib/location'
import { useIsDesktop } from '../lib/useIsDesktop'
import {
  getStoredDiscoverySettings,
  onDiscoverySettingsChanged,
} from '../lib/discoverySettings'

export function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isDesktop = useIsDesktop()
  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = getStoredDiscoverySettings()
      await api.syncEvents(
        getSessionId(),
        getStoredLocation(),
        settings.radius,
        settings.unit,
      )
      const { events: list } = await api.discoverEvents(getSessionId())
      setEvents(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [])

  useEffect(() => onDiscoverySettingsChanged(() => void loadEvents()), [loadEvents])

  const current = events[0]
  const totalVisible = events.length

  const swipe = async (direction: 'left' | 'right') => {
    if (!current) return
    const action = direction === 'right' ? 'like' : 'dislike'
    await api.submitInteraction(getSessionId(), current.id, action)
    setEvents((prev) => prev.slice(1))
  }

  if (loading) return <p className="status">Loading events...</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="page center-page">
      <h1>What&apos;s happening today?</h1>
      {current ? (
        <div className="feed-meta">
          <p className="status">
            {totalVisible} event{totalVisible === 1 ? '' : 's'} left in your next-24-hour feed
          </p>
          <button className="btn btn-ghost" onClick={() => void loadEvents()}>
            Refresh feed
          </button>
        </div>
      ) : null}
      {current ? (
        <SwipeCard event={current} onSwipe={swipe} showDesktopNav={isDesktop} />
      ) : (
        <section className="panel">
          <p>No more events right now. Check back soon.</p>
          <button className="btn btn-primary" onClick={() => void loadEvents()}>
            Refresh
          </button>
        </section>
      )}
    </div>
  )
}
