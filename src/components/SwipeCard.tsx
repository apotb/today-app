import { useCallback, useEffect, useState } from 'react'
import { motion, useAnimation, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import type { EventItem } from '../types/models'
import { formatDateTime12h } from '../lib/format'

type Props = {
  event: EventItem
  onSwipe: (direction: 'left' | 'right') => Promise<void> | void
  onOpenDetails?: () => void
  showDesktopNav?: boolean
  /** Fills viewport height on Home (mobile deck layout). */
  deckLayout?: boolean
}

const formatPrice = (cost: number | null) => (cost && cost > 0 ? `$${cost}` : 'Free')

const SWIPE_THRESHOLD = 120
const SWIPE_UP_THRESHOLD = 72

export function SwipeCard({ event, onSwipe, onOpenDetails, showDesktopNav, deckLayout }: Props) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const controls = useAnimation()
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10])
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-20, -SWIPE_THRESHOLD], [0, 1])
  const [animating, setAnimating] = useState(false)
  const [imageReady, setImageReady] = useState(false)

  const triggerSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      if (animating || !imageReady) return
      setAnimating(true)
      const targetX = direction === 'right' ? 420 : -420
      const targetRotate = direction === 'right' ? 14 : -14
      await controls.start({
        x: targetX,
        y: 0,
        rotate: targetRotate,
        opacity: 0,
        transition: { duration: 0.22, ease: 'easeOut' },
      })
      await onSwipe(direction)
      x.set(0)
      y.set(0)
      controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 })
      setAnimating(false)
    },
    [animating, imageReady, onSwipe, controls, x, y],
  )

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!imageReady) return
    const ox = info.offset.x
    const oy = info.offset.y
    if (oy < -SWIPE_UP_THRESHOLD && Math.abs(oy) >= Math.abs(ox)) {
      void Promise.resolve().then(() => {
        x.set(0)
        y.set(0)
        controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 })
      })
      onOpenDetails?.()
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
    if (!showDesktopNav) return

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
        if (imageReady) onOpenDetails?.()
      }
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showDesktopNav, onOpenDetails, imageReady, triggerSwipe])

  const cardClass = deckLayout ? 'swipe-card home-deck-card' : 'swipe-card'

  return (
    <motion.article
      className={cardClass}
      style={{ x, y, rotate }}
      drag={animating || !imageReady ? false : true}
      dragElastic={0.88}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
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
          src={event.image_url}
          alt={event.title}
          className="card-image"
          style={{ opacity: imageReady ? 1 : 0 }}
          decoding="async"
          fetchPriority="high"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
        <div className="image-gradient" />
        {showDesktopNav ? (
          <div className="image-nav" aria-hidden="false">
            <button
              type="button"
              className="image-nav-btn left"
              onClick={() => void triggerSwipe('left')}
              aria-label="Dislike (left arrow)"
              title="Dislike (←)"
              disabled={animating || !imageReady}
            >
              ‹
            </button>
            <button
              type="button"
              className="image-nav-btn right"
              onClick={() => void triggerSwipe('right')}
              aria-label="Like (right arrow)"
              title="Like (→)"
              disabled={animating || !imageReady}
            >
              ›
            </button>
          </div>
        ) : null}
        {showDesktopNav ? (
          <div className="swipe-hint">Use ← / → keys or click arrows · Swipe up for details</div>
        ) : (
          <div className="swipe-hint swipe-hint-mobile">Swipe up for details</div>
        )}
      </div>
      <div className="card-body" style={{ opacity: imageReady ? 1 : 0 }}>
        <p className="chip">{event.category}</p>
        <h2 className="card-title">{event.title}</h2>
        <p>{formatDateTime12h(event.starts_at)}</p>
        <p>{event.location}</p>
        <p>{formatPrice(event.cost)}</p>
        <p className="description description-preview">{event.description}</p>
      </div>
    </motion.article>
  )
}
