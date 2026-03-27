import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { EventCalendar } from '../components/EventCalendar'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { getSessionId } from '../lib/session'
import type { EventItem } from '../types/models'

export function MyEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const response = await api.getMyEvents(getSessionId())
        setEvents(response.events)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load your events.')
      }
    }
    void run()
  }, [])

  return (
    <div className="page">
      <h1>My Events</h1>
      {error ? <p className="error">{error}</p> : <EventCalendar events={events} onSelect={setSelected} />}
      {selected ? <EventDetailsModal event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
