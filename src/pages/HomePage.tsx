import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { SwipeCard } from '../components/SwipeCard'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'

export function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const { events: list } = await api.discoverEvents(getSessionId())
      setEvents(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  const current = events[0]

  const swipe = async (direction: 'left' | 'right') => {
    if (!current) return
    const action = direction === 'right' ? 'like' : 'dislike'
    await api.submitInteraction(getSessionId(), current.id, action)
    setEvents((prev) => prev.slice(1))
  }

  const markAttended = async () => {
    if (!current) return
    await api.submitInteraction(getSessionId(), current.id, 'attended')
    setEvents((prev) => prev.slice(1))
  }

  if (loading) return <p className="status">Loading events...</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="page">
      <h1>Discover events in the next 24 hours</h1>
      {current ? (
        <SwipeCard event={current} onSwipe={swipe} onAttended={markAttended} />
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
