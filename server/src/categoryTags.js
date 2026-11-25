/** Default tags per category for scoring & image fallbacks */
export const CATEGORY_TAGS = {
  'sports-fitness': ['sports', 'fitness', 'active', 'wellness-physical'],
  'arts-culture': ['arts', 'culture', 'museum', 'gallery'],
  'music-nightlife': ['music', 'nightlife', 'live', 'concert'],
  'food-drink': ['food', 'drink', 'dining', 'culinary'],
  'volunteering-community': ['volunteer', 'community', 'service', 'local'],
  'social-meetups': ['social', 'meetup', 'networking-casual', 'group'],
  'dating-singles': ['dating', 'singles', 'social-romantic'],
  'family-friendly': ['family', 'kids', 'all-ages'],
  'outdoor-nature': ['outdoor', 'nature', 'parks', 'hiking'],
  'wellness-self-care': ['wellness', 'yoga', 'mindfulness', 'spa'],
  'learning-workshops': ['learning', 'workshop', 'education', 'class'],
  'networking-professional': ['networking', 'professional', 'career'],
  'entrepreneurship-startups': ['startup', 'entrepreneur', 'pitch', 'innovation'],
  'finance-business': ['finance', 'business', 'investing'],
  'gaming-esports': ['gaming', 'esports', 'competitive-play'],
  'tech-ai': ['tech', 'ai', 'software', 'digital'],
  'film-media': ['film', 'media', 'cinema', 'screening'],
  'fashion-popups': ['fashion', 'popup', 'retail'],
  'comedy-improv': ['comedy', 'improv', 'standup', 'laughs'],
  'festivals-fairs': ['festival', 'fair', 'celebration'],
  'holidays-seasonal': ['holiday', 'seasonal', 'themed'],
  markets: ['market', 'vendors', 'local-shopping'],
  'religious-spiritual': ['spiritual', 'faith', 'community-gathering'],
  'activism-politics': ['activism', 'civic', 'causes'],
  'travel-exploration': ['travel', 'exploration', 'adventure'],
}

export const tagsForCategory = (category) =>
  CATEGORY_TAGS[category] ?? ['general', 'local']
