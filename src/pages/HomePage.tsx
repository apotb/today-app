import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { SwipeCard } from '../components/SwipeCard'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'

export function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [swiping, setSwiping] = useState<'left' | 'right' | null>(null)

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      await api.importLocalEvents('Downtown')
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
    setSwiping(direction)
    await new Promise((resolve) => setTimeout(resolve, 180))
    const action = direction === 'right' ? 'like' : 'dislike'
    await api.submitInteraction(getSessionId(), current.id, action)
    setEvents((prev) => prev.slice(1))
    setSwiping(null)
  }

  if (loading) return <p className="status">Loading events...</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="page center-page">
      <h1>What&apos;s happening today?</h1>
      {current ? (
        <SwipeCard event={current} onSwipe={swipe} swiping={swiping} />
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
