import { useState } from 'react'
import type { EventItem } from '../types/models'
import { formatDateTime12h, formatPrice } from '../lib/format'
import { downloadIcsFile, googleCalendarUrl } from '../lib/calendarLinks'
import {
  categoryLabel,
  directionsUrl,
  eventPageLabel,
  eventPageUrl,
  shareEvent,
} from '../lib/eventActions'

type Props = {
  event: EventItem
  onClose: () => void
}

const SHARE_MESSAGES = {
  shared: '',
  cancelled: '',
  copied: 'Copied! Paste it in your group chat.',
  failed: "Couldn't share from this browser.",
} as const

export function EventDetailsModal({ event, onClose }: Props) {
  const gcal = googleCalendarUrl(event)
  const pageUrl = eventPageUrl(event)
  const [shareMessage, setShareMessage] = useState('')

  const share = async () => {
    setShareMessage('')
    setShareMessage(SHARE_MESSAGES[await shareEvent(event)])
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-scroll" onClick={(e) => e.stopPropagation()}>
        <img src={event.image_url} alt={event.title} />
        <p className="chip">{categoryLabel(event.category)}</p>
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
            <strong>Price:</strong> {formatPrice(event.cost)}
          </p>
        </div>
        <div className="modal-calendar-actions">
          {pageUrl ? (
            <a
              className="btn btn-primary modal-cal-btn"
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {eventPageLabel(pageUrl)}
            </a>
          ) : null}
          <button type="button" className="btn btn-secondary modal-cal-btn" onClick={() => void share()}>
            Share
          </button>
          <a
            className="btn btn-secondary modal-cal-btn"
            href={directionsUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Directions
          </a>
        </div>
        {shareMessage ? (
          <p className="modal-cal-note" role="status">
            {shareMessage}
          </p>
        ) : null}
        <p>{event.description}</p>
        <div className="modal-calendar-actions">
          <a className="btn btn-secondary modal-cal-btn" href={gcal} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar
          </a>
          <button
            type="button"
            className="btn btn-secondary modal-cal-btn"
            onClick={() => downloadIcsFile(event)}
          >
            Add to Apple Calendar
          </button>
        </div>
        <p className="modal-cal-note">
          Apple Calendar uses a standard .ics file (opens in Calendar on most devices).
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
