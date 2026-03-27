export type EventCategory = 'sports' | 'arts' | 'volunteering' | 'culture'

export type EventItem = {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  cost: number | null
  image_url: string
  category: EventCategory
  location: string
  score?: number
}
