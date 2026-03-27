import type { EventItem } from '../types/models'
import { formatDateTime12h } from '../lib/format'
import { downloadIcsFile, googleCalendarUrl } from '../lib/calendarLinks'

type Props = {
  event: EventItem
  onClose: () => void
}

export function EventDetailsModal({ event, onClose }: Props) {
  const gcal = googleCalendarUrl(event)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-scroll" onClick={(e) => e.stopPropagation()}>
        <img src={event.image_url} alt={event.title} />
        <h3>{event.title}</h3>
        <div className="event-detail-grid">
          <p>
            <strong>Starts:</strong> {formatDateTime12h(event.starts_at)}
          </p>
          <p>
            <strong>Venue:</strong> {event.location}
          </p>
          <p>
            <strong>Address:</strong> {event.address ?? event.location}
          </p>
          <p>
            <strong>Price:</strong> {event.cost && event.cost > 0 ? `$${event.cost}` : 'Free'}
          </p>
        </div>
        <p>{event.description}</p>
        <div className="modal-calendar-actions">
          <a className="btn btn-secondary" href={gcal} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => downloadIcsFile(event)}
          >
            Add to Apple Calendar
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
