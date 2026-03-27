import type { EventItem } from '../types/models'

type Props = {
  event: EventItem
  swiping?: 'left' | 'right' | null
  onSwipe: (direction: 'left' | 'right') => void
}

const formatPrice = (cost: number | null) => (cost && cost > 0 ? `$${cost}` : 'Free')

export function SwipeCard({ event, swiping, onSwipe }: Props) {
  return (
    <article className={`swipe-card ${swiping ? `swipe-${swiping}` : ''}`}>
      <img src={event.image_url} alt={event.title} className="card-image" />
      <div className="card-body">
        <p className="chip">{event.category}</p>
        <h2>{event.title}</h2>
        <p>{new Date(event.starts_at).toLocaleString()}</p>
        <p>{event.location}</p>
        <p>{formatPrice(event.cost)}</p>
        <p className="description">{event.description}</p>
      </div>
      <div className="card-actions">
        <button className="btn btn-secondary" onClick={() => onSwipe('left')}>
          Swipe Left
        </button>
        <button className="btn btn-primary" onClick={() => onSwipe('right')}>
          Swipe Right
        </button>
      </div>
    </article>
  )
}
