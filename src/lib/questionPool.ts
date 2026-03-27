import { CATEGORY_OPTIONS, type EventCategory, type QuestionItem } from '../types/models'

const SHUFFLE_SEED_MULTIPLIER = 9973

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed)
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}


function buildQuestionsForCategory(category: EventCategory, categoryLabel: string): QuestionItem[] {
  const catSlug = category.replace(/-/g, '')
  const stemA = 'Would you be interested in'
  const stemB = 'Would you enjoy'
  const stemC = 'Sound appealing:'
  const objectsBatch1 = [
    { o: `a ${categoryLabel.toLowerCase()} experience this week`, tags: ['weekend-plans'] },
    { o: `something casual in the ${categoryLabel.toLowerCase()} space tonight`, tags: ['spontaneous'] },
    { o: `a ticketed ${categoryLabel.toLowerCase()} happening soon`, tags: ['ticketed'] },
    { o: `an outdoor twist on ${categoryLabel.toLowerCase()} if your calendar allows`, tags: ['outdoor-preference'] },
    { o: `a small-group ${categoryLabel.toLowerCase()} meetup`, tags: ['intimate', 'social-small'] },
    { o: `a larger ${categoryLabel.toLowerCase()} event with a crowd`, tags: ['big-energy', 'social-large'] },
    { o: `a beginner-friendly ${categoryLabel.toLowerCase()} option`, tags: ['beginner-friendly'] },
    { o: `a more advanced ${categoryLabel.toLowerCase()} session`, tags: ['advanced'] },
    { o: `${categoryLabel.toLowerCase()} paired with food or drinks nearby`, tags: ['food-nearby'] },
    { o: `a free ${categoryLabel.toLowerCase()} community activity`, tags: ['free-tier'] },
    { o: `a paid ${categoryLabel.toLowerCase()} experience that feels worth it`, tags: ['premium-experience'] },
    { o: `something family-oriented around ${categoryLabel.toLowerCase()}`, tags: ['family-oriented'] },
    { o: `a late-night ${categoryLabel.toLowerCase()} plan`, tags: ['late-night'] },
    { o: `an early morning ${categoryLabel.toLowerCase()} option`, tags: ['early-start'] },
    { o: `a hands-on workshop vibe for ${categoryLabel.toLowerCase()}`, tags: ['hands-on'] },
  ]
  const objectsBatch2 = [
    { o: `a pop-up style ${categoryLabel.toLowerCase()} activation`, tags: ['popup'] },
    { o: `a walking tour flavor of ${categoryLabel.toLowerCase()}`, tags: ['walking-experience'] },
    { o: `a ${categoryLabel.toLowerCase()} event with live Q&A`, tags: ['interactive'] },
    { o: `a short 60-minute ${categoryLabel.toLowerCase()} block`, tags: ['time-boxed'] },
    { o: `a half-day ${categoryLabel.toLowerCase()} immersion`, tags: ['deep-dive'] },
    { o: `a ${categoryLabel.toLowerCase()} thing you could invite a friend to`, tags: ['plus-one'] },
    { o: `a low-key ${categoryLabel.toLowerCase()} hang`, tags: ['low-key'] },
    { o: `a high-energy ${categoryLabel.toLowerCase()} moment`, tags: ['high-energy'] },
    { o: `${categoryLabel.toLowerCase()} with photography-friendly visuals`, tags: ['instagrammable'] },
    { o: `${categoryLabel.toLowerCase()} that mixes indoor and outdoor`, tags: ['hybrid-venue'] },
    { o: `a local favorite in ${categoryLabel.toLowerCase()}`, tags: ['local-favorite'] },
    { o: `trying ${categoryLabel.toLowerCase()} somewhere new to you`, tags: ['novelty'] },
    { o: `${categoryLabel.toLowerCase()} with a philanthropic angle`, tags: ['impact'] },
    { o: `${categoryLabel.toLowerCase()} focused on learning something new`, tags: ['curiosity'] },
    { o: `${categoryLabel.toLowerCase()} with structured networking`, tags: ['structured-mingle'] },
    { o: `${categoryLabel.toLowerCase()} that feels relaxed and social`, tags: ['chill-social'] },
    { o: `a themed ${categoryLabel.toLowerCase()} night`, tags: ['themed-night'] },
    { o: `${categoryLabel.toLowerCase()} that could end with dessert nearby`, tags: ['after-glow'] },
  ]
  const stems = [stemA, stemB, stemC]
  const pool: QuestionItem[] = []
  let idx = 0
  for (const { o, tags } of [...objectsBatch1, ...objectsBatch2]) {
    const stem = stems[idx % stems.length]
    const allTags = Array.from(new Set([...tags, catSlug]))
    pool.push({
      id: `q-${category}-${idx}`,
      prompt: `${stem} ${o}?`,
      categories: [category],
      tags: allTags,
    })
    idx += 1
  }
  return pool
}

