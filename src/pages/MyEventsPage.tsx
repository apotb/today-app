import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { EventCalendar } from '../components/EventCalendar'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { CALENDAR_WINDOW_MS } from '../lib/calendarLayout'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'
import { maybeNotifyUpcoming } from '../lib/notifications'

export function MyEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  /** The most recently removed event, so it can be put back. */
  const [lastRemoved, setLastRemoved] = useState<EventItem | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const refreshEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Saved events are kept on the server, so no provider sync (or location) is needed here.
      const response = await api.getMyEvents(getSessionId())
      setEvents(response.events)
      setNowMs(Date.now())
      await maybeNotifyUpcoming(response.events)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshEvents()
    }, 0)
    return () => window.clearTimeout(id)
  }, [refreshEvents])

  // Keep the current-time line and the 48-hour window moving.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const upcoming = useMemo(
    () =>
      events.filter((event) => {
        const t = new Date(event.starts_at).getTime()
        return t >= nowMs && t <= nowMs + CALENDAR_WINDOW_MS
      }),
    [events, nowMs],
  )

  const restore = (event: EventItem) =>
    setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]))

  const removeEvent = async (event: EventItem) => {
    setActionError('')
    setLastRemoved(null)
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
    try {
      await api.undoInteraction(getSessionId(), event.id, 'like')
      setLastRemoved(event)
    } catch {
      restore(event)
      setActionError(`Couldn't remove "${event.title}". Check your connection and try again.`)
    }
  }

  const undoRemove = async () => {
    if (!lastRemoved || undoing) return
    const event = lastRemoved
    setUndoing(true)
    setActionError('')
    try {
      await api.submitInteraction(getSessionId(), event.id, 'like')
      restore(event)
      setLastRemoved((prev) => (prev?.id === event.id ? null : prev))
    } catch {
      setActionError(`Couldn't restore "${event.title}". Check your connection and try again.`)
    } finally {
      setUndoing(false)
    }
  }

  if (loading) {
    return (
      <div className="page page-events-loading">
        <h1>Events</h1>
        <div className="events-loading events-loading-full" role="status">
          <div className="spinner spinner-lg" aria-hidden />
          <p className="events-loading-title">Loading your events…</p>
                  </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Events</h1>
      {actionError ? (
        <p className="error" role="alert">
          {actionError}
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {!error && upcoming.length === 0 ? (
        <p className="empty events-calendar-subtitle">
          No saved events in the next 48 hours. Swipe right on events you want to attend.
        </p>
      ) : null}
      {!error && upcoming.length > 0 ? (
        <EventCalendar
          events={upcoming}
          nowMs={nowMs}
          onSelect={setSelected}
          onRemove={(event) => void removeEvent(event)}
        />
      ) : null}
      {lastRemoved ? (
        <div className="cal-undo" role="status">
          <span>Removed {lastRemoved.title}</span>
          <button type="button" onClick={() => void undoRemove()} disabled={undoing}>
            Undo
          </button>
        </div>
      ) : null}
      {selected ? <EventDetailsModal event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
