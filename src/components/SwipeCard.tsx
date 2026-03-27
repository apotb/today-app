import { motion, useMotionValue, useTransform } from 'framer-motion'
import type { EventItem } from '../types/models'
import { formatDateTime12h } from '../lib/format'

type Props = {
  event: EventItem
  onSwipe: (direction: 'left' | 'right') => void
}

const formatPrice = (cost: number | null) => (cost && cost > 0 ? `$${cost}` : 'Free')

const SWIPE_THRESHOLD = 120

export function SwipeCard({ event, onSwipe }: Props) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10])
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-20, -SWIPE_THRESHOLD], [0, 1])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipe('right')
      return
    }
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipe('left')
    }
  }

  return (
    <motion.article
      className="swipe-card"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      initial={{ opacity: 0.5, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: 200 }}
      transition={{ type: 'spring', stiffness: 250, damping: 22 }}
    >
      <motion.div className="swipe-badge like" style={{ opacity: likeOpacity }}>
        LIKE
      </motion.div>
      <motion.div className="swipe-badge nope" style={{ opacity: nopeOpacity }}>
        NOPE
      </motion.div>
      <img src={event.image_url} alt={event.title} className="card-image" />
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
