import type { AnswerSoFar } from '../lib/questionPool'
import type { EventCategory, EventItem } from '../types/models'
import type { StoredLocation } from '../lib/location'
import type { DistanceUnit } from '../lib/discoverySettings'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(body.message ?? 'Request failed')
  }
  return response.json() as Promise<T>
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
