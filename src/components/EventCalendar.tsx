import { useMemo } from 'react'
import type { EventItem } from '../types/models'

type Props = {
  events: EventItem[]
  onSelect: (event: EventItem) => void
}

const getDayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function EventCalendar({ events, onSelect }: Props) {
  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const event of events) {
      const day = new Date(event.starts_at).toDateString()
      const list = map.get(day) ?? []
      list.push(event)
      map.set(day, list)
    }
    return Array.from(map.entries())
  }, [events])

  if (events.length === 0) {
    return <p className="empty">No liked events yet. Swipe right on events you want to attend.</p>
  }

  return (
    <section className="calendar-grid">
      {byDay.map(([day, dayEvents]) => (
        <div key={day} className="calendar-day">
          <h3>{getDayLabel(dayEvents[0].starts_at)}</h3>
          <ul>
            {dayEvents.map((event) => (
              <li key={event.id}>
                <button onClick={() => onSelect(event)}>
                  <span>{new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{event.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
