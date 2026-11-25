import type { AnswerSoFar } from '../lib/questionPool'
import type { EventCategory, EventItem } from '../types/models'
import type { StoredLocation } from '../lib/location'
import type { DistanceUnit } from '../lib/discoverySettings'

/** Relative `/api` uses the Vite dev proxy. On Vercel, set `VITE_API_BASE` to your API origin + `/api` (e.g. `https://your-api.railway.app/api`). */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

function apiErrorHint(status: number, body: string) {
  if (import.meta.env.PROD && API_BASE === '/api') {
    return 'Server API is not deployed for this site. Set VITE_API_BASE on Vercel to your backend URL (see .env.example).'
  }
  if (status === 404 && body.trimStart().startsWith('<')) {
    return 'API returned a web page instead of JSON—check VITE_API_BASE and that the backend is running.'
  }
  return `Request failed (${status}).`
}

/** Free-tier hosts (e.g. Render) can take 30–90s to answer the first request after sleep. */
const REQUEST_TIMEOUT_MS = 120_000

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const text = await response.text()
  if (!response.ok) {
    if (text.trimStart().startsWith('{')) {
      try {
        const body = JSON.parse(text) as { message?: string }
        throw new Error(body.message ?? apiErrorHint(response.status, text))
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e
      }
    }
    throw new Error(apiErrorHint(response.status, text))
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      'Invalid JSON from API. On Vercel, set VITE_API_BASE to your Express server (URL must end with `/api`, same paths as locally).',
    )
  }
}

export const api = {
  getPreferences: (sessionId: string) =>
    request<{ preferences: EventCategory[] }>(`/preferences/${sessionId}`),

  savePreferences: (sessionId: string, categories: EventCategory[]) =>
    request<{ success: boolean }>('/preferences', {
      method: 'POST',
      body: JSON.stringify({ sessionId, categories }),
    }),

  saveOnboardingResponses: (sessionId: string, answers: AnswerSoFar[]) =>
    request<{ success: boolean }>('/onboarding/responses', {
      method: 'POST',
      body: JSON.stringify({ sessionId, answers }),
    }),

  importLocalEvents: (location: string) =>
    request<{ success: boolean; imported: number }>('/events/import-local', {
      method: 'POST',
      body: JSON.stringify({ location }),
    }),

  syncEvents: (
    sessionId: string,
    location: StoredLocation | null,
    radius: number,
    unit: DistanceUnit,
  ) =>
    request<{ success: boolean; imported: number }>('/events/sync', {
      method: 'POST',
      body: JSON.stringify({ sessionId, location: location ?? {}, radius, unit }),
    }),

  discoverEvents: (sessionId: string, location: StoredLocation | null) => {
    const params = new URLSearchParams({ sessionId })
    if (location?.latitude != null) params.set('latitude', String(location.latitude))
    if (location?.longitude != null) params.set('longitude', String(location.longitude))
    return request<{ events: EventItem[] }>(`/events/discover?${params.toString()}`)
  },

  submitInteraction: (
    sessionId: string,
    eventId: string,
    action: 'like' | 'dislike',
  ) =>
    request<{ success: boolean }>('/interactions', {
      method: 'POST',
      body: JSON.stringify({ sessionId, eventId, action }),
    }),

  setAttendance: (sessionId: string, eventId: string, status: 'attended' | 'missed') =>
    request<{ success: boolean }>('/attendance', {
      method: 'POST',
      body: JSON.stringify({ sessionId, eventId, status }),
    }),

  getMyEvents: (sessionId: string) =>
    request<{ events: EventItem[] }>(`/my-events?sessionId=${encodeURIComponent(sessionId)}`),
}
