import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  getStoredLocation,
  requestBrowserLocation,
  saveStoredLocation,
} from '../lib/location'
import { api } from '../api/client'
import { dispatchFeedRefresh } from '../lib/feedEvents'
import { getSessionId, resetLocalAccount } from '../lib/session'
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
  const [confirmation, setConfirmation] = useState<'radius' | 'location' | 'feed' | null>(null)
  const [error, setError] = useState('')
  const [feedRefreshing, setFeedRefreshing] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const cancelResetRef = useRef<HTMLButtonElement>(null)

  const saveRadius = () => {
    saveDiscoverySettings({ radius, unit })
    setError('')
    setConfirmation('radius')
  }

  const changeUnit = (next: DistanceUnit) => {
    if (next === unit) return
    const nextRadius = convertRadius(radius, unit, next)
    setRadius(nextRadius)
    setUnit(next)
    saveDiscoverySettings({ radius: nextRadius, unit: next })
    setError('')
  }

  const enableLocation = async () => {
    try {
      const location = await requestBrowserLocation()
      saveStoredLocation(location)
      setError('')
      setConfirmation('location')
    } catch (e) {
      setConfirmation((current) => (current === 'location' ? null : current))
      setError(e instanceof Error ? e.message : 'Unable to enable location.')
    }
  }

  const refreshEventFeed = async () => {
    const loc = getStoredLocation()
    if (!loc) {
      setConfirmation((current) => (current === 'feed' ? null : current))
      setError('Allow location first, then refresh.')
      return
    }
    setFeedRefreshing(true)
    setError('')
    try {
      const settings = getStoredDiscoverySettings()
      await api.syncEvents(getSessionId(), loc, settings.radius, settings.unit, true)
      dispatchFeedRefresh()
      setConfirmation('feed')
    } catch (e) {
      setConfirmation((current) => (current === 'feed' ? null : current))
      setError(e instanceof Error ? e.message : 'Could not refresh feed.')
    } finally {
      setFeedRefreshing(false)
    }
  }

  useEffect(() => {
    if (!confirmingReset) return
    cancelResetRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !resetting) setConfirmingReset(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmingReset, resetting])

  const resetAccount = async () => {
    setResetting(true)
    setError('')
    setConfirmation(null)
    try {
      await api.resetAccount(getSessionId())
      resetLocalAccount()
      window.location.assign('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset account.')
      setResetting(false)
    }
  }

  return (
    <div className="page settings-page">
      <h1>Settings</h1>
      {error ? (
        <p className="error settings-feedback" role="alert">
          {error}
        </p>
      ) : null}
      <div className="settings-stack">
        <section className="panel settings-panel">
          <h2>Distance unit</h2>
          <div className="unit-toggle" role="group" aria-label="Distance unit">
            <button
              type="button"
              className={unit === 'miles' ? 'is-active' : undefined}
              aria-pressed={unit === 'miles'}
              onClick={() => changeUnit('miles')}
            >
              Miles
            </button>
            <button
              type="button"
              className={unit === 'km' ? 'is-active' : undefined}
              aria-pressed={unit === 'km'}
              onClick={() => changeUnit('km')}
            >
              Km
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Discovery radius</h2>
          <div className="radius-slider">
            <div className="radius-slider-label">
              <label htmlFor="discovery-radius">Distance</label>
              <strong>
                {radius} {unit}
              </strong>
            </div>
            <input
              id="discovery-radius"
              type="range"
              min={0}
              max={MAX_RADIUS[unit]}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-valuetext={`${radius} ${unit}`}
              style={
                {
                  '--radius-ratio': String(radius / MAX_RADIUS[unit]),
                } as CSSProperties
              }
            />
            <div className="radius-slider-scale" aria-hidden="true">
              <span>0</span>
              <span>{MAX_RADIUS[unit]}</span>
            </div>
          </div>
          <div className="settings-actions settings-action-row">
            <button type="button" className="btn btn-primary" onClick={saveRadius}>
              Save radius
            </button>
            {confirmation === 'radius' ? (
              <p className="status settings-inline-status" role="status">
                Discovery radius saved.
              </p>
            ) : null}
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Location</h2>
          <p>Useful if you're seeing events far away from you.</p>
          <div className="settings-action-row">
            <button type="button" className="btn btn-secondary" onClick={() => void enableLocation()}>
              Update location
            </button>
            {confirmation === 'location' ? (
              <p className="status settings-inline-status" role="status">
                Location updated.
              </p>
            ) : null}
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Event feed</h2>
          <p>Useful if events look missing or out of date.</p>
          <div className="settings-action-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={feedRefreshing}
              onClick={() => void refreshEventFeed()}
            >
              {feedRefreshing ? 'Refreshing…' : 'Refresh event feed'}
            </button>
            {confirmation === 'feed' ? (
              <p className="status settings-inline-status" role="status">
                Event feed refreshed.
              </p>
            ) : null}
          </div>
        </section>
      </div>
      <div className="settings-reset">
        <button
          type="button"
          className="btn btn-danger"
          disabled={confirmingReset || resetting}
          onClick={() => {
            setError('')
            setConfirmingReset(true)
          }}
        >
          Reset account
        </button>
      </div>
      {confirmingReset
        ? createPortal(
            <div
              className="modal-backdrop settings-reset-backdrop"
              onClick={() => {
                if (!resetting) setConfirmingReset(false)
              }}
            >
              <div
                className="settings-reset-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reset-account-title"
                aria-describedby="reset-account-desc"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="reset-account-title">Reset your account?</h2>
                <p id="reset-account-desc">
                  This clears your interests, swipes, and saved events.
                </p>
                {error ? (
                  <p className="error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="settings-reset-dialog-actions">
                  <button
                    ref={cancelResetRef}
                    type="button"
                    className="btn btn-ghost"
                    disabled={resetting}
                    onClick={() => setConfirmingReset(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={resetting}
                    onClick={() => void resetAccount()}
                  >
                    {resetting ? 'Resetting…' : 'Reset account'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
