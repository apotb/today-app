import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { EventCalendar } from '../components/EventCalendar'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'
import { getStoredLocation } from '../lib/location'
import {
  getStoredDiscoverySettings,
  onDiscoverySettingsChanged,
} from '../lib/discoverySettings'
import { maybeNotifyUpcoming } from '../lib/notifications'

/** Start of today (local) for a wall-clock instant */
function startOfTodayMs(nowMs: number): Date {
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Midnight at the start of the day that is `daysAfter` days after `nowMs`'s calendar day (local). */
function startOfDayAfterMs(nowMs: number, daysAfter: number): Date {
  const d = startOfTodayMs(nowMs)
  d.setDate(d.getDate() + daysAfter)
  return d
}

export function MyEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const refreshEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = getStoredDiscoverySettings()
      const loc = getStoredLocation()
      if (!loc) {
        setError('Allow location in Settings to load your events.')
        setEvents([])
        return
      }
      await api.syncEvents(getSessionId(), loc, settings.radius, settings.unit)
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

  useEffect(() => onDiscoverySettingsChanged(() => void refreshEvents()), [refreshEvents])

  const upcoming = useMemo(() => {
    const endExclusive = startOfDayAfterMs(nowMs, 3)
    return events.filter((event) => {
      const t = new Date(event.starts_at).getTime()
      return t >= nowMs && t < endExclusive.getTime()
    })
  }, [events, nowMs])

  if (loading) {
    return (
      <div className="page page-events-loading">
        <h1>Events</h1>
        <div className="events-loading events-loading-full" role="status">
          <div className="spinner spinner-lg" aria-hidden />
          <p className="events-loading-title">Loading your events…</p>
          <p className="events-loading-sub">Syncing with the server</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Events</h1>
      <p className="status events-calendar-subtitle">
        Today through{' '}
        {startOfDayAfterMs(nowMs, 2).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}{' '}
        (no past events)
      </p>
      {error ? <p className="error">{error}</p> : <EventCalendar events={upcoming} onSelect={setSelected} />}
      {selected ? <EventDetailsModal event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