function crossCategoryQuestions(): QuestionItem[] {
  const pairs: Array<[EventCategory, EventCategory, string, string[]]> = [
    ['food-drink', 'music-nightlife', 'dinner and a show', ['combo-night', 'date-vibes']],
    ['outdoor-nature', 'wellness-self-care', 'movement outside', ['outdoor-wellness']],
    ['tech-ai', 'entrepreneurship-startups', 'a builder meetup', ['founders', 'builders']],
    ['arts-culture', 'film-media', 'opening night energy', ['culture-night']],
    ['sports-fitness', 'social-meetups', 'a social league game', ['rec-sports']],
    ['volunteering-community', 'family-friendly', 'a family volunteer day', ['service-family']],
    ['markets', 'food-drink', 'a night market crawl', ['night-market']],
    ['learning-workshops', 'networking-professional', 'a career skills session', ['upskill']],
    ['gaming-esports', 'social-meetups', 'a casual gaming hangout', ['lan-vibes']],
    ['comedy-improv', 'music-nightlife', 'a variety show night', ['variety-show']],
    ['travel-exploration', 'outdoor-nature', 'a local day-trip vibe', ['day-trip']],
    ['fashion-popups', 'markets', 'a pop-up shopping stroll', ['retail-event']],
    ['festivals-fairs', 'family-friendly', 'a fair with rides and booths', ['fair-day']],
    ['dating-singles', 'social-meetups', 'a low-pressure mixer', ['mixer']],
    ['wellness-self-care', 'arts-culture', 'a mindful creative class', ['mindful-create']],
    ['finance-business', 'entrepreneurship-startups', 'a startup finance chat', ['startup-finance']],
    ['holidays-seasonal', 'festivals-fairs', 'a seasonal celebration', ['seasonal']],
    ['religious-spiritual', 'volunteering-community', 'a community gathering', ['gathering']],
    ['activism-politics', 'social-meetups', 'a civic meetup', ['civic']],
    ['travel-exploration', 'arts-culture', 'touristy local highlights', ['sightseeing']],
  ]
  const out: QuestionItem[] = []
  pairs.forEach(([a, b, label, tags], i) => {
    out.push({
      id: `q-cross-${i}`,
      prompt: `Would you be open to ${label} that blends your interests?`,
      categories: [a, b],
      tags,
    })
  })
  return out
}

/** Full screening pool (25+ per category via templates + cross-category) */
export const QUESTION_POOL: QuestionItem[] = [
  ...CATEGORY_OPTIONS.flatMap((c) => buildQuestionsForCategory(c.id, c.name)),
  ...crossCategoryQuestions(),
]

export type AnswerSoFar = {
  questionId: string
  answer: boolean
  categories: EventCategory[]
  tags: string[]
}

function tagBoostFromAnswers(answers: AnswerSoFar[]) {
  const boosted = new Set<string>()
  for (const a of answers) {
    if (a.answer) {
      for (const t of a.tags) boosted.add(t)
    }
  }
  return boosted
}

export function pickNextQuestion(
  remaining: QuestionItem[],
  selectedCategories: EventCategory[],
  answersSoFar: AnswerSoFar[],
): QuestionItem | null {
  if (remaining.length === 0) return null
  const boosted = tagBoostFromAnswers(answersSoFar)
  const weighted = remaining.map((q) => {
    let w = 0.35
    const catMatch = q.categories.filter((c) => selectedCategories.includes(c)).length
    if (catMatch > 0) w += catMatch * 2.8
    for (const t of q.tags) {
      if (boosted.has(t)) w += 2.08
    }
    if (selectedCategories.length >= 3 && catMatch === 0) w += 0.85
    w += Math.random() * 0.35
    return { q, w }
  })
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const item of weighted) {
    r -= item.w
    if (r <= 0) return item.q
  }
  return weighted[weighted.length - 1].q
}

export function buildInitialRemaining(selectedCategories: EventCategory[], seed: number): QuestionItem[] {
  const primary = QUESTION_POOL.filter((q) => q.categories.some((c) => selectedCategories.includes(c)))
  const filler = QUESTION_POOL.filter((q) => !q.categories.some((c) => selectedCategories.includes(c)))
  const explore = seededShuffle(filler, seed + SHUFFLE_SEED_MULTIPLIER).slice(
    0,
    Math.min(45, Math.ceil(filler.length * 0.12)),
  )
  return seededShuffle([...primary, ...explore], seed)
}
