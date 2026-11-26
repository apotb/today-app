import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControlsWithThen,
} from 'framer-motion'
import type { EventItem } from '../types/models'
import { formatDateTime12h, formatPrice } from '../lib/format'
import { useIsDesktop } from '../lib/useIsDesktop'
import { appleCalendarUrl, googleCalendarUrl } from '../lib/calendarLinks'
import { directionsUrl, eventPageLabel, eventPageUrl, shareEvent } from '../lib/eventActions'
import { EventBadges } from './EventBadges'

export type ExpandOrigin = {
  top: number
  left: number
  width: number
  height: number
  radius: number
  imageHeight: number
  /** Calendar blocks have no photo preview, so the text fades in as the page grows. */
  fadeContent: boolean
}

type Props = {
  event: EventItem
  origin: ExpandOrigin
  measureOrigin: () => ExpandOrigin | null
  onOpened?: () => void
  onExited: () => void
  /** Conceal the source card while this page flies off, and bring it back if the swipe fails. */
  onFlyStart?: () => void
  onFlyCancel?: () => void
  onSwipe?: (direction: 'left' | 'right') => Promise<void> | void
}

const SHARE_MESSAGES = {
  shared: '',
  cancelled: '',
  copied: 'Copied! Paste it in your group chat.',
  failed: "Couldn't share from this browser.",
} as const

const COLLAPSE_DISTANCE = 120
const COLLAPSE_FLICK = 0.6

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function frameTransition() {
  if (prefersReducedMotion()) return { duration: 0.01 }
  // restDelta/restSpeed end the spring when it looks finished. The defaults
  // wait until it is almost perfectly still, which is the pause after the move.
  return {
    type: 'spring' as const,
    stiffness: 500,
    damping: 44,
    mass: 0.78,
    restDelta: 1.25,
    restSpeed: 60,
  }
}

/** Same spring as opening, but it resolves once the motion looks finished. */
function closeTransition() {
  if (prefersReducedMotion()) return { duration: 0.01 }
  return {
    type: 'spring' as const,
    stiffness: 500,
    damping: 44,
    mass: 0.78,
    restDelta: 2.5,
    restSpeed: 180,
  }
}

/** Fullscreen frame between the brand header and the tab bar. */
function fullscreenTarget(originImage: number): ExpandOrigin {
  const headerBottom = document.querySelector('.app-top-brand')?.getBoundingClientRect().bottom ?? 0
  const navTop = document.querySelector('.bottom-nav')?.getBoundingClientRect().top ?? window.innerHeight
  const height = Math.max(240, navTop - headerBottom)
  const preferred = Math.round(height * 0.46)
  return {
    top: headerBottom,
    left: 0,
    width: window.innerWidth,
    height,
    radius: 0,
    imageHeight: Math.min(Math.max(originImage, preferred), Math.max(180, height - 200)),
    fadeContent: false,
  }
}

