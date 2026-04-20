# e-commerce-full

Multi-tenant e-commerce platform. Turborepo + pnpm workspaces.

## Layout

```
apps/
  api/               NestJS 11 Fastify API
packages/
  db/                Prisma schema + client + RLS SQL
  validation/        Zod schemas (shared)
  types/             Shared TS types
docker-compose.yml   PostgreSQL 16 + Redis 7 + MinIO
```

## Requirements

- Node >= 20
- pnpm >= 9
- Docker Desktop (for local services)
- PostgreSQL 16 (local or via docker-compose)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start local services (Postgres 16 + Redis 7 + MinIO)
pnpm docker:up

# 3. Copy env
cp .env.example .env
# (or use the pre-generated .env already in the repo for dev)

# 4. Run Prisma migrations
pnpm db:generate
pnpm db:migrate

# 5. Apply RLS + roles (reads ECF_APP_PASSWORD + ECF_LANDLORD_PASSWORD from env,
#    substitutes the placeholders in init-roles.sql, then runs rls.sql).
#    For PRODUCTION, generate strong random passwords (>=32 chars) and set
#    ECF_APP_PASSWORD / ECF_LANDLORD_PASSWORD in your secret manager — never
#    commit real values.
pnpm --filter @ecf/db db:init
```

## Dev

```bash
pnpm dev            # run all apps in parallel
pnpm --filter @ecf/api run dev   # only API
```

## Test

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## API

Swagger UI at `http://localhost:3001/docs` when `NODE_ENV !== production`.

### Auth endpoints (Module 03)

- `POST /v1/auth/customer/register`
- `POST /v1/auth/customer/login`
- `POST /v1/auth/staff/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET  /v1/auth/me`

### Tenancy (Module 02)

- Tenant resolution: `X-Tenant-Subdomain` header OR `Host` header (`{slug}.localhost`) OR JWT claim.
- Landlord endpoints use BYPASSRLS via `@ecf/db`'s landlord client.
