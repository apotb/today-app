import { useState } from 'react'
import { ONBOARDING_QUESTIONS } from '../lib/questions'
import { CATEGORY_OPTIONS, type EventCategory } from '../types/models'

type Props = {
  onSubmit: (
    categories: EventCategory[],
    answers: Array<{ questionId: string; answer: boolean; categories: EventCategory[] }>,
  ) => Promise<void>
}

export function PreferenceQuiz({ onSubmit }: Props) {
  const [phase, setPhase] = useState<'questions' | 'categories'>('questions')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<
    Array<{ questionId: string; answer: boolean; categories: EventCategory[] }>
  >([])
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
      await onSubmit(selected, answers)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  const currentQuestion = ONBOARDING_QUESTIONS[questionIndex]
  const answerQuestion = (answer: boolean) => {
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        answer,
        categories: currentQuestion.categories,
      },
    ])
    if (questionIndex < ONBOARDING_QUESTIONS.length - 1) {
      setQuestionIndex((prev) => prev + 1)
      return
    }
    setPhase('categories')
  }

  if (phase === 'questions') {
    return (
      <section className="onboarding-panel">
        <p className="stepper">
          Question {questionIndex + 1} of {ONBOARDING_QUESTIONS.length}
        </p>
        <h1>{currentQuestion.prompt}</h1>
        <div className="question-actions">
          <button className="btn btn-secondary large" onClick={() => answerQuestion(false)}>
            No
          </button>
          <button className="btn btn-primary large" onClick={() => answerQuestion(true)}>
            Yes
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="onboarding-panel">
      <h1>Select categories you want more of</h1>
      <p>Tap to toggle. We will prioritize these in your feed.</p>
      <div className="category-grid">
        {CATEGORY_OPTIONS.map((category) => (
          <button
            key={category.id}
            className={`category-card ${selected.includes(category.id) ? 'active' : ''}`}
            onClick={() => toggle(category.id)}
          >
            <span className="emoji">{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
        {saving ? 'Saving...' : 'Done'}
      </button>
    </section>
  )
}
