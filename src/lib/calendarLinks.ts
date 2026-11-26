import type { EventItem } from '../types/models'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

function toGoogleUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function googleCalendarUrl(event: EventItem): string {
  const start = toGoogleUtc(event.starts_at)
  const end = toGoogleUtc(event.ends_at)
  const loc = event.address ?? event.location ?? ''
  const detailsParts = [event.description]
  if (event.source_url) detailsParts.push(`More info: ${event.source_url}`)
  const details = detailsParts.filter(Boolean).join('\n\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details,
    location: loc,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Calendar file for this event. Apple Calendar opens it on iPhone and Mac. */
export function appleCalendarUrl(event: EventItem): string {
  return `${API_BASE}/events/${encodeURIComponent(event.id)}/calendar.ics`
}
