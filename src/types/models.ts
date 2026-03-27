export const CATEGORY_OPTIONS = [
  { id: 'sports-fitness', name: 'Sports & Fitness', icon: '🏃' },
  { id: 'arts-culture', name: 'Arts & Culture', icon: '🎨' },
  { id: 'music-nightlife', name: 'Music & Nightlife', icon: '🎵' },
  { id: 'food-drink', name: 'Food & Drink', icon: '🍜' },
  { id: 'volunteering-community', name: 'Volunteering & Community', icon: '🤝' },
  { id: 'social-meetups', name: 'Social & Meetups', icon: '🫶' },
  { id: 'dating-singles', name: 'Dating & Singles', icon: '💘' },
  { id: 'family-friendly', name: 'Family-Friendly', icon: '👨‍👩‍👧' },
  { id: 'outdoor-nature', name: 'Outdoor & Nature', icon: '🌲' },
  { id: 'wellness-self-care', name: 'Wellness & Self-Care', icon: '🧘' },
  { id: 'learning-workshops', name: 'Learning & Workshops', icon: '📚' },
  { id: 'networking-professional', name: 'Networking & Professional', icon: '💼' },
  { id: 'entrepreneurship-startups', name: 'Entrepreneurship & Startups', icon: '🚀' },
  { id: 'finance-business', name: 'Finance & Business', icon: '📈' },
  { id: 'gaming-esports', name: 'Gaming & Esports', icon: '🎮' },
  { id: 'tech-ai', name: 'Tech & AI', icon: '🤖' },
  { id: 'film-media', name: 'Film & Media', icon: '🎬' },
  { id: 'fashion-popups', name: 'Fashion & Pop-Ups', icon: '👗' },
  { id: 'comedy-improv', name: 'Comedy & Improv', icon: '😂' },
  { id: 'festivals-fairs', name: 'Festivals & Fairs', icon: '🎪' },
  { id: 'holidays-seasonal', name: 'Holidays & Seasonal Events', icon: '🎉' },
  { id: 'markets', name: 'Markets', icon: '🛍️' },
  { id: 'religious-spiritual', name: 'Religious & Spiritual', icon: '🕊️' },
  { id: 'activism-politics', name: 'Activism & Politics', icon: '📣' },
  { id: 'travel-exploration', name: 'Travel & Exploration', icon: '🧭' },
] as const

export type EventCategory = (typeof CATEGORY_OPTIONS)[number]['id']

export type QuestionItem = {
  id: string
  prompt: string
  categories: EventCategory[]
}

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
  attendance_status?: 'attended' | 'missed' | null
  score?: number
}
