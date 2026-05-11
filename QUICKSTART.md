# Quickstart — testing the app

A short checklist for downloading the app, getting it running, and walking
through the major features. Estimated time: 10–15 minutes plus the
one-time first-run build.

## 1. Install + launch (Windows)

1. Install Node.js LTS from <https://nodejs.org> (one time).
2. On GitHub, click **Code → Download ZIP** and extract anywhere
   (e.g. `C:\Apps\project_manager`).
3. Open `launcher\windows\` and **double-click `Create Desktop Shortcut.bat`**
   once. It adds a "Project Manager" shortcut to your desktop.
4. **Double-click the desktop shortcut.** First run installs everything,
   builds the frontend, and creates the database. Allow a few minutes.
   The browser opens automatically at `http://localhost:4000` once ready.

Close the launcher console window to stop the server. The SQLite database
lives at `backend\project-manager.db`; deleting it resets the install.

## 2. First-time setup inside the app

1. **Register** — the first user you create is automatically promoted to
   **admin**, so use your own email here.
2. **Create a project** — Projects → New project.
3. **Add a few tasks** with different statuses, due dates, and priorities so
   the dashboards have data to display.

## 3. Tour of features

### Core workflow
- **Dashboard** — overdue/due-this-week summary; updates polled every 15s.
- **My Tasks** — your assigned work, with quick-status changes.
- **Projects → \<project\>** — task list, AI summary panel, risk badge.
- **Board** — drag tasks between status columns (Kanban).
- **Timeline** — Gantt-style view per project.
- **Notifications bell** — bell icon in the top right; triggered on
  assignment and @mention in comments.

### AI features
- **AI Tasks** (sidebar) — paste rough text, get a list of suggested tasks
  to review and batch-create.
- **AI Insights** (admin sidebar) — six tabs:
  1. *Weekly summary* — exec-level overview with top risks and stalled projects.
  2. *Auto-prioritize* — tasks with priorities that should change, with reasons.
  3. *Cleanup* — stale or under-specified tasks.
  4. *Duplicates* — likely-duplicate task pairs (Jaccard similarity ≥ 60%).
  5. *Meeting notes → tasks* — paste minutes, get attendees / decisions /
     action items with assignees + due dates.
  6. *Email thread* — paste a message, get a summary plus action items.

### Integrations (Settings → admin only)
- **API tokens** — issue scoped Bearer tokens for the public API at `/api/v1/*`.
- **Webhooks** — HMAC-signed outbound webhooks for task/project/comment events.
- **Gmail** — connect a user's Gmail; label messages with `ProjectManager`
  (configurable) and they ingest as tasks. Requires
  `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in the launcher env — see
  the main README for OAuth client setup.
- **External systems** — register Teams (webhook URL), or ERP/Asset/Intranet
  systems with a URL template like `https://erp.example.com/wo/{id}`.
  Teams systems receive MessageCards for events.
- **Monday import** — paste or upload a Monday.com JSON export to create
  projects/tasks/users. Status and priority enums are normalized.

### Other integration touch points
- **Outlook calendar feed** — Settings → Gmail tab shows your personal
  signed `.ics` URL. In Outlook: *Add calendar → From internet*.
- **Intranet portal intake** — `POST /api/integrations/intake` authed with
  an API token (scope `tasks:write`) creates a task + external link in one call.
- **Forms** — `/forms` is a public form builder; submissions auto-create tasks.
- **Automations** — admin-only `/automations` page for trigger/action rules.

## 4. Multi-user / LAN testing

Other people on the same network reach the host PC at
`http://<host-ip>:4000` (not `localhost`). Two requirements on the host:

1. Allow the port through Windows Firewall (one-time `netsh advfirewall
   firewall add rule` or the firewall UI).
2. Leave the launcher window running.

Data is shared because everyone hits the same SQLite database on the host
machine. UI updates are pulled every 15 seconds — not push — so changes
appear with at most a 15-second lag.

## 5. Things to try as a sanity check

- Open two browser tabs as different users. In tab A, assign a task to
  the user in tab B; within 15s, the task appears in tab B's "My Tasks".
- Create five tasks with very similar titles, then visit
  *AI Insights → Duplicates* and confirm they cluster together.
- Mark a task overdue (set due date to yesterday), then run
  *AI Insights → Auto-prioritize* and confirm it suggests bumping the
  priority.
- Create a task via a public-API token to confirm the integrations path:
  ```bash
  curl -X POST http://<host>:4000/api/v1/tasks \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"title":"Programmatic task","priority":"high"}'
  ```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Launcher exits saying Node.js was not found | Install Node.js LTS, then re-run. |
| Browser shows "Cannot GET /" | The frontend build did not run. Delete `.launcher-bootstrapped` in the repo root and relaunch to redo first-run setup. |
| Gmail OAuth says "not configured" | Set `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in the launcher environment; see README. |
| Forgot admin password | Stop the launcher, delete `backend\project-manager.db`, relaunch, and register again — the first new user becomes admin. |
| Want a different port | Set `PROJECT_MANAGER_PORT` before launching. |
