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

/** Start of today (local) */
function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Midnight at the start of the day that is `daysAfterToday` days after today (local). */
function startOfDayAfterToday(daysAfter: number): Date {
  const d = startOfToday()
  d.setDate(d.getDate() + daysAfter)
  return d
}

export function MyEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [error, setError] = useState('')

  const refreshEvents = useCallback(async () => {
    try {
      const settings = getStoredDiscoverySettings()
      const loc = getStoredLocation()
      if (!loc) {
        setError('Allow location in Settings to load your events.')
        return
      }
      await api.syncEvents(getSessionId(), loc, settings.radius, settings.unit)
      const response = await api.getMyEvents(getSessionId())
      setEvents(response.events)
      await maybeNotifyUpcoming(response.events)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your events.')
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
    const now = Date.now()
    const endExclusive = startOfDayAfterToday(3)
    return events.filter((event) => {
      const t = new Date(event.starts_at).getTime()
      return t >= now && t < endExclusive.getTime()
    })
  }, [events])

  return (
    <div className="page">
      <h1>Events</h1>
      <p className="status events-calendar-subtitle">
        Today through {startOfDayAfterToday(2).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
        (no past events)
      </p>
      {error ? <p className="error">{error}</p> : <EventCalendar events={upcoming} onSelect={setSelected} />}
      {selected ? <EventDetailsModal event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
