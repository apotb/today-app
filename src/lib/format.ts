export const formatTime12h = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

/**
 * Price label for an event. `null` means the source didn't list a price, so it
 * must not be shown as "Free"; only an explicit 0 is free.
 */
export const formatPrice = (cost: number | null | undefined) => {
  if (cost == null || !Number.isFinite(cost)) return 'Price not listed'
  if (cost <= 0) return 'Free'
  return Number.isInteger(cost) ? `$${cost}` : `$${cost.toFixed(2)}`
}

export const formatDateTime12h = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
