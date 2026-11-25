# Contributing

Thanks for working on Today. Setup, architecture, the API, and deployment live in [README.md](README.md). Branch names, commit messages, and agent rules live in [AGENTS.md](AGENTS.md). This file is the short path for people opening a change.

## Setup

1. Install Node **22.13+** (see `engines` in `package.json`).
2. Run `npm install`.
3. For real events, copy `.env.example` to `.env.local` and set `TICKETMASTER_API_KEY`. The app runs without a key and shows sample events.
4. Run `npm run dev`.
   - Frontend: http://localhost:5173
   - API: http://localhost:4000

Leave `.env.local` and `server/*.db` untracked.

## Branches and commits

Branch off `main`. Use `<type>/<short-description>` in lowercase with hyphens, for example `feat/saved-events` or `fix/sync-cache`.

Commit with Conventional Commits:

```text
<type>(<scope>): <description>
```

Example: `fix(api): skip stale area sync`.

Use one logical change per commit. Mark a breaking change with `!`, as in `feat(api)!: change discover response shape`. The full type list is in [AGENTS.md](AGENTS.md).

## Before you open a pull request

- Run `npm run lint`.
- Run `npm run build`.
- Exercise the flow you changed. There is no `npm test` script. For API changes, call the routes in the README (start with `GET /api/health`).

Describe what changed and how you checked it.

## Keep these in sync

- Category ids in `CATEGORY_OPTIONS` (`src/types/models.ts`) and `CATEGORY_TAGS` (`server/src/categoryTags.js`).
- Schema changes go in `initDb` in `server/src/db.js`.
- New event sources go in `fetchExternalEvents` in `server/src/eventsProvider.js`. Ticketmaster is the only source. Leave Eventbrite and Google Places out.
