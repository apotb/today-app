/**
 * Remove redundant date/time fragments from display titles when
 * start time is shown separately (common in ticketing copy).
 */
export const stripDateTimeFromTitle = (raw = '') => {
  let t = String(raw).replace(/\s+/g, ' ').trim()
  if (!t) return t

  const leadingPatterns = [
    /^(sun|mon|tue|wed|thu|fri|sat)\.?,?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?,?\s*\d{2,4}\s*[-–—:.]+\s*/i,
    /^(sun|mon|tue|wed|thu|fri|sat)\.?,?\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*[-–—]\s*/i,
  ]
  for (const re of leadingPatterns) {
    const next = t.replace(re, '').trim()
    if (next.length >= 3) t = next
  }

  const trailingPatterns = [
    /\s*[-–—|]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?,?\s*(\d{4})?.*$/i,
    /\s*[-–—|]\s*\d{1,2}\/\d{1,2}(\/\d{2,4})?.*$/,
    /\s*[-–—|]\s*\d{4}-\d{2}-\d{2}.*$/,
    /\s*[-–—|]\s*(\d{1,2})(:\d{2})?\s*(am|pm)(\s|$).*$/i,
    /\s*[-–—|]\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i,
    /\s*[-–—]\s*(mon|tue|wed|thu|fri|sat|sun)\.?\s+\d{1,2}.*$/i,
    /\s+[–-]\s*(today|tonight|tomorrow)\b.*$/i,
    /\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i,
    /\s+on\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?.*$/i,
    /\s+@\s*\d{1,2}(:\d{2})?\s*(am|pm)?\b.*$/i,
    /\s*\(\d{1,2}\/\d{1,2}(\/\d{2,4})?\)\s*$/,
  ]

  for (const re of trailingPatterns) {
    const next = t.replace(re, '').replace(/\s*[-–—|]\s*$/,'').trim()
    if (next.length >= 3) t = next
  }

  return t || String(raw).trim()
}
