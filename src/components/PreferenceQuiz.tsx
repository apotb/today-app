import { useState } from 'react'
import {
  buildInitialRemaining,
  pickNextQuestion,
  type AnswerSoFar,
} from '../lib/questionPool'
import { CATEGORY_OPTIONS, type EventCategory, type QuestionItem } from '../types/models'

const QUESTION_TARGET = 10

type Props = {
  onSubmit: (categories: EventCategory[], answers: AnswerSoFar[]) => Promise<void>
}

export function PreferenceQuiz({ onSubmit }: Props) {
  const [phase, setPhase] = useState<'categories' | 'questions'>('categories')
  const [selected, setSelected] = useState<EventCategory[]>([])
  const [remaining, setRemaining] = useState<QuestionItem[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuestionItem | null>(null)
  const [answers, setAnswers] = useState<AnswerSoFar[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (category: EventCategory) => {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    )
  }

  const startQuestions = () => {
    if (selected.length === 0) {
      setError('Choose at least one category.')
      return
    }
    setError('')
    const pool = buildInitialRemaining(selected, Date.now())
    setRemaining(pool)
    setAnswers([])
    const first = pickNextQuestion(pool, selected, [])
    setCurrentQuestion(first)
    setPhase('questions')
  }

  const finish = async (finalAnswers: AnswerSoFar[]) => {
    setSaving(true)
    setError('')
    try {
      await onSubmit(selected, finalAnswers)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  const answerQuestion = (yes: boolean) => {
    if (!currentQuestion) return
    const nextAnswers: AnswerSoFar[] = [
      ...answers,
      {
        questionId: currentQuestion.id,
        answer: yes,
        categories: currentQuestion.categories,
        tags: currentQuestion.tags,
      },
    ]
    const nextPool = remaining.filter((q) => q.id !== currentQuestion.id)

    if (nextAnswers.length >= QUESTION_TARGET) {
      setSaving(true)
      void finish(nextAnswers)
      return
    }

    setAnswers(nextAnswers)
    setRemaining(nextPool)
    const nextQ = pickNextQuestion(nextPool, selected, nextAnswers)
    setCurrentQuestion(nextQ)
    if (!nextQ && nextAnswers.length < QUESTION_TARGET) {
      setError('No more questions available; finishing early.')
      setSaving(true)
      void finish(nextAnswers)
    }
  }

  if (phase === 'questions' && saving) {
    return (
      <section className="onboarding-panel">
        <p className="status">Saving your preferences...</p>
      </section>
    )
  }

  if (phase === 'categories') {
    return (
      <section className="onboarding-panel">
        <h1>What are you into?</h1>
        <p>Pick categories first—we&apos;ll tailor screening questions to your choices.</p>
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
        <button className="btn btn-primary" onClick={startQuestions}>
          Continue to questions
        </button>
      </section>
    )
  }

  if (!currentQuestion) {
    return (
      <section className="onboarding-panel">
        <p className="status">Preparing questions...</p>
      </section>
    )
  }

  return (
    <section className="onboarding-panel">
      <p className="stepper">
        Question {answers.length + 1} of {QUESTION_TARGET}
      </p>
      <p className="quiz-attend-label">Would you attend:</p>
      <h1 className="quiz-question-heading">{currentQuestion.prompt}</h1>
      <div className="question-actions">
        <button className="btn btn-secondary large" onClick={() => answerQuestion(false)} disabled={saving}>
          No
        </button>
        <button className="btn btn-primary large" onClick={() => answerQuestion(true)} disabled={saving}>
          Yes
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}
