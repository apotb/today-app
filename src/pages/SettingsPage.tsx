import { useState } from 'react'
import { requestBrowserLocation, saveStoredLocation, getStoredLocation } from '../lib/location'

export function SettingsPage() {
  const existing = getStoredLocation()
  const [zip, setZip] = useState(existing?.zip ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const saveZip = () => {
    if (!zip.trim()) {
      setError('Enter a ZIP code.')
      return
    }
    saveStoredLocation({ mode: 'zip', zip: zip.trim() })
    setError('')
    setMessage('ZIP code saved.')
  }

  const enableLocation = async () => {
    try {
      const location = await requestBrowserLocation()
      saveStoredLocation(location)
      setError('')
      setMessage('Location access enabled.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to enable location.')
    }
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      <section className="panel settings-panel">
        <h2>Location</h2>
        <p className="status">Use your location or set a ZIP code to find nearby events.</p>
        <div className="settings-row">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="Enter ZIP code"
            className="input"
          />
          <button className="btn btn-primary" onClick={saveZip}>
            Save ZIP
          </button>
          <button className="btn btn-secondary" onClick={() => void enableLocation()}>
            Re-enable Location
          </button>
        </div>
        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  )
}
