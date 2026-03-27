const SESSION_KEY = 'today.session.id'

const createSessionId = () =>
  `today_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

export const getSessionId = () => {
  const existing = localStorage.getItem(SESSION_KEY)
  if (existing) {
    return existing
  }
  const created = createSessionId()
  localStorage.setItem(SESSION_KEY, created)
  return created
}
