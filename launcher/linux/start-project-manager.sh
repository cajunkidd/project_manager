#!/usr/bin/env bash
# Launches Project Manager on Linux/macOS.
# Run once with `bash launcher/linux/start-project-manager.sh`; first run
# installs dependencies and builds the workspaces, subsequent runs just boot.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install the LTS build from https://nodejs.org and re-run." >&2
  exit 1
fi

export PORT="${PROJECT_MANAGER_PORT:-${PORT:-4000}}"
export OPEN_BROWSER="${OPEN_BROWSER:-1}"
export DATABASE_URL="${DATABASE_URL:-file:./project-manager.db}"
# Note: NODE_ENV is set AFTER npm install below so that devDependencies
# (TypeScript, Vite, etc.) are installed during the first-run build.

JWT_SECRET_FILE="$REPO_ROOT/.jwt-secret"
if [[ -z "${JWT_SECRET:-}" ]]; then
  if [[ ! -f "$JWT_SECRET_FILE" ]]; then
    node -e "console.log(require('crypto').randomBytes(48).toString('base64'))" > "$JWT_SECRET_FILE"
    chmod 600 "$JWT_SECRET_FILE"
  fi
  JWT_SECRET="$(<"$JWT_SECRET_FILE")"
  export JWT_SECRET
fi

BOOTSTRAP_MARKER="$REPO_ROOT/.launcher-bootstrapped"
if [[ ! -f "$BOOTSTRAP_MARKER" ]]; then
  echo "First-run setup. This may take a few minutes…"
  # Install with devDependencies so TypeScript + Vite are available for the build.
  NODE_ENV=development npm install --no-audit --no-fund --include=dev
  (cd backend && npx prisma generate && npx prisma db push --skip-generate)
  npm run build
  date > "$BOOTSTRAP_MARKER"
fi

export NODE_ENV="${NODE_ENV:-production}"

# Keep the schema in sync every launch.
(cd backend && npx prisma db push --skip-generate >/dev/null 2>&1 || true)

echo
echo "  Project Manager is starting on http://localhost:${PORT}"
echo "  Press Ctrl+C to stop."
echo

cd backend
if [[ -f dist/src/server.js ]]; then
  exec node dist/src/server.js
else
  exec node dist/server.js
fi
