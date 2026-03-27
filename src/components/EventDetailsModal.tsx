import type { EventItem } from '../types/models'
import { formatDateTime12h } from '../lib/format'

type Props = {
  event: EventItem
  onClose: () => void
}

export function EventDetailsModal({ event, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
