#!/usr/bin/env bash
set -e

echo "[entrypoint] NODE_ENV=${NODE_ENV}"

# Detect if any migrations exist
MIGRATIONS_DIR="/usr/src/app/prisma/migrations"
if [ ! -d "$MIGRATIONS_DIR" ] || [ -z "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then
  echo "[entrypoint] No Prisma migrations found. Creating initial migration (init)."
  # Create and apply the initial migration non-interactively
  bunx prisma migrate dev --name init || true
fi

echo "[entrypoint] Applying migrations (deploy)"
bunx prisma migrate deploy || true

echo "[entrypoint] Generating Prisma client"
bunx prisma generate

if [ "${NODE_ENV}" = "production" ]; then
  echo "[entrypoint] Starting server"
  bun run server
else
  echo "[entrypoint] Starting dev servers (server + Vite)"
  bun run dev:all
fi
