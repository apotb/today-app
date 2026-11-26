# Today

Today is a full-stack local event discovery app with a Tinder-style swipe interface. It surfaces events happening in the next 48 hours near you, learns from your preferences and swipes, and keeps the events you like in a calendar view.

## How it works

1. **Onboarding:** the user allows location, picks interest categories, and answers 10 quick yes/no questions.
2. **Home:** a swipe deck of events in the next 48 hours within the user's radius. Swipe right to save, left to skip, up for details.
3. **My Events:** an hour-by-hour calendar of saved events for the next 48 hours. Tap an event for details and add-to-calendar links, or its ✕ to remove it (this undoes the like, so the event returns to the Home deck).
4. **Settings:** change location, radius (miles or km), and force a fresh event refresh.

There are no accounts yet. Each browser gets a random session id stored in `localStorage` (`today.session.id`), and all preferences and swipes are tied to it.

## System architecture

- **Frontend:** React + TypeScript (Vite), hosted on Vercel as a static site.
- **Backend:** Node.js + Express REST API, hosted separately (Render). Input validation uses `zod`.
- **Database:** SQLite via Node's built-in `node:sqlite` (requires **Node 22.13+**). Default file: `server/today.db`.
- **Event data:** Ticketmaster Discovery API. Without a key, the app shows 6 built-in sample events.

### Event pipeline

1. The frontend calls `POST /api/events/sync` with the user's location and radius.
2. If that area (location rounded to ~1 km, plus radius) was synced in the last **30 minutes**, the server skips the provider call and reuses stored events.
3. Otherwise it fetches from Ticketmaster, normalizes the results, and merges duplicates (same title and venue around the same time). Each event gets a stable `evt_...` id.
4. Events are upserted into the shared `events` table. Events that have ended and that nobody swiped on are pruned. Events with swipes are kept so saved events and swipe history aren't lost.
5. `GET /api/events/discover` returns upcoming events within the user's radius that they haven't swiped on yet, ranked for that user. The built-in sample events only appear when there are no real events near the user at all.

### Ranking

Events are sorted by a preference score built from:

- the categories picked during onboarding (ranked by order picked)
- yes/no answers from the onboarding questions, by category and by tag
- swipe history: likes add, dislikes subtract
- attendance: attended adds, missed subtracts

Ties are broken by distance, then start time.

## Folder structure

```txt
today-app/
  server/src/
    index.js             Express app and all API routes
    db.js                SQLite setup, schema, sample events
    eventsProvider.js    Ticketmaster fetch + normalization
    eventAggregation.js  Merge/dedupe across sources, stable ids, image fallbacks
    categoryTags.js      Category ids and their default tags
    geo.js               Distance helpers
    titleClean.js        Strips dates/times out of event titles
    env.js               Loads .env.local for local development
  src/
    api/client.ts        Typed API client
    pages/               Home, MyEvents, Onboarding, Settings
    components/          SwipeCard, EventCalendar, EventDetailsModal, PreferenceQuiz, Layout, ...
    lib/                 Session, location, settings, formatting, calendar links, quiz questions
    types/models.ts      Shared frontend types and category list
    assets/logo.png
  public/                favicon and home-screen icon
```

The category list exists in two places that must stay in sync: `server/src/categoryTags.js` (server) and `CATEGORY_OPTIONS` in `src/types/models.ts` (frontend).

## API

Base URL locally: `http://localhost:4000/api`

| Method & path | Purpose |
|---|---|
| `GET /health` | Health check, returns `{ "ok": true }`. |
| `GET /debug/providers` | Shows whether the Ticketmaster key is loaded. |
| `GET /preferences/:sessionId` | Saved categories for a session. |
| `POST /preferences` | Save onboarding categories: `{ sessionId, categories }`. |
| `POST /onboarding/responses` | Save yes/no quiz answers: `{ sessionId, answers }`. |
| `POST /events/sync` | Fetch events for an area: `{ sessionId, location: { latitude, longitude }, radius, unit, force? }`. Returns `cached: true` when the area was synced in the last 30 minutes; `force: true` skips the cache. |
| `GET /events/discover` | Ranked feed. Query: `sessionId`, `latitude`, `longitude`, `radius`, `unit` (`miles` or `km`, default 25 miles). |
| `POST /interactions` | Save a swipe: `{ sessionId, eventId, action: "like" \| "dislike" }`. |
| `POST /attendance` | Save attendance: `{ sessionId, eventId, status: "attended" \| "missed" }`. |
| `GET /events/:eventId` | Single event. |
| `GET /events/:eventId/calendar.ics` | One event as an Apple Calendar file. |
| `GET /my-events?sessionId=...` | Saved events for roughly the next 4 days, with `attendance_status`. |

