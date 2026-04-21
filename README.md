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

# 5. Apply RLS + roles (ECF_APP_PASSWORD + ECF_LANDLORD_PASSWORD env'den okunur;
#    production'da güçlü rastgele parolalar (>=32 karakter) üret ve secret
#    manager'a koy — gerçek değerleri commit ETME)
pnpm --filter @ecf/db db:init

# 6. Dev
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

## Production deployment

### Docker image'lar (GHCR)

`main` push'unda (ve `v*` tag'lerinde) `.github/workflows/docker-publish.yml`
dört image yayınlar:

- `ghcr.io/hostingci57-ai/ecf-api:latest`
- `ghcr.io/hostingci57-ai/ecf-storefront:latest`
- `ghcr.io/hostingci57-ai/ecf-tenant-admin:latest`
- `ghcr.io/hostingci57-ai/ecf-landlord-admin:latest`

Her image ayrıca `:<git-sha>` tag'i alır (immutable deploy için). Tag push'larında
ek olarak `:v1.2.3` / `:v1.2` tag'leri üretilir.

Dockerfile'lar `infra/docker/` altında (`api.Dockerfile`, `storefront.Dockerfile`,
`tenant-admin.Dockerfile`, `landlord-admin.Dockerfile`). Hepsi multi-stage,
non-root (`ecf`) user, healthcheck'li. Next.js app'ler `output: 'standalone'`
modunda build edilip sadece minimum server.js + static varlıklar image'a kopyalanır.

### docker-compose.prod.yml ile hızlı deploy

```bash
cd infra/docker
# Güvenli parolalarla doldurulmuş .env dosyası hazırla
cp ../../.env.example .env.production
# .env.production'u düzenle — güçlü şifre/JWT anahtarları koy
docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Stack: `postgres` + `redis` + `minio` + `api` + `storefront` + `tenant-admin`
+ `landlord-admin` + `nginx` (80/443 subdomain routing).

Örnek `nginx.conf` — `api.platform.local`, `admin.platform.local`,
`landlord.platform.local` ve wildcard storefront'u yönlendirir.

### Gereken env değişkenleri (özet)

| Env | Kim okuyor | Açıklama |
|-----|-----------|---------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres + API | app rolü için kök kullanıcı |
| `ECF_APP_PASSWORD` | Postgres init + API (runtime) | `ecf_app` (FORCE RLS) rol şifresi |
| `ECF_LANDLORD_PASSWORD` | Postgres init + API (runtime) | `ecf_landlord` (BYPASSRLS) rol şifresi |
| `DATABASE_URL` | API | `postgresql://ecf_app:...@postgres:5432/ecf` (prod'da app rolü) |
| `DATABASE_URL_LANDLORD` / `LANDLORD_DATABASE_URL` | API | bypass RLS bağlantısı |
| `REDIS_URL` | API | `redis://redis:6379` |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | API | RS256 PEM (multi-line `\n` kaçışlı) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | API | saniye |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO + API (S3 kimlik) | |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` | API | media bucket yapılandırması |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | API | bildirim e-postaları |
| `RATE_LIMIT_TTL` / `RATE_LIMIT_MAX` | API | throttler varsayılan: 60s / 120 istek |
| `LOG_LEVEL` | API | `info` / `debug` / `warn` |
| `NEXT_PUBLIC_API_URL` | 3 Next.js app'i | tarayıcının API'ye gideceği URL |
| `API_INTERNAL_URL` | SSR/server actions | cluster-içi API adresi (`http://api:3001`) |

`JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` için:
```bash
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in private.pem -pubout -out public.pem
# .env'e:
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

### CI/CD (GitHub Actions)

- `ci.yml` — PR + `main` push: lint + typecheck, unit tests, E2E (PG+Redis
  service container'larıyla), 4-matrix build.
- `docker-publish.yml` — `main` push + `v*` tag'inde 4 image'ı GHCR'a push eder.
- `security-scan.yml` — Pazartesi 03:00 UTC: `pnpm audit --audit-level=high`
  + Trivy fs scan. Raporlar bilgi amaçlıdır, CI fail etmez.
- `dependabot.yml` — haftalık npm (minor/patch gruplandırılmış), aylık
  github-actions + docker image updates.

**E2E secret'lar:** `TEST_JWT_PRIVATE_KEY` ve `TEST_JWT_PUBLIC_KEY` repo
secret'larına koyulmalı. Yoksa E2E job'u `JWT_*` yokluğundan kırılır — local
RS256 anahtar çifti üretip repo secret'ı olarak yükleyin (prod anahtarlarıyla
**aynı olmasın**).

### Image'ı yerel test

```bash
docker buildx build -f infra/docker/api.Dockerfile -t ecf-api:dev --load .
docker buildx build -f infra/docker/storefront.Dockerfile -t ecf-storefront:dev --load .
# ...
```

> **Windows notu:** `output: 'standalone'` build adımı Windows'ta pnpm
> symlink'leri kopyalarken `EPERM` hatası verebilir. CI (Ubuntu) ve Docker
> build (Alpine) bu sorunu yaşamaz — yerel üretim build denemek için
> Geliştirici Modu'nu aç veya doğrudan `docker buildx build` kullan.

## Daha fazla

- Operasyonel işlemler için: [docs/runbook.md](docs/runbook.md)
- Observability: [docs/observability.md](docs/observability.md)
