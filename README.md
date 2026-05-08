# Internal Project Manager

Foundation scaffold for the internal project management application described in
[`project_management_app_claude_code_roadmap.md`](./project_management_app_claude_code_roadmap.md).

This is the **Phase 0 / Phase 1 MVP slice**: users, projects, tasks (with subtasks),
comments, activity logs, a basic dashboard, and a Kanban board.

## Stack

- **Backend** — Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod
- **Frontend** — React (Vite), TypeScript, Tailwind CSS, React Router, TanStack Query
- **Monorepo** — npm workspaces

## Project layout

```
backend/    Express + Prisma API
frontend/   Vite + React + Tailwind app
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or remote)

## Setup

```bash
# from repo root
npm install

# configure backend env
cp backend/.env.example backend/.env
# edit DATABASE_URL to point at your Postgres

# generate Prisma client and apply migrations
npm --workspace backend run db:generate
npm --workspace backend run db:migrate -- --name init

# seed sample IT department data
npm --workspace backend run db:seed
```

## Run

```bash
# both apps in parallel (Vite proxies /api -> http://localhost:4000)
npm run dev

# or individually
npm run dev:backend
npm run dev:frontend
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:4000  (health: `/health`)

## What's implemented

| Area | Endpoints / UI |
|---|---|
| Users | CRUD (`/api/users`), Settings page |
| Projects | CRUD + filters (`/api/projects`), list, detail |
| Tasks | CRUD + status / reorder (`/api/tasks`), subtasks, filters |
| Comments | Per-task and per-project (`/api/comments`) |
| Activity log | Auto-recorded on create/update/delete; per-project view |
| Dashboard | `/api/dashboard/me`, `/api/dashboard/manager` |
| Kanban Board | Drag-and-drop status changes, assignee/project/priority filters, overdue highlighting |
| Notifications | `/api/notifications`, in-app bell with unread badge; triggers on assignment changes and `@mentions` in comments |
| Reports | `/api/reports/tasks-by-user`, `overdue`, `projects-by-status`, `completed-by-week`, `avg-completion-time`, `blocked` |
| Workload | `/api/reports/workload` per-user counts (open/overdue/urgent/due-this-week/done-this-week) with overload highlighting |
| Intake Forms | `/api/forms` CRUD, `/api/forms/:id/submit` creates a task in the form's default project; admin field editor (text, textarea, dropdown, checkbox, date, user picker) |
| Automations | `/api/automations` CRUD; trigger/action engine fires on `task_created`, `task_status_changed`, `comment_created`, `form_submitted`. Actions: `send_notification`, `assign_user`, `change_status`, `change_priority`, `add_comment`. Conditions are equality matches against the event entity. |
| AI features | `/api/ai/risk/:id` (deterministic), `/api/ai/summary/:id` (Claude Opus 4.7 with adaptive thinking), `/api/ai/extract-tasks` (structured outputs). UI on the project detail page: risk badge, AI summary, paste-notes-extract-tasks dialog with review-before-create. AI endpoints return 503 unless `ANTHROPIC_API_KEY` is set. |
| Timeline (Gantt) | `/timeline` — horizontal SVG view of tasks with start/due dates, color-coded by status/priority, today line, click-to-open drawer. Filter by project. |
| Overdue scheduler | Background scanner runs every 5 minutes (`OVERDUE_SCAN_MS` to override), fires the `task_due_date_passed` automation trigger and notifies assignees the first time a task crosses its due date. Dedupes via the activity log so it survives restarts. |
| API tokens | `/api/api-tokens` issue/revoke; tokens are `pm_…`, hashed at rest, shown once at creation. |
| External API | `/api/v1/{tasks,projects}` token-authed surface (Bearer auth) for external systems. |
| Outbound webhooks | `/api/webhooks` subscribe URLs to events (`task_created`, `task_updated`, `project_created`, `project_updated`, `form_submitted`). Bodies signed with HMAC-SHA256 in `X-PM-Signature`; `X-PM-Event` carries the event type. Per-subscription delivery log. |
| Deep links | `?task=<id>` opens the task drawer anywhere; the bell deep-links into it |

There is **no auth yet**. The frontend uses a simple "acting as" user switcher
(persisted in `localStorage`) so the dashboard and write actions can attribute
the current user. SSO (Microsoft Entra) is on the Phase 5 roadmap.

## Roadmap

See [`project_management_app_claude_code_roadmap.md`](./project_management_app_claude_code_roadmap.md).
Next milestone candidates per the roadmap:

- Notifications (Phase 2)
- Intake forms + automation engine (Phase 2)
- Reporting & workload screens (Phase 3)
- Gantt / timeline (Phase 3)
- AI summary, task extraction, risk score (Phase 4)
