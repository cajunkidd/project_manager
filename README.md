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
# 1. Initialize the dev SQLite database (one-time)
cd backend
cp .env.example .env
npx prisma db push

# 2. Start the API on http://localhost:4000
npm run dev

# 3. In a second terminal, start the frontend on http://localhost:5173
cd ../frontend
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`.

## Run tests

```bash
npm test                # both workspaces
npm run test:backend    # backend only (Jest, integration against SQLite)
npm run test:frontend   # frontend only (Vitest, jsdom)
```

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
- **Phase 6 — Live collaboration:** done. `ProjectMember` model with
  `owner`/`editor`/`viewer` roles; project creators are auto-added as owners,
  and `/api/projects/:id/members` endpoints handle invites, role changes, and
  leaves. Projects, project tasks, and project activity are filtered by
  membership; admins bypass. A Server-Sent Events endpoint at
  `/api/realtime/stream` bridges the internal event bus to connected clients,
  pushing `project.*`, `task.*`, and `comment.created` events to project
  members and assignees. The frontend `RealtimeProvider` + `useLiveUpdates`
  hook auto-refreshes the dashboard, project list/detail, board, my-tasks,
  and task-detail pages when another user makes a change.

The whole platform is implemented and tested — 168 tests across both
workspaces (134 backend integration + 34 frontend unit).

The schema swaps to PostgreSQL by changing `provider` in
`backend/prisma/schema.prisma` and updating `DATABASE_URL`.
