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

## Download + double-click launch (Windows)

For non-developer users who just want to run the app on a Windows machine,
the repository ships with a launcher under `launcher/windows/`.

1. **Install Node.js LTS** (one time, from <https://nodejs.org>). The
   launcher uses the bundled `node`, `npm`, and `npx`.
2. **Download the repository** as a ZIP from GitHub (Code → Download ZIP)
   and extract it anywhere — e.g. `C:\Apps\project_manager`.
3. **Create the desktop shortcut**: open the extracted folder, go into
   `launcher\windows\`, and double-click `Create Desktop Shortcut.bat`.
   This adds a "Project Manager" shortcut to your desktop.
4. **Launch the app**: double-click the desktop shortcut. On first run the
   launcher installs dependencies, generates the database, and builds the
   frontend (a few minutes). On subsequent runs it boots in seconds and
   opens the app in your default browser at `http://localhost:4000`.

The launcher window stays open while the app is running — close it to
stop the server. The SQLite database lives at
`backend/project-manager.db` so your data persists between launches.

Environment overrides (optional, set before launching):

- `PROJECT_MANAGER_PORT` — change the port (default `4000`).
- `JWT_SECRET` — production deployments should set this to a long random
  string.
- `DATABASE_URL` — point at a different SQLite file or a PostgreSQL
  database.

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

The whole platform is implemented and tested — 156 tests across both
workspaces (122 backend integration + 34 frontend unit).

The schema swaps to PostgreSQL by changing `provider` in
`backend/prisma/schema.prisma` and updating `DATABASE_URL`.
