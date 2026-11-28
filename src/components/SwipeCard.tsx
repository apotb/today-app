import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { motion, useAnimation, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import type { EventItem } from '../types/models'
import { formatDateTime12h, formatPrice } from '../lib/format'
import type { ExpandOrigin } from './EventExpandPage'
import { EventBadges } from './EventBadges'

type IntroHint = 'right' | 'left' | 'up' | null

type Props = {
  event: EventItem
  onSwipe: (direction: 'left' | 'right') => Promise<void> | void
  onOpenDetails?: (origin: ExpandOrigin) => void
  showDesktopNav?: boolean
  /** Fills viewport height on Home (mobile deck layout). */
  deckLayout?: boolean
  /** Hide the card while its expanded page is opening or flying off. */
  concealed?: boolean
  /** Expanded details are open, so this card should ignore swipes and arrow keys. */
  detailsOpen?: boolean
  /** Play the one-shot swipe demo on this card. Input stays off until it finishes. */
  playIntro?: boolean
  /** Called only when the intro sequence finishes. Unmounting mid-sequence does not call this. */
  onIntroComplete?: () => void
}

const SWIPE_THRESHOLD = 120
const SWIPE_UP_THRESHOLD = 72

function ChevronUp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 14.5 12 8.5l6 6"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const nudgeSpring = { type: 'spring' as const, stiffness: 320, damping: 22 }
const nudgeReturn = { duration: 0.28, ease: 'easeOut' as const }

export function SwipeCard({
  event,
  onSwipe,
  onOpenDetails,
  showDesktopNav,
  deckLayout,
  concealed,
  detailsOpen,
  playIntro = false,
  onIntroComplete,
}: Props) {
  const articleRef = useRef<HTMLElement>(null)
  const onIntroCompleteRef = useRef(onIntroComplete)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const controls = useAnimation()
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10])
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-20, -SWIPE_THRESHOLD], [0, 1])
  const [animating, setAnimating] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const [introActive, setIntroActive] = useState(playIntro)
  const [introHint, setIntroHint] = useState<IntroHint>(null)

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete
  }, [onIntroComplete])

  useEffect(() => {
    if (!playIntro || !imageReady) return
    let cancelled = false
    const run = async () => {
      await wait(450)
      if (cancelled) return
      setIntroHint('right')
      await controls.start({
        x: 78,
        rotate: 5,
        transition: nudgeSpring,
      })
      await wait(1400)
      if (cancelled) return
      setIntroHint(null)
      await controls.start({ x: 0, rotate: 0, transition: nudgeReturn })
      await wait(400)
      if (cancelled) return
      setIntroHint('left')
      await controls.start({
        x: -78,
        rotate: -5,
        transition: nudgeSpring,
      })
      await wait(1400)
      if (cancelled) return
      setIntroHint(null)
      await controls.start({ x: 0, y: 0, rotate: 0, transition: nudgeReturn })
      await wait(400)
      if (cancelled) return
      setIntroHint('up')
      await controls.start({
        y: -52,
        x: 0,
        rotate: 0,
        transition: nudgeSpring,
      })
      await wait(1400)
      if (cancelled) return
      setIntroHint(null)
      await controls.start({ x: 0, y: 0, rotate: 0, transition: nudgeReturn })
      if (cancelled) return
      x.set(0)
      y.set(0)
      controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 })
      setIntroActive(false)
      onIntroCompleteRef.current?.()
    }
    void run()
    return () => {
      cancelled = true
      setIntroHint(null)
    }
  }, [playIntro, imageReady, controls, x, y])

  const triggerSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      if (animating || !imageReady || introActive) return
      setAnimating(true)
      const targetX = direction === 'right' ? 420 : -420
      const targetRotate = direction === 'right' ? 14 : -14
      try {
        await controls.start({
          x: targetX,
          y: 0,
          rotate: targetRotate,
          opacity: 0,
          transition: { duration: 0.22, ease: 'easeOut' },
        })
        await onSwipe(direction)
        // Do not reset motion state here: parent replaces this card by key — resetting snaps the
        // OLD event/image back visible for a frame before unmount (the “flash” users saw).
      } catch {
        x.set(0)
        y.set(0)
        await controls.start({
          x: 0,
          y: 0,
          rotate: 0,
          opacity: 1,
          transition: { duration: 0.2, ease: 'easeOut' },
        })
      } finally {
        setAnimating(false)
      }
    },
    [animating, imageReady, introActive, onSwipe, controls, x, y],
  )

  const openDetails = useCallback(() => {
    const el = articleRef.current
    if (!el || !imageReady || animating || introActive || !onOpenDetails) return
    const rect = el.getBoundingClientRect()
    const image = el.querySelector('.card-image-wrap')?.getBoundingClientRect()
    const origin: ExpandOrigin = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      radius: 18,
      imageHeight: image?.height ?? rect.height * 0.55,
      fadeContent: false,
    }
    // Paint the expanding page on top of this card before the drag snaps back.
    flushSync(() => onOpenDetails(origin))
  }, [animating, imageReady, introActive, onOpenDetails])

  // The card stays put under the page. Reset any leftover drag while it's hidden.
  useLayoutEffect(() => {
    if (!concealed) return
    x.set(0)
    y.set(0)
    controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 })
  }, [concealed, controls, x, y])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!imageReady || detailsOpen || introActive) return
    const ox = info.offset.x
    const oy = info.offset.y
    if (oy < -SWIPE_UP_THRESHOLD && Math.abs(oy) >= Math.abs(ox)) {
      openDetails()
      return
    }
    if (ox > SWIPE_THRESHOLD) {
      void triggerSwipe('right')
      return
    }
    if (ox < -SWIPE_THRESHOLD) {
      void triggerSwipe('left')
    }
  }

  useEffect(() => {
    if (!showDesktopNav || detailsOpen || introActive) return

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || target.isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        void triggerSwipe('left')
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        void triggerSwipe('right')
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        openDetails()
      }
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showDesktopNav, detailsOpen, introActive, openDetails, triggerSwipe])

  const inputLocked = animating || !imageReady || detailsOpen || introActive

  const cardClass = [
    deckLayout ? 'swipe-card home-deck-card' : 'swipe-card',
    concealed ? 'is-concealed' : '',
    introActive ? 'is-intro' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.article
      ref={articleRef}
      className={cardClass}
      style={{ x, y, rotate }}
      drag={inputLocked ? false : true}
      dragElastic={0.88}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={introActive ? undefined : { cursor: 'grabbing' }}
      initial={{ opacity: 1, scale: 1 }}
      animate={controls}
      exit={{ opacity: 0, x: 200 }}
      transition={{ type: 'spring', stiffness: 250, damping: 22 }}
    >
      <motion.div className="swipe-badge like" style={{ opacity: likeOpacity }}>
        LIKE
      </motion.div>
      <motion.div className="swipe-badge nope" style={{ opacity: nopeOpacity }}>
        NOPE
      </motion.div>
      <div className="card-image-wrap">
        {!imageReady ? (
          <div className="card-image-skeleton shimmer" aria-busy="true" aria-label="Loading image" />
        ) : null}
        <img
          key={`${event.id}:${event.image_url}`}
          src={event.image_url}
          alt={event.title}
          className="card-image"
          draggable={false}
          onDragStart={(dragEvent) => dragEvent.preventDefault()}
          style={{
            opacity: imageReady ? 1 : 0,
            visibility: imageReady ? 'visible' : 'hidden',
          }}
          decoding="async"
          fetchPriority="high"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
        <div className="image-gradient" />
        {onOpenDetails ? (
          <button
            type="button"
            className="card-details-btn"
            aria-label="Show details"
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            onClick={openDetails}
            disabled={introActive}
          >
            <ChevronUp />
          </button>
        ) : null}
        {showDesktopNav ? (
          <div className="image-nav" aria-hidden="false">
            <button
              type="button"
              className="image-nav-btn left"
              onClick={() => void triggerSwipe('left')}
              aria-label="Dislike (left arrow)"
              title="Dislike (←)"
              disabled={inputLocked}
            >
              <span className="image-nav-glyph" aria-hidden="true">
                ‹
              </span>
            </button>
            <button
              type="button"
              className="image-nav-btn right"
              onClick={() => void triggerSwipe('right')}
              aria-label="Like (right arrow)"
              title="Like (→)"
              disabled={inputLocked}
            >
              <span className="image-nav-glyph" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
        ) : null}
        {!deckLayout ? (
          showDesktopNav ? (
            <div className="swipe-hint">Use ← / → keys or click arrows · Swipe up for details</div>
          ) : (
            <div className="swipe-hint swipe-hint-mobile">Swipe up for details</div>
          )
        ) : null}
      </div>
      <div className="card-body" style={{ opacity: imageReady ? 1 : 0 }}>
        <EventBadges event={event} />
        <h2 className="card-title">{event.title}</h2>
        <p>{formatDateTime12h(event.starts_at)}</p>
        <p>{event.location}</p>
        <p>{formatPrice(event.cost)}</p>
        <p className="description description-preview">{event.description}</p>
      </div>
      {introHint === 'right' ? (
        <div className="tutorial-bubble tutorial-bubble-like" role="status">
          Swipe right if you&apos;re interested
        </div>
      ) : null}
      {introHint === 'left' ? (
        <div className="tutorial-bubble tutorial-bubble-nope" role="status">
          Swipe left if you&apos;re not
        </div>
      ) : null}
      {introHint === 'up' ? (
        <div className="tutorial-bubble tutorial-bubble-details" role="status">
          Swipe up for details
        </div>
      ) : null}
    </motion.article>
  )
}
