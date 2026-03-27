import { useEffect, useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import type { EventItem } from '../types/models'
import { formatDateTime12h } from '../lib/format'

const DEMO_EVENT: EventItem = {
  id: 'tutorial-demo',
  title: 'Live music near you',
  description: 'This is just a sample — your real picks are next.',
  starts_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  ends_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  cost: null,
  image_url: 'https://picsum.photos/seed/today-tutorial-swipe/1200/675',
  category: 'music-nightlife',
  location: 'Downtown venue',
}

type Hint = 'right' | 'left' | null

type Props = {
  onComplete: () => void
}

export function SwipeTutorialOverlay({ onComplete }: Props) {
  const controls = useAnimation()
  const [hint, setHint] = useState<Hint>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const run = async () => {
      await new Promise((r) => setTimeout(r, 450))
      if (cancelled.current) return
      setHint('right')
      await controls.start({
        x: 78,
        rotate: 5,
        transition: { type: 'spring', stiffness: 320, damping: 22 },
      })
      await new Promise((r) => setTimeout(r, 1400))
      if (cancelled.current) return
      setHint(null)
      await controls.start({ x: 0, rotate: 0, transition: { duration: 0.28, ease: 'easeOut' } })
      await new Promise((r) => setTimeout(r, 400))
      if (cancelled.current) return
      setHint('left')
      await controls.start({
        x: -78,
        rotate: -5,
        transition: { type: 'spring', stiffness: 320, damping: 22 },
      })
      await new Promise((r) => setTimeout(r, 1400))
      if (cancelled.current) return
      setHint(null)
      await controls.start({ x: 0, rotate: 0, transition: { duration: 0.28, ease: 'easeOut' } })
    }
    void run()
    return () => {
      cancelled.current = true
    }
  }, [controls])

  const formatPrice = (cost: number | null) => (cost && cost > 0 ? `$${cost}` : 'Free')

  return (
    <div
      className="tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="tutorial-backdrop" aria-hidden="true" />
      <div className="tutorial-content">
        <p id="tutorial-title" className="tutorial-heading">
          How swiping works
        </p>
        <motion.article
          className="swipe-card tutorial-demo-card"
          initial={{ x: 0, rotate: 0 }}
          animate={controls}
        >
          {hint === 'right' ? (
            <div className="tutorial-bubble tutorial-bubble-like" role="status">
              Swipe right if you&apos;re interested
            </div>
          ) : null}
          {hint === 'left' ? (
            <div className="tutorial-bubble tutorial-bubble-nope" role="status">
              Swipe left if you&apos;re not
            </div>
          ) : null}
          <div className="card-image-wrap">
            <img src={DEMO_EVENT.image_url} alt="" className="card-image" />
            <div className="image-gradient" />
          </div>
          <div className="card-body">
            <p className="chip">{DEMO_EVENT.category}</p>
            <h2 className="card-title">{DEMO_EVENT.title}</h2>
            <p>{formatDateTime12h(DEMO_EVENT.starts_at)}</p>
            <p>{DEMO_EVENT.location}</p>
            <p>{formatPrice(DEMO_EVENT.cost)}</p>
            <p className="description description-preview">{DEMO_EVENT.description}</p>
          </div>
        </motion.article>
        <button type="button" className="btn btn-primary tutorial-dismiss" onClick={onComplete}>
          Got it — start exploring
        </button>
      </div>
    </div>
  )
}
