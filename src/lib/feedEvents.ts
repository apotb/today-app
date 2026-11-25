/** Fired from Settings after sync so Home can reload when mounted or listening. */
export const FEED_REFRESH_EVENT = 'today-refresh-feed'

export function dispatchFeedRefresh() {
  window.dispatchEvent(new Event(FEED_REFRESH_EVENT))
}
