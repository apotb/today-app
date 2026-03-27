import type { EventItem } from '../types/models'

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
        <p>{new Date(event.starts_at).toLocaleString()}</p>
        <p>{event.location}</p>
        <p>{event.cost && event.cost > 0 ? `$${event.cost}` : 'Free'}</p>
        <p>{event.description}</p>
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
