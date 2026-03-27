import type { QuestionItem } from '../types/models'

export const ONBOARDING_QUESTIONS: QuestionItem[] = [
  {
    id: 'q1',
    prompt: 'Would you be interested in attending a live jazz concert tonight?',
    categories: ['music-nightlife', 'arts-culture'],
  },
  {
    id: 'q2',
    prompt: 'Would you be interested in joining a sunset yoga class in the park?',
    categories: ['wellness-self-care', 'outdoor-nature', 'sports-fitness'],
  },
  {
    id: 'q3',
    prompt: 'Would you be interested in a startup networking mixer this evening?',
    categories: ['networking-professional', 'entrepreneurship-startups', 'tech-ai'],
  },
  {
    id: 'q4',
    prompt: 'Would you be interested in browsing a local night market with food stalls?',
    categories: ['markets', 'food-drink', 'festivals-fairs'],
  },
  {
    id: 'q5',
    prompt: 'Would you be interested in helping at a weekend community cleanup?',
    categories: ['volunteering-community', 'outdoor-nature'],
  },
  {
    id: 'q6',
    prompt: 'Would you be interested in attending a stand-up comedy showcase?',
    categories: ['comedy-improv', 'social-meetups'],
  },
]
