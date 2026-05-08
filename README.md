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
- **Phase 4+:** AI features and external integrations — not yet implemented.

The schema swaps to PostgreSQL by changing `provider` in
`backend/prisma/schema.prisma` and updating `DATABASE_URL`.
