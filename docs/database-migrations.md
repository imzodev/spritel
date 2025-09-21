# Database Migrations and Deployment (Prisma + MySQL + Docker)

This document explains exactly how database schema changes are created, applied, and automated for this project. It is designed so any engineer or AI agent can deploy or evolve the schema safely.

- Stack
  - MySQL 8 (container): `docker-compose.yml` service `db`
  - Prisma ORM (schema + migrations): `prisma/schema.prisma`, `prisma/migrations/`
  - Bun app (container): `docker-compose.yml` service `app`
  - Admin GUI (optional): Adminer at http://localhost:8080
- Goal
  - Zero-manual DB setup on deploy/start
  - Safe, repeatable schema evolution via Prisma migrations
  - First-time bootstrap handled automatically

## Key Files

- `docker-compose.yml`
  - Services: `db`, `adminer`, `app`
  - `db` has a healthcheck; `app` waits on `db` to be healthy.
- `Dockerfile`
  - Installs dependencies + OpenSSL (required by Prisma)
  - Runs Prisma generate at build time
  - Uses `scripts/entrypoint.sh` as the container entrypoint
- `scripts/entrypoint.sh`
  - On container start:
    1) If no migrations exist, create initial migration: `prisma migrate dev --name init`
    2) Always apply pending migrations: `prisma migrate deploy`
    3) Generate Prisma client: `prisma generate`
    4) Start the app (dev: Vite + server, prod: server only)
- `prisma/schema.prisma`
  - All models: `Item`, `Player`, `PlayerInventory`, `PlayerEquipment`, `Skill`, `PlayerSkill`, `MerchantStock`, `Transaction`
  - Datasource includes `shadowDatabaseUrl` for privileged shadow DB creation
- `.env` / `.env.example`
  - `DATABASE_URL` for Prisma (non-root)
  - `SHADOW_DATABASE_URL` for Prisma shadow DB (root)
  - `MYSQL_*` for the DB container
  - `VITE_API_URL` for the client
- `package.json` (scripts)
  - `prisma:generate`, `prisma:migrate`, `prisma:studio`

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
- The DB host `db` works inside containers. When running Prisma from your host shell, use `127.0.0.1` instead.
- The shadow DB is only used by `migrate dev` to diff the schema. It needs a privileged user (root).

## First-Time Bootstrap (Fully Automatic)

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
You should see:
- `[entrypoint] No Prisma migrations found. Creating initial migration (init).`
- `Applying migrations (deploy)`
- `Generating Prisma client`

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

- On container start, `scripts/entrypoint.sh` runs:
  - `prisma migrate deploy` (idempotent) to apply any pending committed migrations
- No manual `docker exec` required in CI/CD or prod environments.

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
  - Cause: Prisma `migrate dev` needs to create a shadow DB; non-root user lacks privileges.
  - Fix: Set `shadowDatabaseUrl` in `prisma/schema.prisma` and add `SHADOW_DATABASE_URL` (root) in `.env`.

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
- Create dev migration: `bunx prisma migrate dev --name <change>`
- Migration status (in container): `docker compose exec app sh -lc 'bunx prisma migrate status'`
- Reset DB (destructive): `docker compose down -v`

---
This process is now fully automated for initial bootstrap and subsequent deploys. Create migrations in dev, commit them, and the app container will apply them on startup in any environment.
