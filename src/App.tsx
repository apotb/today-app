import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { OnboardingPage } from './pages/OnboardingPage'
import { getSessionId } from './lib/session'
import { api } from './api/client'
import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  // Bumped by Retry to run the startup check again.
  const [attempt, setAttempt] = useState(0)

  // Decide between onboarding and the app from the saved preferences. A new session
  // gets an empty list back; a failed request means the server couldn't be reached,
  // which must not be mistaken for a new user (that would send a returning user back
  // through onboarding).
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const response = await api.getPreferences(getSessionId())
        if (cancelled) return
        setNeedsOnboarding(response.preferences.length === 0)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = () => {
    setStatus('loading')
    setAttempt((n) => n + 1)
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
        {/* Layout keeps these pages mounted. The child routes only match the URLs. */}
        <Route index element={null} />
        <Route path="my-events" element={null} />
        <Route path="settings" element={null} />
      </Route>
    </Routes>
  )
}

export default App
