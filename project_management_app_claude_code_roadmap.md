# Internal Project Management Application Roadmap

## Purpose

This document is a build-ready roadmap for creating an internal project management application using Claude Code or another coding agent. It includes:

- Feature roadmap
- Claude-ready prompt pack
- Recommended technical stack
- Database schema
- API endpoint plan
- UI screen plan
- Rollout strategy

The goal is to build a practical internal tool that starts simple, gets adopted quickly, and can grow into a full project/work management platform.

---

# 1. Product Vision

Build an internal project management platform that combines the best practical features from tools like Wrike, ClickUp, Microsoft Planner, Trello, Asana, Smartsheet, Jira, GanttPRO, and Todoist.

The application should focus on:

1. Simple task and project tracking
2. Clear ownership and accountability
3. Internal request intake
4. Team collaboration
5. Reporting and visibility
6. Automation
7. Future AI-assisted workflows

The first version should not try to replace every commercial tool. It should solve the company’s immediate workflow problems first.

---

# 2. Recommended Product Strategy

## Build Philosophy

Start with a focused internal MVP, then expand.

Avoid trying to build every feature at once. The fastest way to kill adoption is to launch something that feels bloated, confusing, or unfinished.

## Recommended First Department

Start with the IT department.

IT is a strong pilot department because it naturally handles:

- Requests
- Projects
- Deadlines
- Assignments
- Escalations
- Documentation
- Cross-department communication

Once the IT workflow is stable, expand to other departments.

---

# 3. Feature Roadmap

## Phase 0 — Foundation

### Goal

Create the technical foundation so future features are easier to build.

### Features

- User authentication
- Role-based access control
- Organization/company structure
- Basic application shell
- Database setup
- API setup
- Audit/activity logging foundation

### User Roles

| Role | Purpose |
|---|---|
| Admin | Full system access |
| Manager | Manage projects, tasks, users, reports |
| User | Create, view, and update assigned work |
| Viewer | Read-only access where needed |

### Claude Code Prompt

```text
Create the foundation for an internal project management web application.

Use this stack:
- React frontend
- Tailwind CSS
- Node.js with Express or NestJS backend
- PostgreSQL database
- Prisma ORM

Build:
1. User model
2. Role-based access control
3. Project model
4. Task model
5. Comment model
6. Activity log model
7. Authentication-ready structure
8. Base frontend layout with sidebar, top navigation, and main content area

Keep the application modular so additional features can be added later.
```

---

## Phase 1 — MVP

### Goal

Get users working inside the system as quickly as possible.

### Core Features

1. Projects
2. Tasks
3. Subtasks
4. Kanban board
5. Comments
6. Assigned-to-me dashboard
7. Overdue task view
8. Basic notifications

---

## 3.1 Projects

### Requirements

Each project should include:

- Project name
- Description
- Owner
- Status
- Priority
- Start date
- Due date
- Department/team
- Created by
- Created date
- Updated date

### Project Status Options

| Status | Meaning |
|---|---|
| Not Started | Project has been created but work has not begun |
| Active | Project is currently being worked |
| On Hold | Project is paused |
| Completed | Project is finished |
| Cancelled | Project was stopped |

### Claude Code Prompt

```text
Build the project management module.

Create backend CRUD endpoints and frontend screens for projects.

Each project needs:
- id
- name
- description
- owner_id
- status
- priority
- start_date
- due_date
- department
- created_by
- created_at
- updated_at

Frontend screens:
1. Project list
2. Project detail page
3. Create project form
4. Edit project form

Include filtering by status, owner, department, and priority.
```

---

## 3.2 Tasks

### Requirements

Each task should include:

- Task title
- Description
- Project
- Assigned user
- Status
- Priority
- Due date
- Parent task ID for subtasks
- Labels/tags
- Attachments
- Created by
- Created date
- Updated date

### Task Status Options

