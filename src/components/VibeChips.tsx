import { VIBES, type VibeId } from '../lib/vibes'

type Props = {
  selected: VibeId[]
  onChange: (next: VibeId[]) => void
}

/** One-tap filter row above the swipe deck. Scrolls sideways on narrow screens. */
export function VibeChips({ selected, onChange }: Props) {
  const toggle = (id: VibeId) =>
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id])

  return (
    <div className="vibe-chips" role="group" aria-label="Filter events by vibe">
      {VIBES.map((vibe) => {
        const on = selected.includes(vibe.id)
        return (
          <button
            key={vibe.id}
            type="button"
            className={on ? 'vibe-chip active' : 'vibe-chip'}
            aria-pressed={on}
            onClick={() => toggle(vibe.id)}
          >
            <span aria-hidden>{vibe.icon}</span> {vibe.label}
          </button>
        )
      })}
      {selected.length > 0 ? (
        <button type="button" className="vibe-chip vibe-chip-clear" onClick={() => onChange([])}>
          Clear
        </button>
      ) : null}
    </div>
  )
}
