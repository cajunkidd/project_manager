# Repo guide for Claude

## What this is

Internal project management web app. Roadmap is in
`project_management_app_claude_code_roadmap.md`. The app implements
Phases 0–5 of that roadmap, except where noted under "Intentionally not
built".

## Layout

```
backend/    Express + Prisma + Postgres + Zod + nodemailer + Anthropic SDK
frontend/   Vite + React + Tailwind + React Router + TanStack Query
```

npm workspaces at root. `npm run dev` from the repo root starts both.

## Backend conventions

- **No auth yet.** The frontend sets `X-Acting-As` semantics by passing
  `createdById` / `userId` in request bodies, sourced from a localStorage
  "current user" toggle in the top nav. SSO (Microsoft Entra) is the
  long-term plan.
- **Routes** are in `backend/src/routes/*.ts`, mounted under `/api`
  through `routes/index.ts`. Token-authed external surface lives at
  `/api/v1/*` (see `routes/external.ts`).
- **Helpers** in `backend/src/lib/*.ts`:
  - `prisma.ts` — single shared PrismaClient
  - `activity.ts` — write a row to `activity_logs`. Called from every
    create/update/delete site that should be visible in the project
    activity feed.
  - `notify.ts` — write a row to `notifications` (in-app bell).
  - `email.ts` — `sendEmail` / `sendEmailToUser`. **No-op when
    `SMTP_HOST` is unset**, so the app keeps working without SMTP.
    Respects `users.emailNotificationsEnabled`.
  - `mentions.ts` — extract `@token` from a comment body and resolve
    against `users.email` by prefix match.
  - `automation.ts` — trigger/action engine. `runAutomations(ctx)` is
    called from task / comment / form / scheduler sites.
  - `webhooks.ts` — outbound HMAC-signed webhook fan-out.
  - `risk.ts` — pure deterministic risk score (unit-tested).
  - `tokens.ts` — generate + hash API tokens.
  - `overdueScanner.ts`, `digestScheduler.ts` — long-running schedulers
    started from `index.ts`.
  - `anthropic.ts` — lazy SDK client; throws 503 if
    `ANTHROPIC_API_KEY` is unset.
- **Event ordering inside a route:** mutate → `logActivity` →
  in-app `notify` → `sendEmailToUser` (fire-and-forget) →
  `runAutomations` → `dispatchWebhook` → respond. New event sites should
  follow this order.
- **Schedulers** start from `index.ts` after `app.listen`. Both dedupe
  via `activity_log` (overdue) or are idempotent (digest), so restarts
  are safe.

## Frontend conventions

- All API calls go through `frontend/src/lib/api.ts` (`api.get` / post /
  patch / delete). Don't fetch directly.
- **TaskDrawer is global, URL-driven.** Mounted once in `AppShell`,
  reads `?task=<id>` via the `useTaskOpener` hook. Pages call
  `openTask(id)` instead of holding local drawer state — this is what
  makes the notification bell deep-link work.
- **Acting user** is read from `localStorage.pm.currentUserId`.
  `getCurrentUserId()` and `setCurrentUserId()` in `lib/currentUser.ts`.
  Pages that show "my X" listen for the `pm:user-changed` event.
- **State:** TanStack Query for everything. Invalidate by query key
  after mutations — see existing patterns in `Board.tsx` and
  `ProjectDetail.tsx`.

## Tests

`npm --workspace backend test` runs Vitest against the deterministic
helpers (risk, mentions regex, automation matcher). New pure helpers
should get a sibling `*.test.ts`. Anything that touches Prisma is not
covered yet — needs a DB fixture story.

## What's intentionally not built

- **Inbound email** — needs IMAP / provider (Microsoft 365, Gmail,
  Mailgun) decision.
- **Auth / SSO** — the "acting as" switcher is a stand-in.
- **File uploads** — schema has `attachments` but no UI or storage
  backend (S3 / Azure Blob choice deferred).

## Common gotchas

- Route ordering: `/tasks/reorder` must be registered **before**
  `/tasks/:id` in Express.
- `sendEmailToUser` and `dispatchWebhook` are fire-and-forget
  (`void` the promise). Don't await them in request handlers.
- `runAutomations` *does* await — actions run sequentially with per-
  action try/catch.
- Adding a new automation trigger: add to the union in `lib/automation.ts`,
  to `frontend/src/lib/types.ts`, and to the `TRIGGERS` array in
  `pages/Automations.tsx`. Don't forget the `matches` switch.
- Adding a new webhook event: add to `WEBHOOK_EVENTS` in
  `lib/webhooks.ts` and to the union in `frontend/src/lib/types.ts`.
- The `init` migration is committed under `backend/prisma/migrations/`.
  Use `prisma migrate dev --name <change>` for new schema changes;
  `prisma migrate deploy` in CI/prod.

## When extending the app

- Mutations that should be visible on the project activity feed must
  call `logActivity({ entityType, entityId, action, userId, ... })`.
- Mutations on tasks that change a user-visible field should also fire
  `dispatchWebhook("task_updated", ...)` and the appropriate
  `runAutomations(...)` call.
- New AI endpoints: use `getAnthropic()` from `lib/anthropic.ts` (it
  throws a 503 with `anthropic_api_key_missing` if the key isn't set —
  the frontend has friendly handling for that error string).
