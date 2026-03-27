import { useState } from 'react'
import {
  requestBrowserLocation,
  saveStoredLocation,
  getStoredLocation,
  type StoredLocation,
} from '../lib/location'
import { api } from '../api/client'
import {
  getStoredDiscoverySettings,
  saveDiscoverySettings,
  type DistanceUnit,
} from '../lib/discoverySettings'

export function SettingsPage() {
  const existing = getStoredLocation()
  const existingDiscovery = getStoredDiscoverySettings()
  const [zip, setZip] = useState(existing?.zip ?? '')
  const [radius, setRadius] = useState(`${existingDiscovery.radius}`)
  const [unit, setUnit] = useState<DistanceUnit>(existingDiscovery.unit)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [zipWorking, setZipWorking] = useState(false)

  const saveZip = async () => {
    if (!zip.trim()) {
      setError('Enter a ZIP code.')
      return
    }
    setZipWorking(true)
    setError('')
    try {
      let next: StoredLocation = { mode: 'zip', zip: zip.trim() }
      try {
        const { latitude, longitude } = await api.geocodeZip(next.zip!)
        next = { ...next, latitude, longitude }
      } catch {
        /* keep ZIP without coords */
      }
      saveStoredLocation(next)
      setMessage('ZIP code saved.')
    } finally {
      setZipWorking(false)
    }
  }

  const saveRadius = () => {
    const value = Number(radius)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Radius must be a positive number.')
      return
    }
    saveDiscoverySettings({ radius: value, unit })
    setError('')
    setMessage('Discovery radius saved.')
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
          <button className="btn btn-primary" disabled={zipWorking} onClick={() => void saveZip()}>
            {zipWorking ? 'Saving…' : 'Save ZIP'}
          </button>
          <button className="btn btn-secondary" onClick={() => void enableLocation()}>
            Re-enable Location
          </button>
        </div>
        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
      <section className="panel settings-panel">
        <h2>Discovery Radius</h2>
        <p className="status">Choose how far away events can be from your location.</p>
        <div className="settings-row">
          <input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="Radius"
            className="input"
            inputMode="decimal"
          />
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value === 'km' ? 'km' : 'miles')}
          >
            <option value="miles">Miles</option>
            <option value="km">Kilometers</option>
          </select>
          <button className="btn btn-primary" onClick={saveRadius}>
            Save Radius
          </button>
        </div>
      </section>
    </div>
  )
}