| Status | Meaning |
|---|---|
| Backlog | Captured but not ready |
| To Do | Ready to work |
| In Progress | Currently being worked |
| Waiting | Blocked or waiting on someone else |
| Review | Awaiting review or approval |
| Done | Completed |
| Cancelled | No longer needed |

### Priority Options

| Priority | Meaning |
|---|---|
| Low | Non-urgent |
| Normal | Standard priority |
| High | Important |
| Urgent | Immediate attention required |

### Claude Code Prompt

```text
Build the task management module.

Create task CRUD endpoints and frontend components.

Task fields:
- id
- project_id
- parent_task_id
- title
- description
- status
- priority
- assigned_to
- created_by
- due_date
- completed_at
- created_at
- updated_at

Requirements:
1. Allow tasks to belong to projects
2. Allow subtasks using parent_task_id
3. Allow filtering by status, assigned user, priority, due date, and project
4. Allow users to update task status
5. Track all major changes in the activity log
```

---

## 3.3 Kanban Board

### Requirements

The Kanban board should allow drag-and-drop movement between statuses.

Default columns:

1. Backlog
2. To Do
3. In Progress
4. Waiting
5. Review
6. Done

### Claude Code Prompt

```text
Build a Kanban board for tasks.

Use drag-and-drop functionality.

Columns should be based on task status:
- Backlog
- To Do
- In Progress
- Waiting
- Review
- Done

Requirements:
1. Dragging a task to a new column updates its status in the database
2. Show task title, priority, assignee, due date, and project
3. Highlight overdue tasks
4. Allow filtering by project, assigned user, and priority
5. Persist order within each column
```

---

## 3.4 Comments and Mentions

### Requirements

Users should be able to comment on tasks and projects.

Features:

- Add comment
- Edit own comment
- Delete own comment
- Mention users with @username
- Store comment history
- Notify mentioned users

### Claude Code Prompt

```text
Create a comments module for tasks and projects.

Requirements:
1. Comments can belong to either a task or a project
2. Users can create, edit, and delete their own comments
3. Support @mentions
4. When a user is mentioned, create a notification
5. Show comments in chronological order
6. Add comment activity to the activity log
```

---

## 3.5 Dashboard

### Requirements

Create a simple dashboard for users and managers.

### User Dashboard

Show:

- My open tasks
- My overdue tasks
- Tasks due this week
- Recently updated tasks
- Mentions

### Manager Dashboard

Show:

- Open tasks by user
- Overdue tasks by user
- Projects by status
- Tasks completed this week
- Blocked/waiting tasks

### Claude Code Prompt

```text
Build dashboard pages for users and managers.

User dashboard:
- My open tasks
- My overdue tasks
- Tasks due this week
- Recent mentions
- Recently updated tasks

Manager dashboard:
- Open tasks by user
- Overdue tasks by user
- Projects by status
- Tasks completed this week
- Waiting or blocked tasks

Create backend summary endpoints that return aggregated counts and task lists.
```

---

# 4. Phase 2 — Workflow Engine

## Goal

Move beyond basic task tracking and start reducing manual work.

---

## 4.1 Intake Forms

### Why This Matters

Intake forms are one of the highest-value features for internal adoption.

They allow users to submit requests without needing to understand the full project management system.

### Requirements

- Form builder
- Custom fields
- Department routing
- Auto-create task or project
- Required fields
- File attachments
- Submission history

### Example Use Cases

| Form | Result |
|---|---|
| IT Request | Creates task in IT queue |
| New Project Request | Creates project draft |
| Marketing Request | Creates marketing task |
| Safety Request | Creates safety task |
| Maintenance Request | Creates operations task |

### Claude Code Prompt

```text
Build an intake form system.

Requirements:
1. Admins can create custom forms
2. Forms can have fields including text, textarea, dropdown, checkbox, date, file upload, and user picker
3. Form submissions create tasks automatically
4. Each form can define default project, default assignee, default priority, and default status
5. Store all form submissions in the database
6. Allow users to view their submitted requests
7. Allow managers to view all submissions for their department
```

---

