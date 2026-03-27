import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { PreferenceQuiz } from '../components/PreferenceQuiz'
import { getSessionId } from '../lib/session'
import type { EventCategory } from '../types/models'

type Props = {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: Props) {
  const navigate = useNavigate()
  const savePreferences = async (
    categories: EventCategory[],
    answers: Array<{ questionId: string; answer: boolean; categories: EventCategory[] }>,
  ) => {
    const sessionId = getSessionId()
    await api.importLocalEvents('Downtown')
    await api.saveOnboardingResponses(sessionId, answers)
    await api.savePreferences(sessionId, categories)
    onComplete()
    navigate('/')
  }

  return (
    <div className="page center-page">
      <PreferenceQuiz onSubmit={savePreferences} />
    </div>
  )
}
