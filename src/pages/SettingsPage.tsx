import { useState } from 'react'
import {
  getStoredLocation,
  requestBrowserLocation,
  saveStoredLocation,
} from '../lib/location'
import { api } from '../api/client'
import { dispatchFeedRefresh } from '../lib/feedEvents'
import { getSessionId } from '../lib/session'
import {
  MAX_RADIUS,
  convertRadius,
  getStoredDiscoverySettings,
  saveDiscoverySettings,
  type DistanceUnit,
} from '../lib/discoverySettings'

export function SettingsPage() {
  const existingDiscovery = getStoredDiscoverySettings()
  const [radius, setRadius] = useState(existingDiscovery.radius)
  const [unit, setUnit] = useState<DistanceUnit>(existingDiscovery.unit)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [feedRefreshing, setFeedRefreshing] = useState(false)

  const saveRadius = () => {
    saveDiscoverySettings({ radius, unit })
    setError('')
    setMessage('Discovery radius saved.')
  }

  const changeUnit = (next: DistanceUnit) => {
    setRadius(convertRadius(radius, unit, next))
    setUnit(next)
  }

  const enableLocation = async () => {
    try {
      const location = await requestBrowserLocation()
      saveStoredLocation(location)
      setError('')
      setMessage('Location updated.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to enable location.')
    }
  }

  const refreshEventFeed = async () => {
    const loc = getStoredLocation()
    if (!loc) {
      setError('Allow location first, then refresh.')
      return
    }
    setFeedRefreshing(true)
    setError('')
    try {
      const settings = getStoredDiscoverySettings()
      await api.syncEvents(getSessionId(), loc, settings.radius, settings.unit, true)
      dispatchFeedRefresh()
      setMessage('Event feed refreshed. Open Home to see updates.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh feed.')
    } finally {
      setFeedRefreshing(false)
    }
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      <section className="panel settings-panel">
        <h2>Location</h2>
        <p className="status">Events use your device location (next 48 hours, within your radius).</p>
        <div className="settings-row">
          <button type="button" className="btn btn-primary" onClick={() => void enableLocation()}>
            Update location
          </button>
        </div>
        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
      <section className="panel settings-panel">
        <h2>Event feed</h2>
        <p className="status">Re-run sync with your saved location and radius (48-hour window).</p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={feedRefreshing}
          onClick={() => void refreshEventFeed()}
        >
          {feedRefreshing ? 'Refreshing…' : 'Refresh event feed'}
        </button>
      </section>
      <section className="panel settings-panel">
        <h2>Discovery radius</h2>
        <p className="status">How far from your location we search for events.</p>
        <div className="radius-slider">
          <label htmlFor="discovery-radius">
            Distance: <strong>{radius} {unit}</strong>
          </label>
          <input
            id="discovery-radius"
            type="range"
            min={0}
            max={MAX_RADIUS[unit]}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-valuetext={`${radius} ${unit}`}
          />
          <div className="radius-slider-scale" aria-hidden="true">
            <span>0</span>
            <span>{MAX_RADIUS[unit]}</span>
          </div>
        </div>
        <div className="settings-row">
          <select
            className="input"
            value={unit}
            aria-label="Distance unit"
            onChange={(e) => changeUnit(e.target.value === 'km' ? 'km' : 'miles')}
          >
            <option value="miles">Miles</option>
            <option value="km">Kilometers</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={saveRadius}>
            Save radius
          </button>
        </div>
      </section>
    </div>
  )
}
