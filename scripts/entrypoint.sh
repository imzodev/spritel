#!/usr/bin/env bash
set -e

echo "[entrypoint] NODE_ENV=${NODE_ENV}"

# Prisma migrate deploy is idempotent; safe to run on each start
if [ "${NODE_ENV}" = "production" ]; then
  echo "[entrypoint] Running prisma migrate deploy (production)"
  bunx prisma migrate deploy
  echo "[entrypoint] Generating Prisma client"
  bunx prisma generate
  echo "[entrypoint] Starting server"
  bun run server
else
  echo "[entrypoint] Running prisma migrate deploy (dev)"
  # In dev, it's okay if there are no migrations yet
  bunx prisma migrate deploy || true
  echo "[entrypoint] Generating Prisma client"
  bunx prisma generate
  echo "[entrypoint] Starting dev servers (server + Vite)"
  bun run dev:all
fi
