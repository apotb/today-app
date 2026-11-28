import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { EventCalendar } from '../components/EventCalendar'
import { EventExpandPage, type ExpandOrigin } from '../components/EventExpandPage'
import { CALENDAR_WINDOW_MS, eventEndMs } from '../lib/calendarLayout'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'
import { maybeNotifyUpcoming } from '../lib/notifications'

export function MyEventsPage({ active }: { active: boolean }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<{ event: EventItem; origin: ExpandOrigin } | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  /** The most recently removed event, so it can be put back. */
  const [lastRemoved, setLastRemoved] = useState<EventItem | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const readyRef = useRef(false)

  const refreshEvents = useCallback(async (silent = false) => {
    const quiet = silent && readyRef.current
    if (!quiet) {
      setLoading(true)
      setError('')
    }
    try {
      // Saved events are kept on the server, so no provider sync (or location) is needed here.
      const response = await api.getMyEvents(getSessionId())
      setEvents(response.events)
      setNowMs(Date.now())
      readyRef.current = true
      setReady(true)
      setError('')
      await maybeNotifyUpcoming(response.events)
    } catch (e) {
      if (!readyRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load your events.')
      }
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshEvents(false)
    }, 0)
    return () => window.clearTimeout(id)
  }, [refreshEvents])

  const wasActive = useRef(false)
  useEffect(() => {
    const becameActive = active && !wasActive.current
    wasActive.current = active
    if (!becameActive || !readyRef.current) return
    void refreshEvents(true)
  }, [active, refreshEvents])

  useEffect(() => {
    if (active) return
    setSelected(null)
  }, [active])

  // Keep the current-time line and the 48-hour window moving.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const upcoming = useMemo(
    () =>
      // Keep events that are happening right now (started but not ended), not just
      // ones that haven't started, so their details and directions stay one tap away.
      events.filter((event) => {
        const start = new Date(event.starts_at).getTime()
        return eventEndMs(event) > nowMs && start <= nowMs + CALENDAR_WINDOW_MS
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

  if (loading && !ready) {
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
          onSelect={(event, block) => {
            const rect = block.getBoundingClientRect()
            setSelected({
              event,
              origin: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                radius: 6,
                imageHeight: Math.max(rect.height, 1),
                fadeContent: true,
              },
            })
          }}
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
      {active && selected ? (
        <EventExpandPage
          event={selected.event}
          origin={selected.origin}
          measureOrigin={() => {
            const el = document.querySelector(`[data-event-id="${CSS.escape(selected.event.id)}"]`)
            if (!(el instanceof HTMLElement)) return null
            const rect = el.getBoundingClientRect()
            return {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              radius: 6,
              imageHeight: Math.max(rect.height, 1),
              fadeContent: true,
            }
          }}
          onExited={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}
