import type { EventItem } from '../types/models'

function toGoogleUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function icsDateUtc(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${d.getUTCDate()}`.padStart(2, '0')
  const h = `${d.getUTCHours()}`.padStart(2, '0')
  const min = `${d.getUTCMinutes()}`.padStart(2, '0')
  const s = `${d.getUTCSeconds()}`.padStart(2, '0')
  return `${y}${m}${day}T${h}${min}${s}Z`
}

function escapeIcs(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  let out = ''
  let i = 0
  while (i < line.length) {
    const chunk = i === 0 ? line.slice(i, 75) : ` ${line.slice(i, i + 74)}`
    out += (out ? '\r\n' : '') + chunk
    i += i === 0 ? 75 : 74
  }
  return out
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

export function buildIcsContent(event: EventItem): string {
  const uid = `${event.id.replace(/[^a-zA-Z0-9@.-]/g, '')}@today-app`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//Today App//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDateUtc(new Date().toISOString())}`,
    `DTSTART:${icsDateUtc(event.starts_at)}`,
    `DTEND:${icsDateUtc(event.ends_at)}`,
    foldIcsLine(`SUMMARY:${escapeIcs(event.title)}`),
    foldIcsLine(`LOCATION:${escapeIcs(event.address ?? event.location ?? '')}`),
    foldIcsLine(
      `DESCRIPTION:${escapeIcs([event.description, event.source_url ? `More info: ${event.source_url}` : ''].filter(Boolean).join('\\n\\n'))}`,
    ),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadIcsFile(event: EventItem): void {
  const blob = new Blob([buildIcsContent(event)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[/\\?%*:|"<>]/g, '').slice(0, 80) || 'event'}.ics`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
