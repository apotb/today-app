import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { MyEventsPage } from './pages/MyEventsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'
import { getSessionId } from './lib/session'
import { api } from './api/client'
import { useCallback, useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  // Decide between onboarding and the app from the saved preferences. A new session
  // gets an empty list back; a failed request means the server couldn't be reached,
  // which must not be mistaken for a new user (that would send a returning user back
  // through onboarding).
  const loadSession = useCallback(async () => {
    try {
      const response = await api.getPreferences(getSessionId())
      setNeedsOnboarding(response.preferences.length === 0)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const retry = () => {
    setStatus('loading')
    void loadSession()
  }

  if (status === 'error') {
    return (
      <div className="status startup-error" role="alert">
        <p>Couldn&apos;t reach Today right now. Check your connection and try again.</p>
        <button type="button" className="btn btn-primary" onClick={retry}>
          Retry
        </button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <p className="status">
        Loading Today...
        <br />
        <span className="loading-hint">
          If this takes more than a minute, your API may be waking up (free Render) or blocked by a privacy extension—try
          opening your API <code>/api/health</code> in a new tab first.
        </span>
      </p>
    )
  }

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          needsOnboarding ? (
            <OnboardingPage onComplete={() => setNeedsOnboarding(false)} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/"
        element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <Layout />}
      >
        <Route index element={<HomePage />} />
        <Route path="my-events" element={<MyEventsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
