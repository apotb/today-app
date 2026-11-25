import type { EventCategory, EventItem } from '../types/models'

/**
 * Quick "vibe" filters shown as chips above the Home swipe deck.
 *
 * - Category vibes (group, nightlife, active, chill) match an event whose category is in
 *   their list. Selecting several widens the feed: an event matching ANY of them shows.
 * - Constraint vibes (free, tonight) narrow the feed: an event must match ALL of them.
 *
 * Event categories come from Ticketmaster's broad segments (music, sports, arts, family,
 * ...), so category vibes get more precise as better event sources are added.
 */
export type VibeId = 'group' | 'nightlife' | 'active' | 'chill' | 'free' | 'tonight'

type CategoryVibe = {
  id: VibeId
  label: string
  icon: string
  kind: 'category'
  categories: EventCategory[]
}

type ConstraintVibe = {
  id: VibeId
  label: string
  icon: string
  kind: 'constraint'
  matches: (event: EventItem, nowMs: number) => boolean
}

export type Vibe = CategoryVibe | ConstraintVibe

/** Events starting before 4 AM count as "tonight" (late shows, after-parties). */
const TONIGHT_ENDS_HOUR = 4

/** End of "tonight" in local time: the next 4:00 AM (today's, if it's still before 4 AM). */
export const tonightCutoffMs = (nowMs: number) => {
  const cutoff = new Date(nowMs)
  if (cutoff.getHours() >= TONIGHT_ENDS_HOUR) cutoff.setDate(cutoff.getDate() + 1)
  cutoff.setHours(TONIGHT_ENDS_HOUR, 0, 0, 0)
  return cutoff.getTime()
}

export const VIBES: Vibe[] = [
  {
    id: 'group',
    label: 'Group hangout',
    icon: '👥',
    kind: 'category',
    categories: [
      'festivals-fairs',
      'markets',
      'sports-fitness',
      'comedy-improv',
      'social-meetups',
      'food-drink',
      'gaming-esports',
      'holidays-seasonal',
    ],
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    icon: '🌙',
    kind: 'category',
    categories: ['music-nightlife', 'comedy-improv', 'dating-singles'],
  },
  {
    id: 'active',
    label: 'Active',
    icon: '🏃',
    kind: 'category',
    categories: ['sports-fitness', 'outdoor-nature', 'wellness-self-care'],
  },
  {
    id: 'chill',
    label: 'Chill',
    icon: '😌',
    kind: 'category',
    categories: [
      'arts-culture',
      'film-media',
      'food-drink',
      'markets',
      'learning-workshops',
      'wellness-self-care',
    ],
  },
  {
    id: 'free',
    label: 'Free',
    icon: '💸',
    kind: 'constraint',
    // Only an explicit 0 is free; null means the price wasn't listed.
    matches: (event) => event.cost === 0,
  },
  {
    id: 'tonight',
    label: 'Tonight',
    icon: '⏰',
    kind: 'constraint',
    matches: (event, nowMs) => new Date(event.starts_at).getTime() < tonightCutoffMs(nowMs),
  },
]

const VIBES_BY_ID = new Map(VIBES.map((v) => [v.id, v]))

/** Keeps the events that match the selected vibes. No selection = everything. */
export function filterByVibes(events: EventItem[], selected: VibeId[], nowMs = Date.now()) {
  const chosen = selected.map((id) => VIBES_BY_ID.get(id)).filter((v): v is Vibe => Boolean(v))
  const categoryVibes = chosen.filter((v): v is CategoryVibe => v.kind === 'category')
  const constraints = chosen.filter((v): v is ConstraintVibe => v.kind === 'constraint')
  const allowedCategories = new Set(categoryVibes.flatMap((v) => v.categories))

  return events.filter(
    (event) =>
      (categoryVibes.length === 0 || allowedCategories.has(event.category)) &&
      constraints.every((v) => v.matches(event, nowMs)),
  )
}

const STORAGE_KEY = 'today.home.vibes'

/** The chips the user had on last time (so their filter survives a reload). */
export const getStoredVibes = (): VibeId[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is VibeId => VIBES_BY_ID.has(id)) : []
  } catch {
    return []
  }
}

export const saveStoredVibes = (selected: VibeId[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected))
  } catch {
    /* storage unavailable (private mode): the filter just won't persist */
  }
}
