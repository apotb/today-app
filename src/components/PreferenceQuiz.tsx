import { useState } from 'react'
import { CATEGORY_GROUPS } from '../lib/categoryGroups'
import { CATEGORY_OPTIONS, type EventCategory } from '../types/models'

type Props = {
  onSubmit: (categories: EventCategory[]) => Promise<void>
}

const categoryById = new Map(CATEGORY_OPTIONS.map((category) => [category.id, category]))

function selectedCountLabel(count: number) {
  return count === 1 ? '1 selected' : `${count} selected`
}

export function PreferenceQuiz({ onSubmit }: Props) {
  const [selected, setSelected] = useState<EventCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (category: EventCategory) => {
    setError('')
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
      <header className="categories-header">
        <h1>What are you into?</h1>
        <p className="status categories-help">Choose as many as you like.</p>
      </header>
      <div className="category-scroll">
        {CATEGORY_GROUPS.map((group) => (
          <section key={group.label} className="category-group">
            <h2 className="category-group-label">{group.label}</h2>
            <div className="category-list" role="group" aria-label={group.label}>
              {group.ids.map((id) => {
                const category = categoryById.get(id)
                if (!category) return null
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
                    <span className={`category-check ${active ? 'on' : ''}`} aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6.2 4.8 8.5 9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="categories-footer">
        {error ? <p className="error">{error}</p> : null}
        <p className="categories-count" aria-live="polite">
          {selectedCountLabel(selected.length)}
        </p>
        <button
          type="button"
          className="btn btn-primary categories-continue"
          onClick={() => void finish()}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'See events'}
        </button>
      </div>
    </section>
  )
}
