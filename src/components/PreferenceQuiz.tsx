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
    <section className="onboarding-panel">
      <h1>What are you into?</h1>
      <p>Pick a few interests. We&apos;ll start there and tune the deck as you swipe.</p>
      <div className="category-grid">
        {CATEGORY_OPTIONS.map((category) => (
          <button
            key={category.id}
            className={`category-card ${selected.includes(category.id) ? 'active' : ''}`}
            onClick={() => toggle(category.id)}
            disabled={saving}
          >
            <span className="emoji">{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" onClick={() => void finish()} disabled={saving}>
        {saving ? 'Saving...' : 'See events'}
      </button>
    </section>
  )
}
