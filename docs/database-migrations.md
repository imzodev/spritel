# Database Migrations and Deployment (Prisma + MySQL)

This document explains exactly how database schema changes are created, applied, and automated for this project. It is designed so any engineer or AI agent can deploy or evolve the schema safely.

- Stack
  - MySQL 8 (local or container)
  - Prisma ORM (schema + migrations): `prisma/schema.prisma`, `prisma/migrations/`
  - Bun app (local or container)
  - Admin GUI (optional): Adminer (if using Docker) at http://localhost:8080
- Goal
  - Zero-manual DB setup on deploy/start
  - Safe, repeatable schema evolution via Prisma migrations
  - First-time bootstrap handled automatically

## Key Files

- `docker-compose.yml` (if using Docker)
  - Services: `db`, `adminer`, `app`
  - `db` has a healthcheck; `app` waits on `db` to be healthy.
- `Dockerfile` (if using Docker)
  - Installs dependencies + OpenSSL (required by Prisma)
  - Runs Prisma generate at build time
  - Uses `scripts/entrypoint.sh` as the container entrypoint
- `scripts/entrypoint.sh` (if using Docker)
  - On container start: applies committed migrations via `prisma migrate deploy`, generates client, then starts the app.
  - Note: do NOT rely on `migrate dev` in entrypoint for production. Generate migrations in dev, commit them, and deploy.
- `prisma/schema.prisma`
  - All models: `Item`, `Player`, `PlayerInventory`, `PlayerEquipment`, `Skill`, `PlayerSkill`, `MerchantStock`, `Transaction`
  - Datasource includes `shadowDatabaseUrl` for privileged shadow DB creation
- `.env` / `.env.example`
  - `DATABASE_URL` Prisma connection URL
  - `SHADOW_DATABASE_URL` Prisma shadow DB (dev-only, used by `migrate dev`)
  - `MYSQL_*` (if using Docker DB)
  - `VITE_API_URL` for the client
- `package.json` (scripts)
  - `prisma:generate`, `prisma:migrate`, `prisma:studio`

## Local MySQL (no Docker) — Quickstart (Recommended for Dev)

