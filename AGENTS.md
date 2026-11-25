# Agent instructions

Follow these conventions for all work in this repository. Read this file, `README.md`, and `CONTRIBUTING.md` before making changes. `README.md` is the source of truth for architecture, the API, the database schema, and deployment. `CONTRIBUTING.md` is the human workflow for setup, branches, and pull requests.

## 1. Git Branch Naming

Use the format:

`<type>/<short-description>`

Supported prefixes:

- `feat/` — New features
- `fix/` — Bug fixes
- `hotfix/` — Urgent production fixes
- `refactor/` — Code restructuring
- `style/` — Styling and visual changes
- `docs/` — Documentation
- `test/` — Tests
- `chore/` — Maintenance and tooling
- `perf/` — Performance improvements
- `build/` — Build system changes
- `ci/` — CI/CD changes

Examples:

- `feat/user-authentication`
- `fix/login-error`
- `style/branding`
- `docs/api-reference`

Branch naming rules:

- Use lowercase.
- Separate words with hyphens.
- Keep names concise and descriptive.
- Use the most appropriate prefix for the work.

## 2. Commit Message Conventions

Follow Conventional Commits:

`<type>(<scope>): <description>`

Use the same types as branch naming: `feat`, `fix`, `hotfix`, `refactor`, `style`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.

Examples:

- `feat(auth): add OAuth support`
- `fix(api): resolve connection timeout`
- `style(branding): update logo and visual identity`
- `docs(readme): update installation instructions`
- `refactor(database): simplify query handling`

Scopes should identify the relevant component or area of the codebase (for example `home`, `onboarding`, `api`, `events`, `db`).

Commit messages should:

- Be concise and descriptive.
- Use imperative language.
- Describe the actual changes.
- Represent one logical change per commit.
- Include `!` when indicating breaking changes (for example `feat(api)!: change discover response shape`).

## 3. General Git Guidelines

- Never commit directly to the main or master branch unless explicitly instructed.
- Create an appropriately named feature or fix branch before making changes when starting new work.
- Do not create commits unless explicitly requested or the existing workflow requires them.
- Do not amend, rebase, force-push, or rewrite existing history without explicit permission.
- Avoid including unrelated changes in commits.
- Inspect `git status` before committing.
- Never discard existing user changes.

## 4. Agent Responsibilities

- Follow these conventions for all Git operations.
- Check existing repository instructions before making changes.
- Prefer consistency with established project patterns.
- Do not invent new naming conventions when an appropriate existing convention applies.
- Ask for clarification when a requested operation could overwrite or discard user work.

## 5. Project-Specific Instructions

Today is a local event-discovery app: a swipe deck of events in the next 48 hours, a saved-events calendar, and settings. There are no user accounts. Each browser stores a random session id in `localStorage` (`today.session.id`); preferences and swipes are tied to that id.

### Architecture

- **Frontend** (`src/`): React 19 + TypeScript, Vite, React Router. Pages live in `src/pages/` (Home, My Events, Onboarding, Settings). UI components are in `src/components/`. Session, location, settings, and formatting helpers are in `src/lib/`. The typed API client is `src/api/client.ts`. Shared types and `CATEGORY_OPTIONS` are in `src/types/models.ts`.
- **Backend** (`server/src/`): Node.js ESM + Express 5. Routes and the app entry are `server/src/index.js`. Request validation uses `zod`. SQLite is Node's built-in `node:sqlite` (`server/src/db.js`); the default file is `server/today.db`.
- **Hosting:** the frontend is a static Vite build (Vercel, `vercel.json`). The API is a separate Node service (Render, `render.yaml`). Locally, Vite proxies `/api` to `http://localhost:4000`.
- **Events:** Ticketmaster Discovery API via `server/src/eventsProvider.js`. Without `TICKETMASTER_API_KEY`, the app serves built-in sample events. New sources belong in `fetchExternalEvents`; `server/src/eventAggregation.js` merges and dedupes them.

See `README.md` for the API table, ranking rules, schema, and deploy steps.

### Languages and standards

- Frontend is TypeScript with `strict`, `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` (`tsconfig.app.json`). JSX is `react-jsx`.
- The server is plain JavaScript (ESM), not TypeScript.
- ESLint covers `**/*.{ts,tsx}` only (`npm run lint`): recommended JS, typescript-eslint, react-hooks, and react-refresh. There is no Prettier config.
- Match existing file style. Do not reformat unrelated code.

### Commands

Requires **Node 22.13+** (`package.json` engines: `>=22.13.0 <26`).

- `npm install` — install dependencies.
- `npm run dev` — frontend (http://localhost:5173) and API (http://localhost:4000) together.
- `npm run dev:client` / `npm run dev:server` — run one side.
- `npm run build` — `tsc -b` then `vite build`. Output is `dist/`.
- `npm run lint` — ESLint.
- `npm start` — production API (`node server/src/index.js`).

Optional local secrets: copy `.env.example` to `.env.local`. `server/src/env.js` loads `.env.local`. Do not commit `.env.local` or `server/*.db` (both are gitignored).

### Testing

There is no test runner and no `npm test` script. Verify behavior by running the app and, for API changes, calling the routes documented in `README.md` (health check: `GET /api/health`).

### Constraints

- Keep category ids in sync between `CATEGORY_OPTIONS` in `src/types/models.ts` and `CATEGORY_TAGS` in `server/src/categoryTags.js`.
- Schema changes belong in `initDb` in `server/src/db.js`. New columns and tables are applied on startup.
- Area sync is cached for 30 minutes unless the client sends `force: true`.
- Do not reintroduce Eventbrite or Google Places as event sources.
- Render's API build command is `npm ci --omit=dev` because the database uses built-in `node:sqlite`. The API needs Node 22.
- Frontend production API base is `VITE_API_BASE` (must end in `/api`). It defaults to `/api` for the Vite dev proxy.
