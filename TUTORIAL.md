# Project Manager — User Tutorial

A walkthrough of the app, page by page, with the cool stuff called out and the
project management tools each idea was pulled from.

The features in this app are inspired by a mix of:
**Wrike, ClickUp, Microsoft Planner, Trello, Asana, Smartsheet, Jira,
GanttPRO,** and **Todoist**.

---

## 1. Getting started

1. Open the frontend at `http://localhost:5173`.
2. **Register** an account on `/register`. The first user can be promoted to
   admin via the database; subsequent users default to the `member` role.
3. **Log in** at `/login`. You'll land on the Dashboard.

The left sidebar is your main navigation. Admin/manager users see extra
sections (Reports, Workload, Automations, Settings).

---

## 2. Dashboard

The Dashboard is your "what matters right now" view: counts of open tasks,
overdue items, projects you own, and recent activity.

- **My open work + overdue counters** — *Todoist*-style "today / overdue"
  framing.
- **Recent activity feed** — *Asana*-style inbox of what changed.
- **Project cards with status pills** — *Microsoft Planner* dashboard tiles.

---

## 3. Projects

`/projects` lists every project you can see. Click one to open the detail
page with description, status, members, tasks, and AI insights.

Cool things on the project detail page:

- **Members & roles** — *Asana* project membership model.
- **AI summary card** — plain-language project summary generated on demand
  (*ClickUp AI* inspiration).
- **Risk badge (0–100)** — color-coded risk score with factor breakdown
  (*Wrike Work Intelligence* risk prediction).
- **Activity timeline per project** — *Jira* issue history feel, scoped to
  the project.

---

## 4. Tasks

Tasks live inside projects and have:

- Title, description, status, priority, due date.
- **Assignee** + watchers.
- **Subtasks** (nested under a parent task) — *Asana* / *ClickUp* subtask
  hierarchy.
- **Comments** with **@mentions** that fire notifications — *Jira* /
  *Asana*-style mentions.
- **Activity log** per task — *Jira* change history.

Open `/tasks/:id` for the full detail view.

### My Tasks

`/my-tasks` shows everything assigned to you across projects, grouped by
status. This is the *Todoist* / *Asana* "My Tasks" pattern — one place to
see your personal queue without switching projects.

---

## 5. Kanban Board

`/board` is a drag-and-drop board built with `dnd-kit`. Columns map to task
status (Todo / In Progress / Blocked / Done). Drag a card across columns to
update its status.

- **Drag-and-drop columns** — *Trello*, the original.
- **WIP-friendly columns and swimlanes** — *Jira* board layout.
- **Card priority + due date chips** — *ClickUp* card density.

---

## 6. Timeline

`/timeline` renders a per-project Gantt-style timeline. Each task is a bar
between its start and due dates, color-coded by status.

- **Gantt bars with status colors** — *GanttPRO*.
- **Project rows / task lanes** — *Smartsheet* grid-meets-timeline.
- **Overdue highlighting** — *Wrike* timeline overdue cues.

---

## 7. Intake Forms

`/forms` is a no-code form builder. Build a form, share the public submit
link (`/f/:slug`), and every submission auto-creates a task in the project
you map it to.

- **Drag-style form builder with field types** — *Wrike Request Forms*.
- **Public submission link** — *Asana Forms* / *ClickUp Forms* intake flow.
- **Auto-create a task from a submission** — *Jira Service Management*
  request → ticket flow.

Admins can edit forms via the **Form Builder** page; everyone with the link
can submit.

---

## 8. Automations

`/automations` (admin/manager) lets you wire triggers to actions on the
internal event bus. Examples: "when a task is created in Project X, assign
to Alice" or "when status becomes Blocked, notify the manager."

- **If-this-then-that rule builder** — *ClickUp Automations* /
  *Asana Rules*.
- **Trigger/action vocabulary** — *Jira Automation*.
- **Internal event bus** — every domain event (task.created, comment.added,
  status.changed, etc.) is available as a trigger.

---

## 9. AI Tasks

`/ai/tasks` is the AI helper. Paste a meeting transcript, brief, or email
into the box and the app extracts a list of suggested tasks. Review each
suggestion (edit title, assignee, project, priority) and batch-create them.

- **Extract tasks from free text** — *ClickUp AI* / *Asana Intelligence*.
- **Reviewable suggestions before commit** — *Notion AI* draft-then-accept
  pattern.
