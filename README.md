# Internal Project Management Application

Monorepo scaffolding for the internal project management app described in
`project_management_app_claude_code_roadmap.md`.

## Layout

- `backend/` — Node.js + TypeScript service (Jest test runner)
- `frontend/` — React + TypeScript app (Vitest + React Testing Library)
- `.github/workflows/ci.yml` — runs both test suites on push/PR

## Install

```bash
npm install
```

This installs both workspaces.

## Run tests

```bash
npm test                # both workspaces
npm run test:backend    # backend only
npm run test:frontend   # frontend only
```

## What's here today

Only the testing harness and a couple of placeholder modules
(status/priority validators on the backend, a `StatusBadge` component on the
frontend) so the test pipeline has something real to exercise. Feature code
will be added per the roadmap.
