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

/** Short lines that read as yes/no questions after the fixed label "Would you attend:" */
const PHRASES: Record<EventCategory, string[]> = {
  'sports-fitness': [
    'A weekend pickup game?',
    'A structured fitness class?',
    'An intro climbing or bouldering session?',
    'A social run or group ride?',
    'A rec-league game night?',
    'A recovery-focused mobility class?',
    'A high-intensity interval workout?',
    'An outdoor skills or coaching clinic?',
  ],
  'arts-culture': [
    'An evening at the museum?',
    'A gallery opening with drinks?',
    'A live theater performance?',
    'A hands-on pottery or studio class?',
    'A walking art or architecture tour?',
    'A small-room jazz or classical set?',
    'A mural or street-art stroll?',
    'A curator-led talk or tour?',
  ],
  'music-nightlife': [
    'A K-pop or big-room DJ night?',
    'An intimate singer-songwriter set?',
    'A late-night dance floor?',
    'A karaoke or open-mic night?',
    'An outdoor summer concert?',
    'A vinyl listening party?',
    'A tribute or cover-band show?',
    'A festival headline act?',
  ],
  'food-drink': [
    'A chef-led tasting menu?',
    'A food-hall crawl with friends?',
    'A wine or cocktail pairing?',
    'A hands-on cooking class?',
    'A daytime bakery or brunch pop-up?',
    'A night-market-style sampler?',
    'A chef table or supper club?',
    'A casual new-spot trial run?',
  ],
  'volunteering-community': [
    'A half-day park or trail cleanup?',
    'A neighborhood mutual-aid shift?',
    'A mentorship or tutoring block?',
    'A build day with tools and lunch?',
    'A charity fun-run or walk?',
    'A community garden session?',
    'A donation sorting or packing shift?',
    'A civic info session or clinic?',
  ],
  'social-meetups': [
    'A casual “no agenda” hangout?',
    'A hobby-centric mixer?',
    'A board-game or trivia night?',
    'A newcomer welcome meetup?',
    'A themed dress-up social?',
    'A language-practice circle?',
    'A walking group that ends at coffee?',
    'A co-working social block?',
  ],
  'dating-singles': [
    'A low-pressure singles mixer?',
    'A structured speed-meeting round?',
    'An activity-first date event?',
    'A small-group dinner for singles?',
    'A daylight walk-and-chat meetup?',
    'A playful icebreaker games night?',
  ],
  'family-friendly': [
    'A kid-focused science or maker demo?',
    'A pumpkin patch or fair day?',
    'A storytime or puppet show?',
    'A splash pad or pool morning?',
    'A minor-league or youth game?',
    'A hands-on craft table for kids?',
  ],
  'outdoor-nature': [
    'A guided sunrise hike?',
    'A birding or nature walk?',
    'A paddle or kayak outing?',
    'A stargazing evening?',
    'A beginner-friendly trail day?',
    'A botanical garden wander?',
  ],
  'wellness-self-care': [
    'A restorative yoga class?',
    'A guided meditation block?',
    'A sauna-cold-plunge cycle?',
    'A breathwork or sound bath?',
    'A nutrition or sleep workshop?',
    'A stretch and mobility clinic?',
  ],
  'learning-workshops': [
    'A beginner-friendly skills workshop?',
    'A lecture with Q&A?',
    'A weekend intensive bootcamp?',
    'A language crash-course session?',
    'A public-library author talk?',
  ],
  'networking-professional': [
    'An industry happy hour?',
    'A roundtable with name tags?',
    'A mentor office-hours style meetup?',
    'A casual coworking mingle?',
    'A speaker panel with networking?',
  ],
  'entrepreneurship-startups': [
    'A founder coffee meetup?',
    'A pitch practice night?',
    'An accelerator info session?',
    'A small-room investor office hours?',
    'A builder demo day?',
  ],
  'finance-business': [
    'An investing basics seminar?',
    'A personal-finance Q&A?',
    'A real-estate trends talk?',
    'A small-business tax clinic?',
  ],
  'gaming-esports': [
    'A casual LAN or co-op night?',
    'A fighting-game bracket?',
    'A tabletop RPG one-shot?',
    'A VR arcade hangout?',
    'A streaming watch party?',
  ],
  'tech-ai': [
    'A hackathon for beginners?',
    'An AI tooling lab?',
    'A lightning-talk meetup?',
    'A hardware or robot demo night?',
    'An open-source contribution jam?',
  ],
  'film-media': [
    'An indie film screening?',
    'A midnight cult classic?',
    'A filmmaker Q&A?',
    'A short-film festival block?',
    'A podcast live recording?',
  ],
  'fashion-popups': [
    'A designer sample sale?',
    'A weekend fashion pop-up?',
    'A vintage market stall crawl?',
    'A jewelry trunk show?',
  ],
  'comedy-improv': [
    'A stand-up showcase?',
    'An improv jam night?',
    'An open-mic comedy slot?',
    'A sketch or variety show?',
  ],
  'festivals-fairs': [
    'A county fair with rides?',
    'A street closure festival?',
    'A craft fair booth stroll?',
    'A cultural heritage celebration?',
  ],
  'holidays-seasonal': [
    'A tree-lighting or parade?',
    'A seasonal market night?',
    'A Halloween or costume crawl?',
    'A summer kickoff block party?',
  ],
  markets: [
    'A farmers market morning?',
    'A flea-market treasure hunt?',
    'A night market food crawl?',
    'A holiday craft market?',
  ],
  'religious-spiritual': [
    'A community worship gathering?',
    'A interfaith dialogue night?',
    'A retreat weekend intro session?',
    'A meditation with readings?',
  ],
  'activism-politics': [
    'A neighborhood canvass kickoff?',
    'A town-hall or issue forum?',
    'A peaceful rally or march?',
    'A voter-registration drive?',
  ],
  'travel-exploration': [
    'A day trip with a guide?',
    'A photo walk in a new city?',
    'A regional food or wine trail day?',
    'A scenic train or ferry outing?',
  ],
}