### Examples

```bash
# Save preferences
curl -X POST http://localhost:4000/api/preferences \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "today_123", "categories": ["sports-fitness", "arts-culture"] }'

# Sync events near Columbus, OH
curl -X POST http://localhost:4000/api/events/sync \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "today_123", "location": { "latitude": 39.96, "longitude": -83.0 }, "radius": 25, "unit": "miles" }'

# Get the feed
curl "http://localhost:4000/api/events/discover?sessionId=today_123&latitude=39.96&longitude=-83.0&radius=25&unit=miles"

# Swipe right
curl -X POST http://localhost:4000/api/interactions \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "today_123", "eventId": "event-id-here", "action": "like" }'

# Mark attended
curl -X POST http://localhost:4000/api/attendance \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "today_123", "eventId": "event-id-here", "status": "attended" }'
```

## Database schema

| Table | Holds |
|---|---|
| `events` | All synced events, shared by every user: id, title, description, `starts_at`, `ends_at`, `cost` (null = price not listed), `image_url`, category, location, address, latitude, longitude, tags (JSON), `source_url`, `series_key`. |
| `user_preferences` | Categories picked at onboarding, with a weight per session. |
| `user_questionnaire_answers` | Each yes/no quiz answer with its categories and tags. |
| `user_tag_scores` | Per-session tag scores derived from quiz answers. |
| `user_interactions` | Swipes (`like`, `dislike`) and `attended`, unique per session/event/action. |
| `user_event_attendance` | Attendance status (`attended` / `missed`) per session and event. |
| `sync_areas` | Last sync time per area, for the 30-minute cache. |

New columns and tables are added automatically on startup (`initDb` in `db.js`).

## Run locally

1. Install **Node 22.13+**, then dependencies:

   ```bash
   npm install
   ```

2. Optional, for real events: copy `.env.example` to `.env.local` and set `TICKETMASTER_API_KEY` (free at developer.ticketmaster.com). `.env.local` is gitignored and loaded automatically by `server/src/env.js`.

3. Run frontend and backend together:

   ```bash
   npm run dev
   ```

   - Frontend: [http://localhost:5173](http://localhost:5173) (proxies `/api` to the backend)
   - Backend: [http://localhost:4000](http://localhost:4000)
   - Backend only: `npm run dev:server`

4. Check the key is loaded: [http://localhost:4000/api/debug/providers](http://localhost:4000/api/debug/providers)

**Testing on a phone or iPad:** browsers only allow location on `https://` pages or `localhost`, so opening `http://<computer-ip>:5173` will block the location prompt. Use an HTTPS tunnel (ngrok, Cloudflare Tunnel) pointed at port 5173; `vite.config.ts` already allows any host for this.

## Deploy (Vercel frontend + Render API)

The Vercel project is only the static frontend. The API runs on a Node host (Render).

### Render

1. In [Render](https://render.com): **New → Blueprint**, connect the repo, and apply `render.yaml`.
2. In the service's **Environment**, add `TICKETMASTER_API_KEY`.
3. Wait for deploy, then open `https://<your-service>.onrender.com/api/health` and confirm `{"ok":true}`.

### Vercel

1. In the project's **Environment variables**, set `VITE_API_BASE` = `https://<your-service>.onrender.com/api`.
2. **Redeploy** so the build picks it up.

### Notes

- Render's free tier stores SQLite on an **ephemeral** disk, so data resets on restarts and redeploys. For a durable database, add a Render disk and set `TODAY_DB_PATH` (e.g. `/mnt/data/today.db`).
- Free services **sleep** when idle; the first request can take 30–60s.
- Build out of memory: keep the build command `npm ci --omit=dev` (see `render.yaml`).
- Node version: the API needs **Node 22.13+**; `render.yaml` sets `NODE_VERSION=22`.
- Still stuck: check Render → your service → **Logs** for the failing build or deploy.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `TICKETMASTER_API_KEY` | Server | Real event data. Optional; without it, sample events are shown. |
| `PORT` | Server | Set automatically by most hosts (defaults to `4000`). |
| `TODAY_DB_PATH` | Server | Optional absolute path to the SQLite file. |
| `VITE_API_BASE` | Frontend build | API base URL ending in `/api`. Defaults to `/api` (Vite dev proxy). |

## Event sources

Ticketmaster is currently the only source. New sources go in `fetchExternalEvents` in `server/src/eventsProvider.js`; results from multiple sources are merged and deduplicated automatically.

- **Eventbrite** was removed: its public event search API was shut down in 2019–2020, and the current API only lists events owned by your own organization.
- **Google Places** was removed: it returned venues (not events) with made-up start times, and its photo URLs exposed the API key.
