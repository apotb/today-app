import { CATEGORY_OPTIONS, type EventCategory, type EventItem } from '../types/models'
import { formatDateTime12h } from './format'

const CATEGORY_BY_ID = new Map(CATEGORY_OPTIONS.map((c) => [c.id as string, c]))

/** "🎵 Music & Nightlife" instead of the raw id "music-nightlife". */
export const categoryLabel = (category: EventCategory | string) => {
  const option = CATEGORY_BY_ID.get(category)
  return option ? `${option.icon} ${option.name}` : category
}

/** The event's own page (tickets, details), only if it's a normal web link. */
export const eventPageUrl = (event: EventItem): string | null => {
  const raw = event.source_url?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Button text for the event's page: Ticketmaster pages sell tickets; others are just info. */
export const eventPageLabel = (url: string) => {
  try {
    return new URL(url).hostname.includes('ticketmaster') ? 'Get tickets' : 'Event page'
  } catch {
    return 'Event page'
  }
}

/** Apple devices (iPhone, iPad, Mac) open Apple Maps; everything else Google Maps. */
const prefersAppleMaps = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)

/** Directions link for the venue: searched by name + address, which maps apps match well. */
export const directionsUrl = (event: EventItem) => {
  const query = [event.location, event.address]
    .map((part) => part?.trim())
    .filter((part, i, all): part is string => Boolean(part) && all.indexOf(part) === i)
    .join(', ')
  const q = encodeURIComponent(query)
  return prefersAppleMaps()
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Opens the phone's share sheet (Messages, group chats, ...) with the event's name, time
 * and venue. Where sharing isn't supported (most desktop browsers), copies the text instead.
 */
export async function shareEvent(event: EventItem): Promise<ShareResult> {
  const url = eventPageUrl(event) ?? window.location.origin
  const text = `${event.title} · ${formatDateTime12h(event.starts_at)} at ${event.location}`

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: event.title, text, url })
      return 'shared'
    } catch (e) {
      // The user closing the share sheet throws AbortError; that's not a failure.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
