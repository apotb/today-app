import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CATEGORY_OPTIONS, type EventItem } from '../types/models'
import { buildCalendarDays, HOUR_MS } from '../lib/calendarLayout'
import { formatTime12h } from '../lib/format'

type Props = {
  events: EventItem[]
  nowMs: number
  onSelect: (event: EventItem, block: HTMLElement) => void
  onRemove: (event: EventItem) => void
}

const HOUR_HEIGHT = 64
const MIN_COLUMN_WIDTH = 124
const GUTTER_WIDTH = 60
/** Event accent colors, cycled by category. */
const COLORS = ['#1a7fe0', '#15935a', '#8e44c9', '#d9600c', '#d32f5b', '#0b8793']

const toPx = (ms: number) => (ms / HOUR_MS) * HOUR_HEIGHT

const eventColor = (event: EventItem) => {
  const index = CATEGORY_OPTIONS.findIndex((c) => c.id === event.category)
  return COLORS[Math.max(0, index) % COLORS.length]
}

const formatHour = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric' })

const formatFullDay = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

export function EventCalendar({ events, nowMs, onSelect, onRemove }: Props) {
  const days = useMemo(() => buildCalendarDays(events, nowMs), [events, nowMs])
  const scrollRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef(new Map<number, HTMLElement>())
  const didInitialScroll = useRef(false)
  const [visibleDay, setVisibleDay] = useState<number | null>(null)

  const activeDay = days.some((d) => d.key === visibleDay) ? visibleDay : days[0].key

  // Open at the first saved event rather than a possibly empty stretch of hours.
  useEffect(() => {
    if (didInitialScroll.current) return
    const scroller = scrollRef.current
    const day = days.find((d) => d.blocks.length > 0)
    const section = day && dayRefs.current.get(day.key)
    if (!scroller || !day || !section) return
    didInitialScroll.current = true
    scroller.scrollTop = section.offsetTop + toPx(day.blocks[0].startMs - day.startMs) - 24
  }, [days])

  const goToDay = (key: number) => {
    const section = dayRefs.current.get(key)
    if (section) scrollRef.current?.scrollTo({ top: section.offsetTop, behavior: 'smooth' })
  }

  const onScroll = () => {
    const top = (scrollRef.current?.scrollTop ?? 0) + 8
    let current = days[0].key
    for (const day of days) {
      const section = dayRefs.current.get(day.key)
      if (section && section.offsetTop <= top) current = day.key
    }
    setVisibleDay(current)
  }

  const maxColumns = Math.max(1, ...days.flatMap((d) => d.blocks.map((b) => b.columns)))

  return (
    <section className="cal" aria-label="Saved events, next 48 hours">
      <div className="cal-days">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={day.key === activeDay ? 'cal-day-btn active' : 'cal-day-btn'}
            aria-label={formatFullDay(day.key)}
            aria-current={day.key === activeDay ? 'date' : undefined}
            onClick={() => goToDay(day.key)}
          >
            <span className="cal-day-name">
              {new Date(day.key).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span className="cal-day-number">{new Date(day.key).getDate()}</span>
            <span className={day.blocks.length > 0 ? 'cal-day-dot has-events' : 'cal-day-dot'} />
          </button>
        ))}
      </div>
      <div className="cal-scroll" ref={scrollRef} onScroll={onScroll}>
        {/* Many overlapping events scroll sideways instead of shrinking to slivers. */}
        <div style={{ minWidth: GUTTER_WIDTH + maxColumns * MIN_COLUMN_WIDTH }}>
          {days.map((day) => (
            <section
              key={day.key}
              ref={(el) => {
                if (el) dayRefs.current.set(day.key, el)
                else dayRefs.current.delete(day.key)
              }}
            >
              <h2 className="cal-day-heading">
                <span>{formatFullDay(day.key)}</span>
              </h2>
              <div className="cal-grid" style={{ height: toPx(day.endMs - day.startMs) }}>
                <div className="cal-gutter" style={{ width: GUTTER_WIDTH }}>
                  {day.hours.map((hour) => (
                    <div key={hour} className="cal-hour" style={{ height: HOUR_HEIGHT }}>
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>
                <div className="cal-lane">
                  {day.hours.map((hour) => (
                    <div key={hour} className="cal-line" style={{ height: HOUR_HEIGHT }} />
                  ))}
                  {day.blocks.map((block) => (
                    <div
                      key={block.event.id}
                      className="cal-event"
                      data-event-id={block.event.id}
                      style={
                        {
                          top: toPx(block.startMs - day.startMs) + 1,
                          height: toPx(block.endMs - block.startMs) - 2,
                          left: `${(block.column / block.columns) * 100}%`,
                          width: `calc(${100 / block.columns}% - 3px)`,
                          '--cal-color': eventColor(block.event),
                        } as CSSProperties
                      }
                    >
                      <button
                        type="button"
                        className="cal-event-open"
                        onClick={(e) => {
                          const blockEl = e.currentTarget.closest('.cal-event')
                          if (blockEl instanceof HTMLElement) onSelect(block.event, blockEl)
                        }}
                      >
                        <span className="cal-event-title">{block.event.title}</span>
                        <span className="cal-event-meta">
                          {formatTime12h(block.event.starts_at)} · {block.event.location}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="cal-event-remove"
                        aria-label={`Remove ${block.event.title}`}
                        title="Remove event"
                        onClick={() => onRemove(block.event)}
                      >
                        <span aria-hidden>✕</span>
                      </button>
                    </div>
                  ))}
                  {nowMs >= day.startMs && nowMs < day.endMs ? (
                    <div className="cal-now" style={{ top: toPx(nowMs - day.startMs) }} aria-hidden />
                  ) : null}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
