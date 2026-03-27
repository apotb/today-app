import { useEffect, useState } from 'react'
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion'
import type { EventItem } from '../types/models'
import { formatDateTime12h } from '../lib/format'

type Props = {
  event: EventItem
  onSwipe: (direction: 'left' | 'right') => Promise<void> | void
  showDesktopNav?: boolean
}

const formatPrice = (cost: number | null) => (cost && cost > 0 ? `$${cost}` : 'Free')

const SWIPE_THRESHOLD = 120

export function SwipeCard({ event, onSwipe, showDesktopNav }: Props) {
  const x = useMotionValue(0)
  const controls = useAnimation()
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10])
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-20, -SWIPE_THRESHOLD], [0, 1])
  const [animating, setAnimating] = useState(false)

  const triggerSwipe = async (direction: 'left' | 'right') => {
    if (animating) return
    setAnimating(true)
    const targetX = direction === 'right' ? 420 : -420
    const targetRotate = direction === 'right' ? 14 : -14
    await controls.start({
      x: targetX,
      rotate: targetRotate,
      opacity: 0,
      transition: { duration: 0.22, ease: 'easeOut' },
    })
    await onSwipe(direction)
    x.set(0)
    controls.set({ x: 0, rotate: 0, opacity: 1 })
    setAnimating(false)
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      void triggerSwipe('right')
      return
    }
    if (info.offset.x < -SWIPE_THRESHOLD) {
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
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showDesktopNav, animating])

  return (
    <motion.article
      className="swipe-card"
      style={{ x, rotate }}
      drag={animating ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      initial={{ opacity: 0.5, scale: 0.97 }}
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
        <img src={event.image_url} alt={event.title} className="card-image" />
        <div className="image-gradient" />
        {showDesktopNav ? (
          <div className="image-nav" aria-hidden="false">
            <button
              type="button"
              className="image-nav-btn left"
              onClick={() => void triggerSwipe('left')}
              aria-label="Dislike (left arrow)"
              title="Dislike (←)"
              disabled={animating}
            >
              ‹
            </button>
            <button
              type="button"
              className="image-nav-btn right"
              onClick={() => void triggerSwipe('right')}
              aria-label="Like (right arrow)"
              title="Like (→)"
              disabled={animating}
            >
              ›
            </button>
          </div>
        ) : null}
        {showDesktopNav ? (
          <div className="swipe-hint">Use ← / → keys or click arrows</div>
        ) : null}
      </div>
      <div className="card-body">
        <p className="chip">{event.category}</p>
        <h2>{event.title}</h2>
        <p>{formatDateTime12h(event.starts_at)}</p>
        <p>{event.location}</p>
        <p>{formatPrice(event.cost)}</p>
        <p className="description">{event.description}</p>
      </div>
    </motion.article>
  )
}
