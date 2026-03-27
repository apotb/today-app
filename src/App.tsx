import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { MyEventsPage } from './pages/MyEventsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { getSessionId } from './lib/session'
import { api } from './api/client'
import { useEffect, useState } from 'react'

function App() {
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const run = async () => {
      const sessionId = getSessionId()
      try {
        const response = await api.getPreferences(sessionId)
        setNeedsOnboarding(response.preferences.length === 0)
      } catch {
        setNeedsOnboarding(true)
      } finally {
        setReady(true)
      }
    }
    void run()
  }, [])

  if (!ready) return <p className="status">Loading Today...</p>

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
      </Route>
    </Routes>
  )
}

export default App
