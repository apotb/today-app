import type { EventItem } from '../types/models'

/** How far ahead the Events tab looks. Matches FEED_WINDOW_MS in server/src/index.js. */
export const CALENDAR_WINDOW_MS = 48 * 60 * 60 * 1000

export const HOUR_MS = 60 * 60 * 1000
/** Shortest span drawn, so brief events still fit their title and remove button. */
const MIN_BLOCK_MS = 45 * 60 * 1000

/** The part of an event that falls on one day, with its overlap column. */
export type CalendarBlock = {
  event: EventItem
  startMs: number
  endMs: number
  column: number
  columns: number
}

export type CalendarDay = {
  /** Local midnight of this day; also its identity. */
  key: number
  startMs: number
  endMs: number
  hours: number[]
  blocks: CalendarBlock[]
}

function eventEndMs(event: EventItem): number {
  const start = new Date(event.starts_at).getTime()
  const end = new Date(event.ends_at).getTime()
  return end > start ? end : start + HOUR_MS
}

/** Places overlapping blocks side by side, like a calendar day view. */
function assignColumns(blocks: CalendarBlock[]) {
  blocks.sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs)
  let cluster: CalendarBlock[] = []
  let columnEnds: number[] = []
  let clusterEnd = -Infinity

  const closeCluster = () => {
    for (const block of cluster) block.columns = columnEnds.length
    cluster = []
    columnEnds = []
  }

  for (const block of blocks) {
    if (block.startMs >= clusterEnd) closeCluster()
    const free = columnEnds.findIndex((end) => end <= block.startMs)
    block.column = free === -1 ? columnEnds.length : free
    columnEnds[block.column] = block.endMs
    cluster.push(block)
    clusterEnd = Math.max(clusterEnd, block.endMs)
  }
  closeCluster()
}

/** Splits now → 48h ahead into local days and lays out each day's events. */
export function buildCalendarDays(events: EventItem[], nowMs: number): CalendarDay[] {
  const firstHour = new Date(nowMs)
  firstHour.setMinutes(0, 0, 0)
  // Finish the hour the window ends in, so the grid ends on a whole line.
  const lastHour = new Date(nowMs + CALENDAR_WINDOW_MS)
  lastHour.setMinutes(60, 0, 0)
  const days: CalendarDay[] = []

  let startMs = firstHour.getTime()
  while (startMs < lastHour.getTime()) {
    const midnight = new Date(startMs)
    midnight.setHours(0, 0, 0, 0)
    const key = midnight.getTime()
    midnight.setDate(midnight.getDate() + 1)
    const endMs = Math.min(midnight.getTime(), lastHour.getTime())

    const hours: number[] = []
    for (let h = startMs; h < endMs; h += HOUR_MS) hours.push(h)

    const blocks: CalendarBlock[] = []
    for (const event of events) {
      const from = Math.max(new Date(event.starts_at).getTime(), startMs)
      const to = Math.min(eventEndMs(event), endMs)
      if (to <= from) continue
      // Near the end of the day, grow the block upward instead of off the grid.
      const blockEnd = Math.min(Math.max(to, from + MIN_BLOCK_MS), endMs)
      const blockStart = Math.max(Math.min(from, blockEnd - MIN_BLOCK_MS), startMs)
      blocks.push({ event, startMs: blockStart, endMs: blockEnd, column: 0, columns: 1 })
    }
    assignColumns(blocks)
    days.push({ key, startMs, endMs, hours, blocks })
    startMs = endMs
  }
  return days
}
