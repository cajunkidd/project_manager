# Internal Project Management Application

Monorepo implementing the project management app described in
`project_management_app_claude_code_roadmap.md`.

## Layout

- `backend/` — Node.js + TypeScript + Express + Prisma (SQLite for dev/test).
  Modules: auth, users, projects, tasks, comments, activity log, dashboard.
  Tested with Jest + Supertest against a real SQLite database.
- `frontend/` — React 18 + TypeScript + Vite + React Router. Pages: Login,
  Register, Dashboard, My Tasks, Projects (list + detail), Task detail, and a
  drag-and-drop Kanban Board (dnd-kit). Tested with Vitest + React Testing
  Library.
- `.github/workflows/ci.yml` — runs backend Jest suite (with Prisma generate)
  and frontend Vitest + production build on push/PR.

## Install

```bash
npm install
```

This installs both workspaces.

## Run the app locally

```bash
# 1. Start Postgres (Docker Compose). This also provisions the test DB.
docker compose up -d postgres

# 2. Apply migrations against the dev DB
cd backend
cp .env.example .env
npx prisma migrate deploy

# 3. Start the API on http://localhost:4000
npm run dev

# 4. In a second terminal, start the frontend on http://localhost:5173
cd ../frontend
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`.

If you prefer a non-Docker Postgres, point `DATABASE_URL` at any
PostgreSQL instance and run the same `prisma migrate deploy`.

## Run tests

```bash
npm test                # both workspaces
npm run test:backend    # backend only (Jest, integration against Postgres)
npm run test:frontend   # frontend only (Vitest, jsdom)
```

The backend suite resets the test database via `prisma migrate reset`
on every run; it expects `project_manager_test` to exist and to be
reachable at the URL in `tests/setupEnv.ts`. The provided
`docker-compose.yml` provisions it automatically.

## Roadmap status

- **Phase 0 — Foundation:** done. Schema, auth-ready middleware, modular
  backend.
- **Phase 1 — MVP:** done. Projects, Tasks (with subtasks), Comments,
  Activity log, Kanban board, My Tasks, Dashboard.
- **Phase 2 — Workflow engine:** done. In-app notifications (with @mention
  detection), intake form builder + submission flow that auto-creates tasks,
  trigger/action automation engine wired into the internal event bus.
- **Phase 3 — Reporting & visibility:** done. Reports (open-by-user,
  overdue, projects-by-status, completion-by-week, avg-completion, blocked),
  manager workload screen with overload highlighting, per-project timeline
  view with status-aware bars.
- **Phase 4 — AI features:** done. Provider-abstracted AI module with a
  deterministic local heuristic baseline (no LLM key required). Endpoints:
  per-project plain-language summary, project risk score (0–100 with
  factor breakdown), and task extraction from pasted text. UI: AI summary
  + risk badge on project detail, dedicated AI Tasks page with reviewable
  suggestions before batch-create.
- **Phase 5 — Integrations:** done. Provider-abstracted email module with a
  capturing stub used by tests, listeners that send on task assignment and
  @mention, an inbound-email ingest endpoint that creates tasks (admin-only),
  and a daily-digest endpoint. Public token-authenticated REST API at
  `/api/v1/*` backed by hashed API tokens with scoped permissions. Webhook
  subscriptions hooked into the internal event bus, delivering signed
  (HMAC-SHA256) JSON payloads with delivery records (status, attempts,
  response body) for debugging. Admin Settings page provides token + webhook
  management with one-time secret reveal.
- **Phase 6 — Productionization:** done. Postgres replaces SQLite (proper
  Prisma migrations + docker-compose + CI service container). Real provider
  adapters wired behind the AI and email seams: Anthropic SDK
  (`AI_PROVIDER=anthropic`, `claude-opus-4-7`, adaptive thinking, JSON
  schema-constrained output) for AI summary + task extraction; nodemailer
  SMTP (`EMAIL_PROVIDER=smtp`) for outbound mail. Webhook delivery now
  retries with exponential backoff and records the attempt count. File
  attachments on tasks/projects (multer + local upload root, MIME allowlist,
  size cap, signed download). Task dependencies with cycle detection,
  surfaced in TaskDetail (depends-on / blocks) and as a count indicator on
  the Timeline.
- **Phase 7 — Daily-use UX:** done. Recurring tasks: a JSON recurrence
  rule on `Task` (interval / weekly presets), and when a recurring task
  transitions to done the next occurrence is auto-created with the same
  template and a forward-shifted due date — guarded against double-spawn
  on done → in_progress → done flicker. Global search at `/api/search`
  matches across tasks (title + description), projects (name + description),
  and comments (body); UI is a debounced topbar search box with a results
  dropdown plus a dedicated `/search` page. Bulk task operations:
  `PATCH /api/tasks/bulk` applies a partial patch (status / priority /
  assignee / project / due date) to many ids; `POST /api/tasks/bulk-delete`
  removes many ids. Failures are reported per-id without aborting the
  batch. My Tasks gains row checkboxes, select-all, and a bulk action bar
  for triage.
- **Phase 8 — Time tracking:** done. New `TimeEntry` model
  (taskId/userId/startedAt/endedAt/durationMs/note). Endpoints for
  start/stop, manual entry, edit, delete, current-active lookup, and a
  manager-only weekly summary at `/api/time-entries/summary`. Server
  enforces "one running timer per user" with a 409 on conflict and only
  the entry author (or admin/manager) can edit/delete. TaskDetail gets a
  live timer with elapsed seconds, total-logged-on-task, and an entry
  log; Workload page gains a per-user "hours this week" column plus a
  global stat card.

197 tests across both workspaces (154 backend integration + 43 frontend
unit). The platform runs against PostgreSQL via Docker Compose; production
deployments swap the dev DB URL and either keep the heuristic AI / stub
email defaults or set `AI_PROVIDER=anthropic` + `EMAIL_PROVIDER=smtp` with
the right credentials.