function buildQuestionsForCategory(category: EventCategory): QuestionItem[] {
  const catSlug = category.replace(/-/g, '')
  const phrases = PHRASES[category]
  return phrases.map((prompt, idx) => ({
    id: `q-${category}-${idx}`,
    prompt,
    categories: [category],
    tags: Array.from(new Set([catSlug, `tone-${idx % 6}`])),
  }))
}

function crossCategoryQuestions(): QuestionItem[] {
  const triples: Array<{
    a: EventCategory
    b: EventCategory
    prompt: string
    tags: string[]
  }> = [
    {
      a: 'food-drink',
      b: 'music-nightlife',
      prompt: 'A night that pairs dinner and a show?',
      tags: ['combo-night'],
    },
    {
      a: 'outdoor-nature',
      b: 'wellness-self-care',
      prompt: 'A mindful walk or easy hike?',
      tags: ['outdoor-wellness'],
    },
    {
      a: 'tech-ai',
      b: 'entrepreneurship-startups',
      prompt: 'A builder meetup with demos?',
      tags: ['founders'],
    },
    {
      a: 'arts-culture',
      b: 'film-media',
      prompt: 'An arthouse screening with discussion?',
      tags: ['culture-night'],
    },
    {
      a: 'sports-fitness',
      b: 'social-meetups',
      prompt: 'A friendly rec game with a social after?',
      tags: ['rec-sports'],
    },
    {
      a: 'volunteering-community',
      b: 'family-friendly',
      prompt: 'A family volunteer morning?',
      tags: ['service-family'],
    },
    {
      a: 'markets',
      b: 'food-drink',
      prompt: 'A night-market food stroll?',
      tags: ['night-market'],
    },
    {
      a: 'learning-workshops',
      b: 'networking-professional',
      prompt: 'A career-skills lunch-and-learn?',
      tags: ['upskill'],
    },
    {
      a: 'gaming-esports',
      b: 'social-meetups',
      prompt: 'A casual co-op gaming hangout?',
      tags: ['lan-vibes'],
    },
    {
      a: 'comedy-improv',
      b: 'music-nightlife',
      prompt: 'A variety night with comedy and music?',
      tags: ['variety-show'],
    },
    {
      a: 'travel-exploration',
      b: 'outdoor-nature',
      prompt: 'A guided local day-trip?',
      tags: ['day-trip'],
    },
    {
      a: 'fashion-popups',
      b: 'markets',
      prompt: 'A pop-up shopping stroll?',
      tags: ['retail-event'],
    },
    {
      a: 'festivals-fairs',
      b: 'family-friendly',
      prompt: 'A fair with rides and food stalls?',
      tags: ['fair-day'],
    },
    {
      a: 'dating-singles',
      b: 'social-meetups',
      prompt: 'A low-pressure singles mixer?',
      tags: ['mixer'],
    },
    {
      a: 'wellness-self-care',
      b: 'arts-culture',
      prompt: 'A mindful art or journaling workshop?',
      tags: ['mindful-create'],
    },
    {
      a: 'finance-business',
      b: 'entrepreneurship-startups',
      prompt: 'A startup finance fireside chat?',
      tags: ['startup-finance'],
    },
    {
      a: 'holidays-seasonal',
      b: 'festivals-fairs',
      prompt: 'A seasonal street festival?',
      tags: ['seasonal'],
    },
    {
      a: 'religious-spiritual',
      b: 'volunteering-community',
      prompt: 'A welcoming community gathering?',
      tags: ['gathering'],
    },
    {
      a: 'activism-politics',
      b: 'social-meetups',
      prompt: 'A civic meetup or issue salon?',
      tags: ['civic'],
    },
    {
      a: 'travel-exploration',
      b: 'arts-culture',
      prompt: 'A tourist-friendly highlights tour?',
      tags: ['sightseeing'],
    },
  ]
  return triples.map((t, i) => ({
    id: `q-cross-${i}`,
    prompt: t.prompt,
    categories: [t.a, t.b],
    tags: t.tags,
  }))
}

export const QUESTION_POOL: QuestionItem[] = [
  ...CATEGORY_OPTIONS.flatMap((c) => buildQuestionsForCategory(c.id)),
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
