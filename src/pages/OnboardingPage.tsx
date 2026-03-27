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
  const savePreferences = async (categories: EventCategory[]) => {
    await api.savePreferences(getSessionId(), categories)
    onComplete()
    navigate('/')
  }

  return (
    <div className="page">
      <PreferenceQuiz onSubmit={savePreferences} />
    </div>
  )
}
