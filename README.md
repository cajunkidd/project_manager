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
- **Phase 6 — Attachments and task dependencies:** done. File attachments on
  tasks and projects, with mime-type allowlist and a 5 MB size cap; binary
  payload is stored base64-encoded in the database. Authenticated download
  endpoint streams the original bytes with the correct filename. Task
  dependencies expose a `blocked-by` / `blocks` graph with cycle detection,
  and the task detail screen surfaces an `isBlocked` badge plus add/remove
  controls. Attachments cascade on parent task/project delete.
- **Phase 7 — Recurring tasks:** done. Template-plus-cadence rules
  (daily/weekly/monthly with an interval) that produce real tasks on a
  schedule. The service exposes a `run-due` endpoint (admin/manager only)
  that finds rules whose `nextRunAt <= now`, creates the corresponding
  task with optional due-date offset, advances `nextRunAt`, and pauses
  the rule once any configured `endAt` has passed. Generated tasks emit
  the same `task.created` / `task.assigned` events used elsewhere, so
  notifications, webhooks, and automations all fire. Admin UI at
  `/recurring-tasks` lists, creates, pauses, resumes, deletes, and
  triggers the next run manually.
- **Phase 8 — Project templates:** done. Reusable project blueprints
  (name, description, default priority, department) plus an ordered list
  of template tasks (title, description, priority, `dueOffsetDays`).
  `POST /api/project-templates/:id/instantiate` creates a fresh project,
  pre-populates it with the canned tasks (computing due dates from the
  caller-supplied `startDate` plus each task's offset), and emits the
  standard `project.created` / `task.created` events. Admin UI at
  `/project-templates` lists, creates, updates, deletes templates, and
  instantiates them straight into the Project Detail page.

The whole platform is implemented and tested — 180 tests across both
workspaces (146 backend integration + 34 frontend unit).

The schema swaps to PostgreSQL by changing `provider` in
`backend/prisma/schema.prisma` and updating `DATABASE_URL`.
