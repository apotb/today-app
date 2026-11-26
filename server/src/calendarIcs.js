const icsDateUtc = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${d.getUTCDate()}`.padStart(2, '0')
  const h = `${d.getUTCHours()}`.padStart(2, '0')
  const min = `${d.getUTCMinutes()}`.padStart(2, '0')
  const s = `${d.getUTCSeconds()}`.padStart(2, '0')
  return `${y}${m}${day}T${h}${min}${s}Z`
}

const escapeIcs = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')

/** ICS lines must be 75 octets or shorter, with a leading space on each continuation. */
const foldIcsLine = (line) => {
  if (line.length <= 75) return line
  let out = ''
  let i = 0
  while (i < line.length) {
    const size = i === 0 ? 75 : 74
    const chunk = i === 0 ? line.slice(i, size) : ` ${line.slice(i, i + size)}`
    out += (out ? '\r\n' : '') + chunk
    i += size
  }
  return out
}

/** A single-event calendar file Calendar on iPhone and Mac will import. */
export const buildEventIcs = (event) => {
  const start = icsDateUtc(event.starts_at)
  if (!start) return null
  let end = icsDateUtc(event.ends_at)
  if (!end || end <= start) {
    end = icsDateUtc(new Date(new Date(event.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString())
  }
  const uid = `${String(event.id).replace(/[^a-zA-Z0-9@.-]/g, '')}@today-app`
  const location = event.address || event.location || ''
  const description = [event.description, event.source_url ? `More info: ${event.source_url}` : '']
    .filter(Boolean)
    .join('\n\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Today App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDateUtc(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    foldIcsLine(`SUMMARY:${escapeIcs(event.title || 'Event')}`),
    foldIcsLine(`LOCATION:${escapeIcs(location)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcs(description)}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
