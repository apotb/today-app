import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../api/client'
import { PreferenceQuiz } from '../components/PreferenceQuiz'
import { getSessionId } from '../lib/session'
import type { EventCategory } from '../types/models'
import {
  getStoredLocation,
  requestBrowserLocation,
  saveStoredLocation,
  type StoredLocation,
} from '../lib/location'

type Props = {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: Props) {
  const navigate = useNavigate()
  const [location, setLocation] = useState<StoredLocation | null>(getStoredLocation())
  const [zipInput, setZipInput] = useState('')
  const [locationError, setLocationError] = useState('')
  const savePreferences = async (
    categories: EventCategory[],
    answers: Array<{ questionId: string; answer: boolean; categories: EventCategory[] }>,
  ) => {
    const sessionId = getSessionId()
    await api.syncEvents(location)
    await api.saveOnboardingResponses(sessionId, answers)
    await api.savePreferences(sessionId, categories)
    onComplete()
    navigate('/')
  }

  const enableLocation = async () => {
    try {
      const geo = await requestBrowserLocation()
      saveStoredLocation(geo)
      setLocation(geo)
      setLocationError('')
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : 'Could not get location.')
    }
  }

  const saveZip = () => {
    if (!zipInput.trim()) {
      setLocationError('Enter a ZIP code.')
      return
    }
    const zipLocation: StoredLocation = { mode: 'zip', zip: zipInput.trim() }
    saveStoredLocation(zipLocation)
    setLocation(zipLocation)
    setLocationError('')
  }

  if (!location) {
    return (
      <div className="page center-page">
        <section className="onboarding-panel">
          <h1>Allow location access to find events near you?</h1>
          <div className="question-actions">
            <button className="btn btn-primary large" onClick={() => void enableLocation()}>
              Allow location
            </button>
          </div>
          <p className="status">Or enter ZIP code</p>
          <div className="settings-row">
            <input
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              placeholder="ZIP code"
              className="input"
            />
            <button className="btn btn-secondary" onClick={saveZip}>
              Save ZIP
            </button>
          </div>
          {locationError ? <p className="error">{locationError}</p> : null}
        </section>
      </div>
    )
  }

  return (
    <div className="page center-page">
      <PreferenceQuiz onSubmit={savePreferences} />
    </div>
  )
}
