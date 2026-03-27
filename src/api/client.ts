import type { EventCategory, EventItem } from '../types/models'
import type { StoredLocation } from '../lib/location'

const API_BASE = 'http://localhost:4000/api'

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

  saveOnboardingResponses: (
    sessionId: string,
    answers: Array<{ questionId: string; answer: boolean; categories: EventCategory[] }>,
  ) =>
    request<{ success: boolean }>('/onboarding/responses', {
      method: 'POST',
      body: JSON.stringify({ sessionId, answers }),
    }),

  importLocalEvents: (location: string) =>
    request<{ success: boolean; imported: number }>('/events/import-local', {
      method: 'POST',
      body: JSON.stringify({ location }),
    }),

  syncEvents: (location: StoredLocation | null) =>
    request<{ success: boolean; imported: number }>('/events/sync', {
      method: 'POST',
      body: JSON.stringify({ location: location ?? {} }),
    }),

  discoverEvents: (sessionId: string) =>
    request<{ events: EventItem[] }>(
      `/events/discover?sessionId=${encodeURIComponent(sessionId)}`,
    ),

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