1) Create databases (root user shown; adjust as needed):
```
mysql -uroot -p -h127.0.0.1 -e "\
CREATE DATABASE IF NOT EXISTS spritel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; \
CREATE DATABASE IF NOT EXISTS spritel_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

2) Set `.env` for local:
```
DATABASE_URL="mysql://root:<root-password>@127.0.0.1:3306/spritel"
SHADOW_DATABASE_URL="mysql://root:<root-password>@127.0.0.1:3306/spritel_shadow"
```

3) Baseline (first time only):
```
bunx prisma generate
bunx prisma migrate dev --name init
```

4) Day-to-day change:
```
# Edit prisma/schema.prisma
bunx prisma migrate dev --name <describe_change>
```

5) Commit migrations:
```
git add prisma/migrations/*
git commit -m "feat(db): <describe_change>"
```

## Environment Variables

Add these to `.env` (see `.env.example`):

```
MYSQL_ROOT_PASSWORD="<root-password>"
MYSQL_USER="<app-user>"
MYSQL_PASSWORD="<app-password>"

# Prisma inside containers resolves the DB host as `db` (compose service name)
DATABASE_URL="mysql://<app-user>:<app-password>@db:3306/spritel"

# Prisma uses this for the shadow DB during `migrate dev` (requires privileges)
SHADOW_DATABASE_URL="mysql://root:<root-password>@db:3306/spritel"

NODE_ENV="development"
VITE_API_URL="http://localhost:3001"
```

Notes
- Use `127.0.0.1` for local MySQL from your host shell. Use `db` only inside Docker networks.
- The shadow DB is only used by `prisma migrate dev` (development) to safely compute diffs and validate migrations. It is not used by `migrate deploy` in production.

## First-Time Bootstrap (Docker)

1) Build the app image (includes OpenSSL + Prisma client)
```
docker compose build app
```
2) Start DB and Adminer
```
docker compose up -d db adminer
```
3) Start the app
```
docker compose up -d app
```
4) Check logs
```
docker compose logs -f app
```
You should see `Applying migrations (deploy)` and app startup. Generate migrations in development prior to deployment.

5) Verify tables in Adminer: http://localhost:8080
- Server: `db`
- Database: `spritel`
- You should see tables:
  - `items`, `players`, `player_inventories`, `player_equipment`, `skills`, `player_skills`, `merchant_stock`, `transactions`, `_prisma_migrations`

## Day-to-Day Development (Creating Migrations)

When you change the schema, create a migration locally and commit it.

1) Edit `prisma/schema.prisma`
2) Create and apply a migration locally:
```
bunx prisma migrate dev --name <describe_change>
```
This will:
- Write SQL under `prisma/migrations/<timestamp>_<describe_change>/`
- Apply it to your local DB
- Update the Prisma client as needed

3) Commit migration files to git.

## Deployment (Applying Migrations Automatically)

- On app start, `scripts/entrypoint.sh` (or your process manager) runs:
  - `prisma migrate deploy` (idempotent) to apply any pending committed migrations
- No manual commands required in CI/CD or prod if migrations are committed.

## Production (Docker) — How to Deploy

1) Prepare `.env` on the server (not committed):
```
NODE_ENV=production
MYSQL_ROOT_PASSWORD=<root-password>
MYSQL_USER=<app-user>
MYSQL_PASSWORD=<app-password>

# App connects to MySQL by compose service name `db`
DATABASE_URL="mysql://<app-user>:<app-password>@db:3306/spritel"
```

2) Build and start with the production compose:
```
docker compose -f docker-compose.prod.yml up -d --build
```

3) Verify logs:
```
docker compose -f docker-compose.prod.yml logs -f app
```
You should see `Applying migrations (deploy)` and then the server starting.

Notes
- Generate migrations in development with `migrate dev`, commit them, then deploy. Do not generate migrations in production.
- The MySQL service uses a persistent volume (`db_data`). Back up regularly.

## CI Guardrails (optional but recommended)

In CI, fail a build if schema changed without a migration:
```
# pseudo-steps
bunx prisma generate
test -d prisma/migrations || { echo "No migrations"; exit 1; }

# build image
docker build -t your/app:$(git rev-parse --short HEAD) .
```

## Baselining (P3005) quick-fix (development only)

If you see `P3005: database schema is not empty` during `migrate dev`:
```
# Mark the last migration as applied (choose the folder name you expect in DB):
bunx prisma migrate resolve --applied <last_migration_folder>

# Re-run migrate dev
bunx prisma migrate dev --name <describe_change>
```
If the DB was changed without migrations (drift), consider resetting dev DB or using `prisma migrate diff` to generate a baseline migration, then `migrate resolve --applied`.

## Running Prisma From Host (Optional)

If you want to run Prisma locally while the DB runs in Docker, use a host-reachable URL:

```
export DATABASE_URL=mysql://<app-user>:<app-password>@127.0.0.1:3306/spritel
bun run prisma:generate
bun run prisma:migrate
```

This is useful for creating migrations the first time if you prefer not to rely on the container bootstrap.

## Common Pitfalls & Fixes

- P3014 (Shadow DB could not be created)
  - Cause: `migrate dev` needs to create a shadow DB; the user lacks privileges or the URL is wrong.
  - Fix: Ensure `shadowDatabaseUrl` is set and `SHADOW_DATABASE_URL` has sufficient privileges.

- P1001 (Cannot reach `db:3306` from host)
  - Cause: `db` only resolves inside Docker network.
  - Fix: When running Prisma from the host, use `127.0.0.1`:
    - `export DATABASE_URL=...@127.0.0.1:3306/spritel`

- OpenSSL warnings from Prisma
  - Fix: Dockerfile installs `openssl` (required by Prisma binaries).

- DB Credentials changed after first boot
  - Cause: MySQL initializes users/passwords only on the first start and persists them in the volume.
  - Fix: Reset volume (destructive):
    - `docker compose down -v`
    - `docker compose up -d db adminer`

- Compose warning: `version` key is obsolete
  - Fix: Remove `version: '3.9'` from `docker-compose.yml`.

## Production Notes

- For production, prefer a `docker-compose.prod.yml` that:
  - Builds the client (`vite build`) and serves `./dist` from the server
  - Sets `NODE_ENV=production`
  - Keeps the same entrypoint (still runs `migrate deploy` automatically)
- Ensure `prisma/migrations/*` are committed; `migrate deploy` depends on them.
- Consider managed MySQL or persistent volumes; rotate credentials and store secrets safely.
- Expose only necessary ports publicly.

## Quick Commands

- Build app: `docker compose build app`
- Start DB + Adminer: `docker compose up -d db adminer`
- Start app: `docker compose up -d app`
- Tail app logs: `docker compose logs -f app`
- Prisma client: `bun run prisma:generate`
- Create dev migration (local MySQL): `bunx prisma migrate dev --name <change>`
- Migration status (in container): `docker compose exec app sh -lc 'bunx prisma migrate status'`
- Reset DB (destructive): `docker compose down -v`

---
This process is now fully automated for initial bootstrap and subsequent deploys. Create migrations in dev, commit them, and the app container will apply them on startup in any environment.
