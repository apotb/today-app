import type { EventItem } from '../types/models'

const NOTIFIED_KEY = 'today.notified.events'

const getNotified = () => {
  const raw = localStorage.getItem(NOTIFIED_KEY)
  if (!raw) return new Set<string>()
  try {
    return new Set<string>(JSON.parse(raw) as string[])
  } catch {
    return new Set<string>()
  }
}

const saveNotified = (ids: Set<string>) => {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(ids)))
}

export async function maybeNotifyUpcoming(events: EventItem[]) {
  if (!('Notification' in window)) return

  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (Notification.permission !== 'granted') return

  const now = Date.now()
  const nextHours = now + 3 * 60 * 60 * 1000
  const notified = getNotified()

  for (const event of events) {
    const start = new Date(event.starts_at).getTime()
    if (start < now || start > nextHours) continue
    if (notified.has(event.id)) continue
    new Notification('Upcoming event on Today', {
      body: `${event.title} starts at ${new Date(event.starts_at).toLocaleTimeString()}`,
    })
    notified.add(event.id)
  }

  saveNotified(notified)
}

