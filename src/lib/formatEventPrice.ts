/** Ticket price from API: null = unknown (show CTA), 0 = free, positive = dollars */
export function formatEventPrice(cost: number | null | undefined): string {
  if (cost != null && cost > 0) {
    const rounded = cost >= 100 ? Math.round(cost) : Math.round(cost * 100) / 100
    return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`
  }
  if (cost === 0) return 'Free'
  return 'See tickets'
}
