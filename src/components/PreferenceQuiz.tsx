import { useState } from 'react'
import type { EventCategory } from '../types/models'

const options: EventCategory[] = ['sports', 'arts', 'volunteering', 'culture']

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

  const handleSubmit = async () => {
    if (selected.length === 0) {
      setError('Choose at least one interest.')
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
    <section className="panel">
      <h1>Tell us what you like</h1>
      <p>Pick your interests to personalize events in the next 24 hours.</p>
      <div className="tags">
        {options.map((category) => (
          <button
            key={category}
            className={`tag ${selected.includes(category) ? 'active' : ''}`}
            onClick={() => toggle(category)}
          >
            {category}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
        {saving ? 'Saving...' : 'Start Discovering'}
      </button>
    </section>
  )
}
