import { CATEGORY_OPTIONS, type EventCategory } from '../types/models'

export type CategoryGroup = {
  label: string
  ids: readonly EventCategory[]
}

export const CATEGORY_GROUPS = [
  {
    label: 'Music, food and nights',
    ids: [
      'music-nightlife',
      'food-drink',
      'comedy-improv',
      'film-media',
      'fashion-popups',
      'gaming-esports',
    ],
  },
  {
    label: 'Arts and festivals',
    ids: ['arts-culture', 'festivals-fairs', 'holidays-seasonal', 'markets'],
  },
  {
    label: 'Sports and outdoors',
    ids: ['sports-fitness', 'outdoor-nature', 'wellness-self-care'],
  },
  {
    label: 'People and community',
    ids: [
      'social-meetups',
      'dating-singles',
      'family-friendly',
      'volunteering-community',
      'religious-spiritual',
      'activism-politics',
    ],
  },
  {
    label: 'Work and learning',
    ids: [
      'learning-workshops',
      'networking-professional',
      'entrepreneurship-startups',
      'finance-business',
      'tech-ai',
    ],
  },
] as const satisfies readonly CategoryGroup[]

type FlattenIds<T extends readonly { readonly ids: readonly EventCategory[] }[]> = T extends readonly [
  infer Head extends { readonly ids: readonly EventCategory[] },
  ...infer Rest extends readonly { readonly ids: readonly EventCategory[] }[],
]
  ? [...Head['ids'], ...FlattenIds<Rest>]
  : []

type ListedIds = FlattenIds<typeof CATEGORY_GROUPS>

type HasDuplicate<T extends readonly EventCategory[]> = T extends readonly [
  infer Head extends EventCategory,
  ...infer Rest extends readonly EventCategory[],
]
  ? Head extends Rest[number]
    ? true
    : HasDuplicate<Rest>
  : false

type Expect<T extends true> = T

/** Compile fails when a category is missing from the groups or listed twice. */
export type CategoryGroupsCoverOptions = Expect<
  [Exclude<EventCategory, ListedIds[number]>] extends [never]
    ? HasDuplicate<ListedIds> extends false
      ? ListedIds['length'] extends (typeof CATEGORY_OPTIONS)['length']
        ? true
        : false
      : false
    : false
>