## 4.2 Automation Rules

### Requirements

Create a simple trigger/action automation engine.

### Example Automations

| Trigger | Action |
|---|---|
| Task created | Assign to default owner |
| Status changed to Done | Notify project owner |
| Due date passed | Mark overdue and notify assignee |
| Priority changed to Urgent | Notify manager |
| Form submitted | Create task in selected project |

### Claude Code Prompt

```text
Build a basic automation engine.

Use a trigger/action model.

Supported triggers:
- task_created
- task_updated
- task_status_changed
- task_due_date_passed
- comment_created
- form_submitted

Supported actions:
- send_notification
- assign_user
- change_status
- change_priority
- add_comment
- create_task

Store automation rules in the database.

Make the engine modular so new triggers and actions can be added later.
```

---

## 4.3 Notifications

### Requirements

Support in-app notifications first. Email notifications can come later.

Notification events:

- Task assigned
- Task due soon
- Task overdue
- Mentioned in comment
- Status changed
- Project updated
- Form submitted

### Claude Code Prompt

```text
Build an in-app notification system.

Requirements:
1. Create notifications for task assignments, mentions, overdue tasks, and status changes
2. Notifications should have read/unread status
3. Users should see notification count in the top navigation
4. Users should have a notification dropdown
5. Add backend endpoints to list notifications and mark them as read
```

---

# 5. Phase 3 — Reporting and Visibility

## Goal

Give managers and leadership clear visibility into work status.

---

## 5.1 Reports

### Core Reports

| Report | Purpose |
|---|---|
| Open Tasks by User | See workload distribution |
| Overdue Tasks | Identify missed deadlines |
| Projects by Status | See project pipeline |
| Tasks Completed by Week | Track productivity |
| Average Completion Time | Understand workflow speed |
| Blocked Tasks | Find bottlenecks |

### Claude Code Prompt

```text
Build reporting endpoints and frontend report pages.

Reports needed:
1. Open tasks by user
2. Overdue tasks
3. Projects by status
4. Tasks completed by week
5. Average task completion time
6. Blocked or waiting tasks

Add filters for:
- date range
- department
- project
- user
- priority
- status

Display reports using clean charts and tables.
```

---

## 5.2 Workload Management

### Requirements

Show how much work is assigned to each person.

Metrics:

- Open tasks per user
- Urgent tasks per user
- Overdue tasks per user
- Tasks due this week
- Estimated hours if available later

### Claude Code Prompt

```text
Build a workload management screen.

Show each user with:
- total open tasks
- overdue tasks
- urgent tasks
- tasks due this week
- tasks completed this week

Allow managers to filter by department and project.

Add visual indicators for overloaded users.
```

---

## 5.3 Timeline / Gantt View

### Requirements

Add timeline planning for larger projects.

Features:

- Start date
- End date
- Task dependencies
- Milestones
- Drag-to-adjust dates
- Project-level timeline

### Claude Code Prompt

```text
Build a project timeline/Gantt view.

Requirements:
1. Display project tasks on a horizontal timeline
2. Use task start_date and due_date
3. Support task dependencies
4. Show milestones
5. Allow drag adjustment of task dates
6. Highlight overdue tasks
7. Allow filtering by project and assignee
```

---

# 6. Phase 4 — AI Features

## Goal

Use AI to reduce administrative overhead and improve visibility.

---

## 6.1 AI Project Summary

### Requirements

Generate a plain-language summary of project status.

Summary should include:

- Overall project status
- Completed work
- Open work
- Overdue items
- Risks/blockers
- Recommended next steps

### Claude Code Prompt

```text
Build an AI project summary feature.

Input:
- project details
- tasks
- comments
- activity logs

Output:
- current project status summary
- completed work
- open work
- overdue items
- risks or blockers
- recommended next steps

Create a backend endpoint that prepares structured project context for the AI model.
Keep the AI output grounded only in application data.
```

---

## 6.2 AI Task Creation

### Requirements

