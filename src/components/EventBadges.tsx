import { useEffect, useState } from 'react'
import type { EventItem } from '../types/models'
import { categoryLabel } from '../lib/eventActions'
import { eventDistanceMiles, formatDistance } from '../lib/distance'
import {
  getStoredDiscoverySettings,
  onDiscoverySettingsChanged,
  type DistanceUnit,
} from '../lib/discoverySettings'

/** Category chip, with distance in the first slot when we know how far the event is. */
export function EventBadges({ event }: { event: EventItem }) {
  const [unit, setUnit] = useState<DistanceUnit>(() => getStoredDiscoverySettings().unit)

  useEffect(
    () => onDiscoverySettingsChanged(() => setUnit(getStoredDiscoverySettings().unit)),
    [],
  )

  const miles = eventDistanceMiles(event)
  const distance = miles == null ? null : formatDistance(miles, unit)

  return (
    <div className="chip-row">
      {distance ? (
        <p className="chip chip-distance">
          <span aria-hidden>📍</span> {distance}
        </p>
      ) : null}
      <p className="chip">{categoryLabel(event.category)}</p>
    </div>
  )
}
