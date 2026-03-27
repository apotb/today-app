# Today

Today is a full-stack local event discovery app with a Tinder-style swipe interface. It surfaces events happening in the next 24 hours, learns from user preferences and interactions, and lets users manage liked events in a calendar-style view.

## System architecture

- **Frontend (`React + TypeScript`)**
  - `Onboarding`: preference questionnaire (sports, arts, volunteering, culture)
  - `Home`: swipe interface for next-24-hour events
  - `My Events`: calendar-style list for liked/attended events with modal details
  - Local session stored in `localStorage` (`today.session.id`)
- **Backend (`Node.js + Express`)**
  - REST API for preferences, discovery, interactions, and saved events
  - Validation using `zod`
  - Recommendation scoring from preferences + interaction history
- **Database (`SQLite`)**
  - Local DB file: `server/today.db`
  - Seeded sample events on first boot

## Folder structure

```txt
today-app/
  server/
    src/
      db.js
      index.js
  src/
    api/
      client.ts
    components/
      EventCalendar.tsx
      EventDetailsModal.tsx
      Layout.tsx
      PreferenceQuiz.tsx
      SwipeCard.tsx
    lib/
      session.ts
    pages/
      HomePage.tsx
      MyEventsPage.tsx
      OnboardingPage.tsx
    types/
      models.ts
    assets/
      logo.png
    App.tsx
    main.tsx
    index.css
```

## API design

Base URL: `http://localhost:4000/api`

- `GET /health`
  - Health check.
- `GET /preferences/:sessionId`
  - Fetch saved categories for a user session.
- `POST /preferences`
  - Save onboarding categories.
- `POST /onboarding/responses`
  - Save yes/no questionnaire answers and mapped categories.
- `POST /events/sync`
  - Fetch and normalize external events based on ZIP/coordinates, user preferences, and radius.
- `GET /events/discover?sessionId=...`
  - Returns events in next 24 hours not already liked/disliked.
  - Uses scoring from preferences and historical interactions.
- `POST /interactions`
  - Store swipe interaction (`like`, `dislike`) per event.
- `POST /attendance`
  - Save post-event attendance status (`attended`, `missed`).
- `GET /events/:eventId`
  - Event detail endpoint.
- `GET /my-events?sessionId=...`
  - Returns liked/attended events for calendar view.

## Database schema

### `events`
- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `description TEXT NOT NULL`
- `starts_at TEXT NOT NULL`
- `ends_at TEXT NOT NULL`
- `cost REAL`
- `image_url TEXT NOT NULL`
- `category TEXT NOT NULL`
- `location TEXT NOT NULL`
- `address TEXT`

### `user_preferences`
- `session_id TEXT NOT NULL`
- `category TEXT NOT NULL`
- `weight INTEGER NOT NULL DEFAULT 1`
- `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `PRIMARY KEY (session_id, category)`

### `user_interactions`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `session_id TEXT NOT NULL`
- `event_id TEXT NOT NULL`
- `action TEXT NOT NULL CHECK(action IN ('like', 'dislike', 'attended'))`
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `UNIQUE(session_id, event_id, action)`

## Behavior and recommendation logic

- Only events with `starts_at` between now and +24 hours are shown in discovery.
- Events already swiped (`like`/`dislike`) are removed from future discovery results.
- Ranking prioritizes:
  - matched onboarding preferences
  - positive interaction history (`like`, `attended`)
  - near-term start time
  - penalties for historical dislikes

## Example API requests

### Save preferences

```bash
curl -X POST http://localhost:4000/api/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "today_123",
    "categories": ["sports", "arts"]
  }'
```

### Get discover feed

```bash
curl "http://localhost:4000/api/events/discover?sessionId=today_123"
```

### Swipe right (like)

```bash
curl -X POST http://localhost:4000/api/interactions \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "today_123",
    "eventId": "event-id-here",
    "action": "like"
  }'
```

### Mark attended

```bash
curl -X POST http://localhost:4000/api/interactions \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "today_123",
    "eventId": "event-id-here",
    "action": "attended"
  }'
```

## API keys and local env setup

The app supports:
- `TICKETMASTER_API_KEY`
- `EVENTBRITE_API_TOKEN`
- `GOOGLE_PLACES_API_KEY` (optional enrichment for address/image quality)

### Recommended local setup (no Git commit)

1. Copy `.env.example` to `.env.local`.
2. Fill in your keys.
3. Run the app normally.

`server/src/env.js` auto-loads `.env.local` at startup, and `.gitignore` already ignores `*.local`.

### PowerShell temporary env setup

```powershell
$env:TICKETMASTER_API_KEY="your_ticketmaster_key"
$env:EVENTBRITE_API_TOKEN="your_eventbrite_token"
$env:GOOGLE_PLACES_API_KEY="your_google_places_key"
```

Without keys, the app gracefully falls back to local seeded events.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Run frontend + backend together:

```bash
npm run dev
```

3. Open frontend:
- [http://localhost:5173](http://localhost:5173)

Backend runs at:
- [http://localhost:4000](http://localhost:4000)

### Optional: run only the backend

```bash
npm run dev:server
```

### Radius and unit

- Change radius in `Settings` (miles/km).
- Home swipe feed and My Events calendar re-sync automatically when radius is saved.

## Notes

- No full authentication is required; a local session ID is used.
- `src/assets/logo.png` is used in the application header.
- UI is responsive and composed of reusable components.