Allow users to paste rough text and have AI generate tasks.

Example input:

```text
We need to replace the switch in Lake Charles, verify cabling, update documentation, and notify the store manager once complete.
```

Example output:

| Task | Assigned To | Priority |
|---|---|---|
| Replace switch in Lake Charles | Network Admin | High |
| Verify cabling | Network Admin | Normal |
| Update documentation | IT | Normal |
| Notify store manager | Project Owner | Normal |

### Claude Code Prompt

```text
Build an AI-assisted task creation feature.

Allow a user to paste a paragraph of text.
The AI should extract suggested tasks with:
- title
- description
- suggested assignee role
- suggested priority
- suggested due date if mentioned

Show the suggestions to the user for review before creating tasks.
Do not create tasks automatically without user confirmation.
```

---

## 6.3 AI Risk Detection

### Requirements

Flag risky projects based on:

- Overdue tasks
- No recent activity
- Too many blocked tasks
- Missed dependencies
- Unassigned tasks

### Claude Code Prompt

```text
Build a project risk scoring system.

Calculate risk based on:
- number of overdue tasks
- number of blocked tasks
- unassigned tasks
- days since last activity
- missed dependencies
- project due date proximity

Return a risk score from 0 to 100 and a plain-language explanation.
Add this to the project dashboard.
```

---

# 7. Phase 5 — Integrations

## Goal

Connect the application to existing company systems.

---

## 7.1 Email Integration

### Features

- Create task from email
- Email notifications
- Reply-to-task comment capture
- Daily task digest

### Claude Code Prompt

```text
Design an email integration module.

Features:
1. Create tasks from inbound email
2. Send email notifications for assignments and overdue tasks
3. Allow email replies to be added as task comments
4. Send daily digest emails to users

Keep provider logic modular so Microsoft 365 or Gmail can be used later.
```

---

## 7.2 API and Webhooks

### Features

- Public/internal API endpoints
- Webhook subscriptions
- External task creation
- Integration tokens

### Claude Code Prompt

```text
Build an API and webhook system.

Requirements:
1. Allow external systems to create tasks through authenticated API calls
2. Allow webhook subscriptions for task_created, task_updated, project_updated, and form_submitted events
3. Store API tokens securely
4. Log all external API activity
5. Add rate limiting
```

---

# 8. Recommended Technical Stack

## Frontend

| Area | Recommendation |
|---|---|
| Framework | React |
| Styling | Tailwind CSS |
| Components | shadcn/ui or similar |
| Charts | Recharts |
| Drag and Drop | dnd-kit |
| Forms | React Hook Form |
| Validation | Zod |

## Backend

| Area | Recommendation |
|---|---|
| Runtime | Node.js |
| Framework | NestJS or Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | Microsoft Entra ID / Azure AD SSO eventually |
| Queue | Redis / BullMQ |
| File Storage | Local first, then S3/Azure Blob |

## Deployment

| Area | Recommendation |
|---|---|
| App Hosting | Azure App Service, Docker, or internal VM |
| Database | Azure PostgreSQL or self-hosted PostgreSQL |
| Auth | Microsoft 365 SSO |
| Logs | Application Insights or structured logging |

---

# 9. Database Schema

## users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    department TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## projects

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'not_started',
    priority TEXT NOT NULL DEFAULT 'normal',
    department TEXT,
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## tasks

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'to_do',
    priority TEXT NOT NULL DEFAULT 'normal',
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## comments

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## activity_logs

```sql
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## notifications

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## forms

```sql
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    default_project_id UUID REFERENCES projects(id),
    default_assignee_id UUID REFERENCES users(id),
    default_priority TEXT DEFAULT 'normal',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## form_fields

