import { useState } from 'react'
import { CATEGORY_OPTIONS, type EventCategory } from '../types/models'

type Props = {
  onSubmit: (categories: EventCategory[]) => Promise<void>
}

export function PreferenceQuiz({ onSubmit }: Props) {
  const [selected, setSelected] = useState<EventCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (category: EventCategory) => {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    )
  }

  const finish = async () => {
    if (selected.length === 0) {
      setError('Choose at least one category.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="onboarding-panel categories-step">
      <h1>What are you into?</h1>
      <div className="category-grid" role="group" aria-label="Interests">
        {CATEGORY_OPTIONS.map((category) => {
          const active = selected.includes(category.id)
          return (
            <button
              key={category.id}
              type="button"
              className={`category-card ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => toggle(category.id)}
              disabled={saving}
            >
              <span className="emoji" aria-hidden="true">
                {category.icon}
              </span>
              <span className="category-name">{category.name}</span>
            </button>
          )
        })}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary categories-continue" onClick={() => void finish()} disabled={saving}>
        {saving ? 'Saving...' : 'See events'}
      </button>
    </section>
  )
}
