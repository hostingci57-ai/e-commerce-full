# e-commerce-full

Multi-Tenant E-Ticaret Platformu (FSD v5.4 MVP).

## Mimari

- **Backend**: NestJS 11 (Fastify) + Prisma 6 + PostgreSQL 16 + Redis 7
- **Storefront**: Next.js 15 (App Router, SSR-first)
- **Tenant Admin**: Next.js 15 (dashboard)
- **Landlord Admin**: Next.js 15 (platform süperadmin)
- **Monorepo**: Turborepo + pnpm workspaces
- **Tenant İzolasyonu**: PostgreSQL 16 Row-Level Security (RLS) + `ecf_app` (FORCE RLS) / `ecf_landlord` (BYPASSRLS) rol ayrımı
- **Auth**: JWT RS256 (access+refresh), argon2id hashing, ayrı customer/staff/landlord audience'ları

## Hızlı Başlangıç

### Gereksinimler
- Node.js 20+
- pnpm 9+
- Docker Desktop (PostgreSQL 16 + Redis 7 + MinIO için)

### Kurulum

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Servisleri başlat
pnpm docker:up
# veya: docker compose up -d

# 3. Env'i kopyala
cp .env.example .env
# JWT anahtarları için:
#   openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
#   openssl rsa -in private.pem -pubout -out public.pem
# Ardından JWT_PRIVATE_KEY + JWT_PUBLIC_KEY'i .env'e koy (çok satırlıyı \n ile kaçış et).

# 4. DB migrate + roles + seed
pnpm db:generate
pnpm db:migrate
pnpm --filter @ecf/db db:init     # init-roles.sql + rls.sql uygular
pnpm --filter @ecf/db seed        # demo veriyi yükler (idempotent)

# 5. Dev
pnpm dev                          # Turborepo ile hepsini aynı anda
# veya tek tek:
pnpm --filter @ecf/api dev           # http://localhost:3001
pnpm --filter @ecf/storefront dev    # http://localhost:3000
pnpm --filter @ecf/tenant-admin dev  # http://localhost:3002
pnpm --filter @ecf/landlord-admin dev # http://localhost:3003
```

### Demo erişim bilgileri

| Rol | URL | Kullanıcı | Parola |
|-----|-----|-----------|--------|
| Storefront (Kahve Dünyası) | http://kahve-dunyasi.localhost:3000 | — | — |
| Storefront (Moda Butik) | http://moda-butik.localhost:3000 | — | — |
| Tenant admin (Kahve Dünyası) | http://localhost:3002 | owner@kahve-dunyasi.local | owner123 |
| Tenant admin (staff) | http://localhost:3002 | ops@kahve-dunyasi.local | ops123 |
| Tenant admin (product) | http://localhost:3002 | product@kahve-dunyasi.local | product123 |
| Tenant admin (Moda Butik) | http://localhost:3002 | owner@moda-butik.local | owner123 |
| Landlord admin | http://localhost:3003 | admin@platform.local | admin123 |
| API docs (Swagger) | http://localhost:3001/docs | — | — |

`*.localhost` alt alanlarının DNS ayarı çoğu işletim sisteminde otomatik loopback'e gider. Windows'ta hosts kaydı gerekmez.

Parolalar dev amaçlıdır; prod ortamda `SEED_LANDLORD_PASSWORD` + `SEED_TENANT_OWNER_PASSWORD` env ile override edilmelidir.

## Test

```bash
pnpm --filter @ecf/api test:unit           # 50+ unit test
E2E=1 DATABASE_URL=... REDIS_URL=... \
  pnpm --filter @ecf/api test:e2e          # RLS + akış testleri
pnpm --filter @ecf/api test:e2e -- --grep cross-tenant  # tenant leak harness
pnpm typecheck
pnpm lint
```

## DB görevleri

```bash
pnpm --filter @ecf/db generate          # prisma client
pnpm --filter @ecf/db migrate:dev       # dev migration
pnpm --filter @ecf/db migrate:deploy    # prod migration
pnpm --filter @ecf/db db:init           # roles + RLS SQL
pnpm --filter @ecf/db seed              # demo data (idempotent)
pnpm --filter @ecf/db db:reset          # reset + init + seed (YIKIM! sadece dev)
pnpm --filter @ecf/db studio            # Prisma Studio
```

## API

- Swagger UI: `http://localhost:3001/docs` (NODE_ENV !== production)
- Auth akışları: `POST /v1/auth/customer/(register|login)`, `POST /v1/auth/staff/login`, `POST /v1/auth/landlord/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/auth/me`
- Tenancy çözümleme: `X-Tenant-Subdomain` header → `Host` header (`{slug}.localhost`) → JWT claim

## FAZ 6 Kapsamı

- Auth + RBAC (customer/staff/landlord audience, role-based abilities)
- PG16 RLS ile tenant izolasyonu
- Katalog (product / variant / brand / category / media)
- Sepet + checkout + order lifecycle
- Müşteri + adres + KVKK onay
- Storefront (SSR-first PLP/PDP/cart/checkout/account)
- Tenant admin paneli
- Landlord admin + observability
- Rate limiting + güvenlik sıkılaştırmaları + test harness
- Coupons + refund workflow + draft orders
- Seed data (iki demo tenant) + bu runbook

## Kapsam Dışı (Faz 7+)

Gerçek ödeme gateway, e-fatura, kargo API entegrasyonu, SMS / email kanalları, SSO / MFA, WhatsApp commerce, marketplace, tema marketplace, ClickHouse analitik, i18n theme editor.

## Yapı

```
apps/
  api/                  NestJS 11 Fastify REST API
  storefront/           Public storefront (SSR)
  tenant-admin/         Tenant backoffice
  landlord-admin/       Platform süperadmin paneli
packages/
  db/                   Prisma schema + RLS SQL + seed
  validation/           Zod şemaları (shared)
  types/                Paylaşılan TS tipleri
docs/
  runbook.md            Operasyonel runbook
  observability.md      Log + metrik + health-check rehberi
docker-compose.yml      PostgreSQL 16 + Redis 7 + MinIO
```

## Daha fazla

- Operasyonel işlemler için: [docs/runbook.md](docs/runbook.md)
- Observability: [docs/observability.md](docs/observability.md)