function Chevron({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'up' ? 'M6 14.5 12 8.5l6 6' : 'M6 9.5 12 15.5l6-6'}
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function EventExpandPage({
  event,
  origin,
  measureOrigin,
  onOpened,
  onExited,
  onFlyStart,
  onFlyCancel,
  onSwipe,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const originRef = useRef(origin)
  const measureRef = useRef(measureOrigin)
  const onOpenedRef = useRef(onOpened)
  const onExitedRef = useRef(onExited)
  const onFlyStartRef = useRef(onFlyStart)
  const onFlyCancelRef = useRef(onFlyCancel)
  const onSwipeRef = useRef(onSwipe)
  measureRef.current = measureOrigin
  onOpenedRef.current = onOpened
  onExitedRef.current = onExited
  onFlyStartRef.current = onFlyStart
  onFlyCancelRef.current = onFlyCancel
  onSwipeRef.current = onSwipe

  const phase = useRef<'opening' | 'open' | 'exit' | 'fly'>('opening')
  const playback = useRef<AnimationPlaybackControlsWithThen[]>([])
  const generation = useRef(0)
  const momentum = useRef<((now: number) => void) | null>(null)

  const top = useMotionValue(origin.top)
  const left = useMotionValue(origin.left)
  const width = useMotionValue(origin.width)
  const height = useMotionValue(origin.height)
  const radius = useMotionValue(origin.radius)
  const heroHeight = useMotionValue(origin.imageHeight)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const opacity = useMotionValue(1)
  const chromeOpacity = useMotionValue(0)
  const bodyOpacity = useMotionValue(origin.fadeContent ? 0 : 1)
  const contentShift = useMotionValue(0)
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10])
  const borderRadius = useTransform([radius, y], ([base, pull]) => {
    const corner = typeof base === 'number' ? base : 0
    const drag = typeof pull === 'number' ? pull : 0
    return corner + Math.min(18, Math.max(0, drag) / 8)
  })
  const upChevronOpacity = useTransform(chromeOpacity, [0, 1], [1, 0])
  const deckNavOpacity = useTransform(chromeOpacity, [0, 1], [1, 0])
  const showDeckNav = useIsDesktop() && !origin.fadeContent

  const [interactive, setInteractive] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  const stopPlayback = () => {
    playback.current.forEach((control) => control.stop())
    playback.current = []
  }

  const playFrame = (target: ExpandOrigin, transition = frameTransition()) => {
    stopPlayback()
    const id = ++generation.current
    const controls = [
      animate(top, target.top, transition),
      animate(left, target.left, transition),
      animate(width, target.width, transition),
      animate(height, target.height, transition),
      animate(radius, target.radius, transition),
      animate(heroHeight, target.imageHeight, transition),
    ]
    playback.current = controls
    return Promise.all(controls).then(() => id === generation.current)
  }

  const beginClose = () => {
    if (phase.current === 'exit' || phase.current === 'fly') return
    phase.current = 'exit'
    setLeaving(true)
    setInteractive(false)
    momentum.current = null
    const pulled = y.get()
    if (pulled) {
      top.set(top.get() + pulled)
      y.set(0)
    }
    const shifted = x.get()
    if (shifted) {
      left.set(left.get() + shifted)
      x.set(0)
    }
    const exit = measureRef.current() ?? originRef.current
    const motion = closeTransition()
    const fadeChrome = prefersReducedMotion() ? { duration: 0.01 } : { duration: 0.16, ease: 'easeOut' as const }
    void animate(chromeOpacity, 0, fadeChrome)
    if (originRef.current.fadeContent) void animate(bodyOpacity, 0, fadeChrome)
    // Hide overflow before the frame shrinks, or a scrollbar flashes until the
    // card settles. The scrolled content is held in place with a transform,
    // then eased back to the top with the shrink. Animating scrollTop itself
    // jumps, because the browser clamps it as the page gets shorter.
    const scroller = scrollRef.current
    if (scroller) scroller.style.overflow = 'hidden'
    const scrolled = scroller?.scrollTop ?? 0
    const scrollBack =
      scroller && scrolled > 0
        ? (() => {
            const shiftEl = scroller.querySelector('.event-expand-shift')
            // Apply the offset before paint, or the top of the page flashes
            // for a frame when scrollTop is cleared.
            if (shiftEl instanceof HTMLElement) {
              shiftEl.style.transform = `translateY(${-scrolled}px)`
            }
            scroller.scrollTop = 0
            contentShift.set(-scrolled)
            return animate(contentShift, 0, motion)
          })()
        : null
    const frame = playFrame(exit, motion)
    // The deck card is already underneath and matches this frame, so unmount
    // as soon as the spring looks done. Calendar blocks have no matching
    // preview, so those fade out across the shrink instead of popping.
    const reveal = originRef.current.fadeContent
      ? animate(opacity, 0, {
          duration: prefersReducedMotion() ? 0.01 : 0.22,
          ease: 'easeIn',
        })
      : null
    if (scrollBack) playback.current.push(scrollBack)
    if (reveal) playback.current.push(reveal)
    void Promise.all([frame, scrollBack ?? Promise.resolve(true), reveal ?? Promise.resolve(true)]).then(
      ([finished]) => {
        if (finished) onExitedRef.current()
      },
    )
  }

  const fly = async (direction: 'left' | 'right') => {
    if (phase.current === 'exit' || phase.current === 'fly') return
    const swipe = onSwipeRef.current
    if (!swipe) return
    phase.current = 'fly'
    setLeaving(true)
    setInteractive(false)
    momentum.current = null
    onFlyStartRef.current?.()
    stopPlayback()
    generation.current += 1
    const targetX = direction === 'right' ? window.innerWidth + 80 : -window.innerWidth - 80
    const travel = prefersReducedMotion()
      ? { duration: 0.01 }
      : { duration: 0.22, ease: 'easeOut' as const }
    try {
      await Promise.all([animate(x, targetX, travel), animate(opacity, 0, travel)])
      await swipe(direction)
      onExitedRef.current()
    } catch {
      phase.current = 'open'
      setLeaving(false)
      setInteractive(true)
      onFlyCancelRef.current?.()
      const spring = prefersReducedMotion()
        ? { duration: 0.01 }
        : { type: 'spring' as const, stiffness: 500, damping: 34 }
      await Promise.all([animate(x, 0, spring), animate(opacity, 1, spring)])
    }
  }

  useEffect(() => {
    const main = document.querySelector('.app-main')
    const previous = main instanceof HTMLElement ? main.style.overflow : ''
    if (main instanceof HTMLElement) {
      main.style.overflow = 'hidden'
      // The tab bar sits outside this region and stays clickable.
      main.inert = true
    }
    closeRef.current?.focus({ preventScroll: true })
    const reduce = prefersReducedMotion()
    void animate(chromeOpacity, 1, { duration: reduce ? 0.01 : 0.22, delay: reduce ? 0 : 0.06 })
    if (originRef.current.fadeContent) {
      void animate(bodyOpacity, 1, { duration: reduce ? 0.01 : 0.24, delay: reduce ? 0 : 0.08 })
    }
    let cancelled = false
    void playFrame(fullscreenTarget(originRef.current.imageHeight)).then((finished) => {
      if (cancelled || !finished || phase.current !== 'opening') return
      phase.current = 'open'
      onOpenedRef.current?.()
      setInteractive(true)
    })
    const onResize = () => {
      if (phase.current !== 'opening' && phase.current !== 'open') return
      void playFrame(fullscreenTarget(originRef.current.imageHeight)).then((finished) => {
        if (!finished || phase.current !== 'opening') return
        phase.current = 'open'
        onOpenedRef.current?.()
        setInteractive(true)
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      generation.current += 1
      stopPlayback()
      momentum.current = null
      window.removeEventListener('resize', onResize)
      if (main instanceof HTMLElement) {
        main.style.overflow = previous
        main.inert = false
      }
    }
    // Motion values and playFrame are stable for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        beginClose()
      } else if (e.key === 'ArrowDown' && (scrollRef.current?.scrollTop ?? 0) <= 1) {
        e.preventDefault()
        beginClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // beginClose and fly close over the latest refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sheet = sheetRef.current
    const scroller = scrollRef.current
    if (!sheet || !scroller || !interactive) return

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let lastY = 0
    let lastT = 0
    let vy = 0
    let lock: 'pan' | null = null
    let scrollTopAtStart = 0

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (target instanceof Element && target.closest('button, a, input, textarea, select')) return
      momentum.current = null
      pointerId = event.pointerId
      startX = event.clientX
      startY = lastY = event.clientY
      lastT = event.timeStamp
      vy = 0
      lock = null
      scrollTopAtStart = scroller.scrollTop
      try {
        sheet.setPointerCapture(event.pointerId)
      } catch {
        // Capture fails for pointers the browser doesn't consider active. Events
        // dispatched on the sheet still reach this listener.
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      const dx = event.clientX - startX
      const dy = event.clientY - startY
      const dt = Math.max(1, event.timeStamp - lastT)
      vy = (event.clientY - lastY) / dt
      lastY = event.clientY
      lastT = event.timeStamp

      // Sideways movement never passes or likes. That only happens from the buttons.
      if (!lock && Math.hypot(dx, dy) > 8) lock = 'pan'
      if (lock === 'pan') {
        const next = scrollTopAtStart - dy
        if (next < 0) {
          scroller.scrollTop = 0
          y.set(-next)
        } else {
          y.set(0)
          scroller.scrollTop = next
        }
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      pointerId = null
      const pull = y.get()
      const ended = lock
      lock = null
      if (pull > 72 && (pull > COLLAPSE_DISTANCE || vy > COLLAPSE_FLICK)) {
        beginClose()
        return
      }
      if (pull > 0) {
        const spring = { type: 'spring' as const, stiffness: 500, damping: 36 }
        void animate(y, 0, prefersReducedMotion() ? { duration: 0.01 } : spring)
        return
      }
      if (ended === 'pan' && Math.abs(vy) > 0.05) {
        let vel = -vy
        let prev = performance.now()
        const tick = (now: number) => {
          if (momentum.current !== tick) return
          const step = Math.min(32, now - prev)
          prev = now
          scroller.scrollTop += vel * step
          vel *= Math.pow(0.92, step / 16)
          if (Math.abs(vel) > 0.02) requestAnimationFrame(tick)
        }
        momentum.current = tick
        requestAnimationFrame(tick)
      }
    }

    sheet.addEventListener('pointerdown', onPointerDown)
    sheet.addEventListener('pointermove', onPointerMove)
    sheet.addEventListener('pointerup', onPointerUp)
    sheet.addEventListener('pointercancel', onPointerUp)
    const blockTouchScroll = (event: TouchEvent) => {
      if (pointerId !== null) event.preventDefault()
    }
    sheet.addEventListener('touchmove', blockTouchScroll, { passive: false })
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown)
      sheet.removeEventListener('pointermove', onPointerMove)
      sheet.removeEventListener('pointerup', onPointerUp)
      sheet.removeEventListener('pointercancel', onPointerUp)
      sheet.removeEventListener('touchmove', blockTouchScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  const gcal = googleCalendarUrl(event)
  const appleCal = appleCalendarUrl(event)
  const pageUrl = eventPageUrl(event)
  const address = event.address?.trim()
  const showAddress = Boolean(address && address !== event.location.trim())

  const share = async () => {
    setShareMessage('')
    setShareMessage(SHARE_MESSAGES[await shareEvent(event)])
  }

  return createPortal(
    <motion.div
      ref={sheetRef}
      className={leaving ? 'event-expand is-closing' : 'event-expand'}
      role="dialog"
      aria-modal="false"
      aria-labelledby="event-expand-title"
      style={{ top, left, width, height, x, y, rotate, opacity, borderRadius }}
    >
      <motion.button
        ref={closeRef}
        type="button"
        className="event-expand-close"
        style={{ opacity: chromeOpacity }}
        onClick={beginClose}
        disabled={leaving}
        aria-label="Close details"
      >
        <Chevron dir="down" />
      </motion.button>
      <div ref={scrollRef} className="event-expand-scroll">
        <motion.div className="event-expand-shift" style={{ y: contentShift }}>
        <motion.div className="event-expand-hero" style={{ height: heroHeight }}>
          <img src={event.image_url} alt="" draggable={false} />
          <div className="image-gradient" />
          {origin.fadeContent ? null : (
            <motion.div className="card-details-btn event-expand-up" style={{ opacity: upChevronOpacity }} aria-hidden>
              <Chevron dir="up" />
            </motion.div>
          )}
          {showDeckNav ? (
            <motion.div className="image-nav event-expand-nav" style={{ opacity: deckNavOpacity }} aria-hidden>
              <span className="image-nav-btn left">
                <span className="image-nav-glyph">‹</span>
              </span>
              <span className="image-nav-btn right">
                <span className="image-nav-glyph">›</span>
              </span>
            </motion.div>
          ) : null}
        </motion.div>
        <motion.div
          className={onSwipe ? 'event-expand-body has-actions' : 'event-expand-body'}
          style={{ opacity: bodyOpacity }}
        >
          <EventBadges event={event} />
          <h2 id="event-expand-title" className="event-expand-title">
            {event.title}
          </h2>
          <p>{formatDateTime12h(event.starts_at)}</p>
          <p>{event.location}</p>
          <p>{formatPrice(event.cost)}</p>
          <div className="event-expand-desc">
            <motion.p className="description" style={{ opacity: chromeOpacity }}>
              {event.description}
            </motion.p>
            <motion.p
              className="description description-preview"
              style={{ opacity: deckNavOpacity }}
              aria-hidden
            >
              {event.description}
            </motion.p>
          </div>
          <motion.div className="event-expand-extra" style={{ opacity: chromeOpacity }}>
          {showAddress ? (
            <p>
              <strong>Address:</strong> {address}
            </p>
          ) : null}
          <div className="modal-calendar-actions">
            {pageUrl ? (
              <a className="btn btn-primary modal-cal-btn" href={pageUrl} target="_blank" rel="noopener noreferrer">
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
          <div className="modal-calendar-actions">
            <a className="btn btn-secondary modal-cal-btn" href={gcal} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar
            </a>
            <a
              className="btn btn-secondary modal-cal-btn"
              href={appleCal}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Apple Calendar
            </a>
          </div>
          </motion.div>
        </motion.div>
        </motion.div>
      </div>
      {onSwipe ? (
        <motion.div className="event-expand-actions" style={{ opacity: chromeOpacity }}>
          <button
            type="button"
            className="expand-action nope"
            onClick={() => void fly('left')}
            disabled={leaving}
            aria-label="Pass"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="expand-action like"
            onClick={() => void fly('right')}
            disabled={leaving}
            aria-label="Like"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M12 20s-7-4.35-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.65-7 9-7 9z"
                fill="currentColor"
              />
            </svg>
          </button>
        </motion.div>
      ) : null}
    </motion.div>,
    document.body,
  )
}
