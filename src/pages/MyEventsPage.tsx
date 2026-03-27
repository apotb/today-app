import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { EventCalendar } from '../components/EventCalendar'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { getSessionId } from '../lib/session'
import { formatDateTime12h } from '../lib/format'
import type { EventItem } from '../types/models'
import { getStoredLocation } from '../lib/location'
import {
  getStoredDiscoverySettings,
  onDiscoverySettingsChanged,
} from '../lib/discoverySettings'
import { maybeNotifyUpcoming } from '../lib/notifications'

export function MyEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [error, setError] = useState('')
  const [referenceNow] = useState(() => Date.now())

  const refreshEvents = useCallback(async () => {
    try {
      const settings = getStoredDiscoverySettings()
      await api.syncEvents(
        getSessionId(),
        getStoredLocation(),
        settings.radius,
        settings.unit,
      )
      const response = await api.getMyEvents(getSessionId())
      setEvents(response.events)
      await maybeNotifyUpcoming(response.events)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your events.')
    }
  }, [])

  useEffect(() => {
    void refreshEvents()
  }, [])

  useEffect(() => onDiscoverySettingsChanged(() => void refreshEvents()), [refreshEvents])

  const setAttendance = async (eventId: string, status: 'attended' | 'missed') => {
    await api.setAttendance(getSessionId(), eventId, status)
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, attendance_status: status } : event,
      ),
    )
  }

  const in24h = referenceNow + 24 * 60 * 60 * 1000
  const upcoming = events.filter((event) => {
    const starts = new Date(event.starts_at).getTime()
    return starts >= referenceNow && starts <= in24h
  })
  const past = events.filter((event) => new Date(event.starts_at).getTime() < referenceNow)

  return (
    <div className="page">
      <h1>My Events</h1>
      {error ? <p className="error">{error}</p> : <EventCalendar events={upcoming} onSelect={setSelected} />}
      <section className="panel past-events">
        <h2>Past Events</h2>
        {past.length === 0 ? (
          <p className="empty">No past events yet.</p>
        ) : (
          <ul>
            {past.map((event) => (
              <li key={event.id}>
                <div>
                  <p className="past-title">{event.title}</p>
                  <p className="status">{formatDateTime12h(event.starts_at)}</p>
                </div>
                <div className="attendance-actions">
                  <button
                    className={`btn btn-ghost ${event.attendance_status === 'attended' ? 'active' : ''}`}
                    onClick={() => void setAttendance(event.id, 'attended')}
                  >
                    Attended
                  </button>
                  <button
                    className={`btn btn-ghost ${event.attendance_status === 'missed' ? 'active' : ''}`}
                    onClick={() => void setAttendance(event.id, 'missed')}
                  >
                    Did not attend
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected ? <EventDetailsModal event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
