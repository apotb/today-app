import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../api/client'
import { PreferenceQuiz } from '../components/PreferenceQuiz'
import { getSessionId } from '../lib/session'
import type { AnswerSoFar } from '../lib/questionPool'
import type { EventCategory } from '../types/models'
import { getStoredDiscoverySettings } from '../lib/discoverySettings'
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

  const savePreferences = async (categories: EventCategory[], answers: AnswerSoFar[]) => {
    const sessionId = getSessionId()
    const settings = getStoredDiscoverySettings()
    await api.savePreferences(sessionId, categories)
    await api.saveOnboardingResponses(sessionId, answers)
    await api.syncEvents(sessionId, location, settings.radius, settings.unit)
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
        <section className="onboarding-panel location-step">
          <h1>Find events near you</h1>
          <p className="status location-subtitle">
            Allow location for the best nearby results, or enter your ZIP code.
          </p>
          <div className="location-stack">
            <button type="button" className="btn btn-primary large" onClick={() => void enableLocation()}>
              Allow location access
            </button>
            <span className="location-divider">or</span>
            <div className="zip-inline">
              <input
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                placeholder="ZIP code"
                className="input"
                inputMode="numeric"
              />
              <button type="button" className="btn btn-secondary" onClick={saveZip}>
                Continue with ZIP
              </button>
            </div>
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