```sql
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    options JSONB,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## form_submissions

```sql
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES forms(id),
    submitted_by UUID REFERENCES users(id),
    response_data JSONB NOT NULL,
    created_task_id UUID REFERENCES tasks(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## automation_rules

```sql
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    conditions JSONB,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## task_dependencies

```sql
CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## attachments

```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 10. API Endpoint Plan

## Auth / Users

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/users | List users |
| GET | /api/users/:id | Get user |
| POST | /api/users | Create user |
| PATCH | /api/users/:id | Update user |
| DELETE | /api/users/:id | Deactivate user |

## Projects

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/projects | List projects |
| GET | /api/projects/:id | Get project details |
| POST | /api/projects | Create project |
| PATCH | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete/archive project |
| GET | /api/projects/:id/tasks | List project tasks |
| GET | /api/projects/:id/activity | Project activity log |

## Tasks

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/tasks | List tasks |
| GET | /api/tasks/:id | Get task details |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete/archive task |
| PATCH | /api/tasks/:id/status | Update task status |
| PATCH | /api/tasks/reorder | Update Kanban order |

## Comments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/tasks/:id/comments | List task comments |
| POST | /api/tasks/:id/comments | Add task comment |
| PATCH | /api/comments/:id | Edit comment |
| DELETE | /api/comments/:id | Delete comment |

## Dashboards / Reports

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/dashboard/me | User dashboard |
| GET | /api/dashboard/manager | Manager dashboard |
| GET | /api/reports/tasks-by-user | Open tasks by user |
| GET | /api/reports/overdue | Overdue tasks |
| GET | /api/reports/projects-by-status | Project status counts |
| GET | /api/reports/completion-rate | Task completion trends |

## Forms

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/forms | List forms |
| GET | /api/forms/:id | Get form |
| POST | /api/forms | Create form |
| PATCH | /api/forms/:id | Update form |
| POST | /api/forms/:id/submit | Submit form |
| GET | /api/form-submissions | List submissions |

## Automations

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/automations | List automation rules |
| POST | /api/automations | Create automation rule |
| PATCH | /api/automations/:id | Update rule |
| DELETE | /api/automations/:id | Delete rule |

## Notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/notifications | List my notifications |
| PATCH | /api/notifications/:id/read | Mark one read |
| PATCH | /api/notifications/read-all | Mark all read |

---

# 11. UI Screen Plan

## Main Navigation

Recommended sidebar navigation:

1. Dashboard
2. My Tasks
3. Projects
4. Board
5. Intake Forms
6. Reports
7. Workload
8. Automations
9. Settings

---

## 11.1 Dashboard Screen

### Sections

- My open tasks
- My overdue tasks
- Tasks due this week
- Recent mentions
- Recent activity

### Manager Additions

- Team workload
- Overdue by user
- Projects by status
- Blocked tasks

---

## 11.2 My Tasks Screen

### Features

- List of assigned tasks
- Filters
- Search
- Priority badge
- Due date badge
- Project link
- Quick status update

---

## 11.3 Project List Screen

### Features

- Table/card view
- Filter by status
- Filter by owner
- Filter by department
- Search projects
- Create project button

---

## 11.4 Project Detail Screen

### Sections

- Project summary
- Status
- Owner
- Due date
- Task list
- Kanban view option
- Comments
- Activity log
- Attachments

---

## 11.5 Task Detail Screen

### Sections

- Title
- Description
- Status
- Priority
- Assignee
- Due date
- Subtasks
- Comments
- Attachments
- Activity history

---

## 11.6 Kanban Board Screen

### Columns

- Backlog
- To Do
- In Progress
- Waiting
- Review
- Done

### Card Details

- Task title
- Assignee
- Priority
- Due date
- Project
- Overdue indicator

---

## 11.7 Intake Forms Screen

### User View

- Available forms
- Submit request
- My submitted requests

### Admin View

- Create form
- Edit form
- Manage fields
- Set default project/assignee

---

## 11.8 Reports Screen

### Reports

- Open tasks by user
- Overdue tasks
- Projects by status
- Completion trend
- Blocked tasks
- Average completion time

---

## 11.9 Workload Screen

### Features

- User workload table
- Open task count
- Overdue task count
- Urgent task count
- Due this week
- Completed this week

---

## 11.10 Settings Screen

### Admin Settings

- Users
- Roles
- Departments
- Task statuses
- Project statuses
- Notification settings
- API tokens

---

# 12. MVP Build Order

Build in this order:

1. Database schema
2. Authentication shell
3. Users and roles
4. Projects CRUD
5. Tasks CRUD
6. Task comments
7. Task activity log
8. My Tasks page
9. Project detail page
10. Kanban board
11. Dashboard
12. Notifications
13. Intake forms
14. Reports
15. Automations
16. Workload management
17. Gantt/timeline
18. AI features
19. Integrations

---

# 13. Development Milestones

## Milestone 1 — Skeleton App

Deliverables:

- Working frontend
- Working backend
- PostgreSQL connected
- User table
- Project table
- Task table

## Milestone 2 — Core Task Management

Deliverables:

- Create/edit/delete projects
- Create/edit/delete tasks
- Assign tasks
- Update status
- Filter tasks

## Milestone 3 — Collaboration

Deliverables:

- Comments
- Mentions
- Activity log
- Notifications

## Milestone 4 — Work Views

Deliverables:

- My Tasks
- Project Detail
- Kanban Board
- Dashboard

## Milestone 5 — Intake and Reporting

Deliverables:

- Intake forms
- Submission routing
- Reports
- Workload view

## Milestone 6 — Automation and AI

Deliverables:

- Automation rules
- AI project summary
- AI task extraction
- Project risk scoring

---

# 14. Practical MVP Scope

## Must Have for First Internal Release

- Login/user system
- Projects
- Tasks
- Subtasks
- Comments
- Task assignments
- Due dates
- Kanban board
- My Tasks page
- Overdue task indicator
- Basic dashboard

## Should Wait Until Later

- Complex automations
- AI features
- Full Gantt editing
- Deep integrations
- Custom workflow builder
- Advanced permissions
- Mobile app

---

# 15. Suggested Naming Conventions

## Status Values

Use lowercase underscore values in the database.

Examples:

```text
not_started
active
on_hold
completed
cancelled
backlog
to_do
in_progress
waiting
review
done
```

## Priority Values

```text
low
normal
high
urgent
```

## Roles

```text
admin
manager
user
viewer
```

---

# 16. Security Considerations

## Minimum Requirements

- Require authentication
- Enforce role-based permissions
- Validate all API inputs
- Log major changes
- Prevent users from editing records they should not access
- Store API tokens securely
- Sanitize file uploads
- Limit attachment types and sizes

## Future Requirements

- Microsoft Entra ID SSO
- MFA inherited through Microsoft 365
- Department-level permissions
- Audit report exports
- API rate limiting
- Security event logging

---

# 17. Adoption Strategy

## Pilot Plan

Start with IT.

Recommended pilot workflow:

1. Create IT project workspace
2. Add IT team members
3. Track internal IT projects first
4. Add intake form for IT requests
5. Review feedback after 2 weeks
6. Adjust statuses and fields
7. Expand to another department

## Rules for Adoption

- Keep statuses simple
- Do not over-customize immediately
- Make task ownership mandatory
- Make due dates strongly encouraged
- Use dashboards in weekly meetings
- Avoid duplicate tracking in spreadsheets once live

---

# 18. Future Feature Ideas

## Advanced Project Management

- Portfolio management
- Project templates
- Recurring tasks
- Task dependencies
- Budget tracking
- Time tracking
- Approval workflows
- Department-specific boards

## AI Enhancements

- Weekly executive summary
- Auto-prioritization suggestions
- Task cleanup recommendations
- Duplicate task detection
- Meeting notes to tasks
- Email thread summarization

## Operational Integrations

- Microsoft Teams notifications
- Outlook task creation
- Monday.com migration/import
- ERP-related project/task links
- Asset management integration
- Internal intranet request portal integration

---

# 19. Best First Claude Code Prompt

Use this as the first prompt to start the actual build.

```text
I want to build an internal project management web application.

Use this stack:
- React frontend
- Tailwind CSS
- shadcn/ui components
- Node.js backend with NestJS or Express
- PostgreSQL database
- Prisma ORM

Build the first MVP foundation with:
1. Users
2. Projects
3. Tasks
4. Subtasks
5. Comments
6. Activity logs
7. Basic dashboard
8. Kanban board

Requirements:
- Use clean modular architecture
- Create database schema and migrations
- Create REST API endpoints
- Create frontend pages
- Include filtering and search where practical
- Track major changes in activity logs
- Keep the UI simple, modern, and business-friendly

Start by generating the project structure, database schema, API routes, and frontend route layout.
```

---

# 20. Second Claude Code Prompt

Use this after the foundation exists.

```text
Now implement the core task workflow.

Build:
1. Project CRUD screens
2. Task CRUD screens
3. Task detail drawer or page
4. Subtask support
5. Comments on tasks
6. Activity log entries when task fields change
7. My Tasks page
8. Overdue task indicators

Make sure users can:
- Create tasks
- Assign tasks
- Change status
- Change priority
- Set due dates
- Add comments
- View activity history
```

---

# 21. Third Claude Code Prompt

Use this to build the board.

```text
Build the Kanban board experience.

Requirements:
1. Display tasks grouped by status
2. Support drag-and-drop between columns
3. Persist status changes to the database
4. Persist task order within columns
5. Show assignee, priority, due date, and project on each card
6. Highlight overdue cards
7. Add filters for project, user, and priority
8. Make the board responsive and clean
```

---

# 22. Fourth Claude Code Prompt

Use this for intake forms.

```text
Build the intake form module.

Admins should be able to:
- Create forms
- Add fields
- Mark fields required
- Choose default project
- Choose default assignee
- Choose default priority

Users should be able to:
- View available forms
- Submit a form
- See their previous submissions

When a form is submitted:
- Store the submission
- Create a task automatically
- Link the created task to the submission
- Notify the assigned user
```

---

# 23. Fifth Claude Code Prompt

Use this for reporting.

```text
Build reporting and workload screens.

Reports needed:
1. Open tasks by user
2. Overdue tasks
3. Projects by status
4. Tasks completed by week
5. Blocked/waiting tasks
6. Average completion time

Workload screen:
- Show each user
- Open tasks
- Overdue tasks
- Urgent tasks
- Due this week
- Completed this week

Add filters for date range, department, project, and user.
```

---

# 24. Sixth Claude Code Prompt

Use this for automation.

```text
Build a basic automation engine.

Use trigger/action rules.

Supported triggers:
- task_created
- task_updated
- task_status_changed
- task_due_date_passed
- comment_created
- form_submitted

Supported actions:
- send_notification
- assign_user
- change_status
- change_priority
- add_comment
- create_task

Create:
1. Database table for automation rules
2. Backend service to evaluate triggers
3. Backend service to execute actions
4. Admin UI to create and enable/disable rules
```

---

# 25. Seventh Claude Code Prompt

Use this for AI features.

```text
Build AI-assisted project management features.

Features:
1. AI project summary
2. AI task extraction from pasted text
3. AI project risk score

Project summary should include:
- current status
- completed work
- open work
- overdue items
- blockers
- recommended next steps

Task extraction should:
- accept pasted text
- suggest task titles, descriptions, priorities, and assignees
- require user review before creating tasks

Risk score should evaluate:
- overdue tasks
- blocked tasks
- unassigned tasks
- inactivity
- due date proximity

Keep AI responses grounded only in application data.
```

---

# 26. Final Recommendation

The smartest first release is not a full Wrike or ClickUp clone.

The smartest first release is:

- Projects
- Tasks
- Kanban board
- Assigned-to-me dashboard
- Comments
- Intake forms
- Basic reporting

That gives the company an immediately usable internal work management system without burying users under complexity.

Once employees rely on it, automation and AI become force multipliers instead of shiny distractions.