- **Provider-abstracted AI** — there's a deterministic local heuristic that
  works with no LLM key, so the feature is always demoable.

The project detail page also uses the AI module for the **summary** and
**risk** outputs.

---

## 10. Notifications

The bell icon in the topbar and `/notifications` show in-app notifications:

- **Task assigned to you.**
- **@mention in a comment.**
- **Automation-triggered notifications.**

This is the *Asana* / *Jira* inbox pattern — notifications stay in-app and
can also be sent by email (see Integrations).

---

## 11. Reports (admin/manager)

`/reports` ships with built-in reports:

- Open tasks by user
- Overdue tasks
- Projects by status
- Completion by week (trend chart)
- Average completion time
- Blocked tasks

Inspirations:

- **Pre-built operational reports** — *Wrike Analyze* / *Smartsheet*
  reports.
- **Burn-down / completion trend** — *Jira* sprint reports.
- **Workload distribution** — see next section.

---

## 12. Workload (admin/manager)

`/workload` shows each team member's open task count and flags people who
are over a configurable threshold ("overload").

- **Workload view with overload highlighting** — *Wrike Workload* /
  *Asana Workload*.
- **At-a-glance capacity per person** — *ClickUp Workload* view.

---

## 13. Settings (admin)

`/settings` is where admins manage integrations.

### API tokens

- Generate scoped API tokens that hit the public REST API at `/api/v1/*`.
- Secrets are shown **once** at creation, then stored hashed.
- Inspired by *GitHub* personal access tokens and *Linear*'s API key UX.

### Webhooks

- Subscribe an external URL to internal events.
- Payloads are **HMAC-SHA256 signed** with a per-subscription secret.
- Each delivery is recorded (status, attempts, response body) for debugging.
- Inspired by *GitHub* webhooks and *Stripe*'s delivery log.

### Email

- **Outbound:** task-assignment and @mention emails via a provider-abstracted
  email module.
- **Inbound:** an admin-only endpoint that turns an inbound email into a
  task.
- **Daily digest:** rollup email endpoint.
- Inspired by *Asana*'s email-to-task and *Basecamp*-style daily digests.

---

## Feature → inspiration cheat sheet

| Feature                          | Inspired by                          |
| -------------------------------- | ------------------------------------ |
| Drag-and-drop Kanban board       | Trello, Jira                         |
| Subtasks + nested hierarchy      | Asana, ClickUp                       |
| My Tasks personal queue          | Todoist, Asana                       |
| @mentions in comments            | Jira, Asana                          |
| Project activity timeline        | Jira                                 |
| Gantt timeline view              | GanttPRO, Smartsheet, Wrike          |
| Dashboard tiles                  | Microsoft Planner                    |
| Intake / request forms           | Wrike, Asana, ClickUp, Jira SM       |
| Automation rules engine          | ClickUp, Asana, Jira Automation      |
| AI project summary + risk score  | ClickUp AI, Wrike Work Intelligence  |
| AI task extraction from text     | ClickUp AI, Notion AI                |
| Workload + overload view         | Wrike, Asana, ClickUp                |
| Pre-built reports                | Wrike Analyze, Smartsheet, Jira      |
| In-app notifications inbox       | Asana, Jira                          |
| Email-to-task ingest             | Asana                                |
| Daily digest email               | Basecamp-style                       |
| Public REST API + scoped tokens  | GitHub, Linear                       |
| Signed webhooks + delivery log   | GitHub, Stripe                       |

---

## Quick task: end-to-end walkthrough

A 60-second tour to try every major surface:

1. **Register** two users (one will be the assignee).
2. **Create a project** from `/projects`.
3. **Add a task**, set a due date, assign it to the second user.
4. Open `/board` and drag the task from *Todo* → *In Progress*.
5. Add a comment with `@second-user` — they get an in-app notification.
6. Go to `/ai/tasks`, paste 3–4 sentences of "meeting notes," and let the
   app suggest tasks. Accept one into the project.
7. Build a form at `/forms`, copy the public link, submit it from an
   incognito tab, and watch the new task appear in the project.
8. As an admin, open `/automations` and create a rule: "when task is created
   in this project, notify me."
9. Visit `/reports` and `/workload` to see the team rollups.
10. In `/settings`, mint an API token and try `GET /api/v1/projects` with
    `Authorization: Bearer <token>`.

That covers every phase of the roadmap.
