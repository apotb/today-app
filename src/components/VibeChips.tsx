import { useEffect, useRef, useState } from 'react'
import { VIBES, type VibeId } from '../lib/vibes'

type Props = {
  selected: VibeId[]
  onChange: (next: VibeId[]) => void
}

/** One-tap filter row above the swipe deck. Scrolls sideways when the chips overflow. */
export function VibeChips({ selected, onChange }: Props) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [fadeRight, setFadeRight] = useState(false)
  const toggle = (id: VibeId) =>
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const update = () => {
      const remaining = row.scrollWidth - row.clientWidth - row.scrollLeft
      setFadeRight(remaining > 1)
    }
    update()
    row.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      row.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [selected])

  return (
    <div
      ref={rowRef}
      className={fadeRight ? 'vibe-chips is-fading-right' : 'vibe-chips'}
      role="group"
      aria-label="Filter events by vibe"
    >
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
