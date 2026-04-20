# Runbook

Operasyonel görevler için günlük rehber. Komutlar repo kökünden çalıştırılır; aksi belirtilmedikçe `pnpm` kullanılır.

---

## 1. Yeni tenant oluşturma

```bash
# Landlord API üzerinden:
curl -X POST http://localhost:3001/v1/landlord/tenants \
  -H "Authorization: Bearer <LANDLORD_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Market",
    "subdomain": "demo-market",
    "planCode": "starter",
    "ownerEmail": "owner@demo-market.local",
    "ownerPassword": "<strong>",
    "ownerFirstName": "Demo",
    "ownerLastName": "Owner"
  }'
```

Ya da doğrudan DB'den (ops senaryosu):
```bash
pnpm --filter @ecf/db studio    # UI ile insert
```

Kontroller:
- `Tenant.subdomain` benzersiz olmalı
- Plan kodu mevcut (`starter|growth|enterprise`) olmalı
- `OWNER` rolüyle `TenantMember` oluşturulmalı
- `tenant.settings.seeded = false` (prod)

## 2. Tenant suspend / activate

```bash
# Suspend
curl -X PATCH http://localhost:3001/v1/landlord/tenants/{id} \
  -H "Authorization: Bearer <LANDLORD_JWT>" \
  -d '{"status": "suspended"}'
# Activate
curl -X PATCH http://localhost:3001/v1/landlord/tenants/{id} \
  -H "Authorization: Bearer <LANDLORD_JWT>" \
  -d '{"status": "active"}'
```

Suspend edilen tenant'ın storefront/API erişimi `TenantStatusGuard` tarafından 503 ile engellenir; admin panele giriş hâlâ açık.

## 3. DB yedek + restore

```bash
# Backup
docker compose exec -T postgres pg_dump \
  -U smart -d e_commerce_full --format=custom --no-owner \
  > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore (YIKIM — mevcut veriyi siler)
docker compose exec -T postgres pg_restore \
  -U smart -d e_commerce_full --clean --if-exists --no-owner \
  < backup_20260420_120000.dump

# Restore sonrası RLS politikalarını yeniden uygula:
pnpm --filter @ecf/db db:init
```

Yedek dosyaları ana kod reposuna commit **edilmez**; güvenli bir bucket'a (S3/MinIO) yüklenir.

## 4. RLS politika testi (cross-tenant leak harness)

```bash
# E2E testleri DB bağlantısı gerekir
E2E=1 \
DATABASE_URL="postgresql://smart:1@localhost:5432/e_commerce_full?schema=public" \
DATABASE_URL_LANDLORD="postgresql://smart:1@localhost:5432/e_commerce_full?schema=public" \
REDIS_URL="redis://localhost:6379/0" \
pnpm --filter @ecf/api test:e2e -- --grep cross-tenant
```

Her yeni tenant-scoped tablo için `rls.sql`'e policy ekledikten sonra bu testi çalıştır. Leak görülürse build'i bloke et.

## 5. Log izleme (pino)

```bash
# API conteynıri
docker compose logs -f api | pino-pretty

# Local dev (LOG_PRETTY=true set)
pnpm --filter @ecf/api dev

# Yalnızca error
docker compose logs api | pino-pretty --levelFirst | grep ERROR
```

Korelasyon için `requestId` header'ı her istekte set edilir, log satırlarında aranır.

## 6. Rate limit threshold değişikliği

`apps/api/src/common/rate-limit/` altındaki config:

```ts
// apps/api/src/common/rate-limit/rate-limit.config.ts
export const RATE_LIMITS = {
  auth: { points: 5, duration: 60 },        // 5 req/min per IP
  checkout: { points: 3, duration: 60 },
  ...
};
```

Değiştirdikten sonra API'yi restart et. Prod'da Redis'teki mevcut counter'lar `rl:*` key prefix'i ile görünür (`redis-cli --scan --pattern 'rl:*'`).

## 7. Kupon kampanyası açma (tenant admin)

```bash
curl -X POST http://localhost:3001/v1/coupons \
  -H "Authorization: Bearer <STAFF_JWT>" \
  -H "X-Tenant-Subdomain: kahve-dunyasi" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "KIS2026",
    "type": "PERCENT",
    "value": 1500,
    "minimumAmount": "20000",
    "maximumDiscount": "10000",
    "startsAt": "2026-04-20T00:00:00Z",
    "endsAt":   "2026-05-01T23:59:59Z",
    "usageLimit": 500,
    "isActive": true
  }'
```

Birim notları:
- `PERCENT.value` = basis points (1500 = %15)
- `FIXED.value` = minor units (kuruş)
- `minimumAmount` / `maximumDiscount` string (BigInt) — cart subtotal'a clamp edilir

Storefront'ta `/cart` → "Kupon uygula" alanı; denetimler `CouponsService.evaluate` içinde (isActive, window, usage, min-amount, scope).

## 8. Refund onay akışı

```bash
# Müşteri istek açar (order delivered olmalı)
curl -X POST http://localhost:3001/v1/customers/me/orders/{id}/refund-request \
  -H "Authorization: Bearer <CUSTOMER_JWT>" \
  -d '{"reasonCategory": "DAMAGED", "reasonText": "paket kırık geldi", "amountMinor": "29900"}'

# Admin listeler
curl http://localhost:3001/v1/refund-requests \
  -H "Authorization: Bearer <STAFF_JWT>" \
  -H "X-Tenant-Subdomain: kahve-dunyasi"

# Approve
curl -X POST http://localhost:3001/v1/refund-requests/{id}/approve \
  -H "Authorization: Bearer <STAFF_JWT>" \
  -d '{"approvedAmountMinor": "29900", "partial": false}'

# Reject
curl -X POST http://localhost:3001/v1/refund-requests/{id}/reject \
  -H "Authorization: Bearer <STAFF_JWT>" \
  -d '{"reason": "garanti dışı"}'
```

Gateway bu fazda stub; `Refund.status = stub_completed`. Gerçek gateway entegrasyonu Faz 7.

## 9. Draft order → order dönüştürme

```bash
# Oluştur
curl -X POST http://localhost:3001/v1/orders/draft \
  -H "Authorization: Bearer <STAFF_JWT>" \
  -H "X-Tenant-Subdomain: kahve-dunyasi" \
  -d '{"customerId": "...", "lines": [{"variantId": "...", "quantity": 2}]}'

# Convert
curl -X POST http://localhost:3001/v1/orders/draft/{id}/convert \
  -H "Authorization: Bearer <STAFF_JWT>"
```

Convert sonrası: `isDraft=false`, `status=pending_payment`, `order.created` outbox event yayınlanır, envanter reserve edilir.

## 10. Seed re-run

```bash
pnpm --filter @ecf/db seed
```

Seed idempotent'tir; `subdomain`, `email`, `slug`, `sku`, `orderNumber` alanlarına göre upsert yapar. Mevcut veri bozulmaz, eksikler tamamlanır.

Tam reset için (dev):
```bash
pnpm --filter @ecf/db db:reset
```

## 11. Servis sağlık kontrolü

```bash
curl http://localhost:3001/v1/health/liveness        # proses ayakta mı
curl http://localhost:3001/v1/health/readiness       # DB+Redis hazır mı
curl http://localhost:3001/v1/health/db              # detaylı DB check
curl http://localhost:3001/metrics                   # prometheus format (landlord JWT gerektirir)
```

## 12. JWT anahtar rotasyonu

```bash
# 1. Yeni keypair üret
openssl genpkey -algorithm RSA -out private_v2.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in private_v2.pem -pubout -out public_v2.pem

# 2. .env'e JWT_PRIVATE_KEY / JWT_PUBLIC_KEY olarak yeni key'i koy (\n ile kaçış et)
# 3. Refresh token TTL boyunca (30 gün) eski public key'i ikinci key olarak doğrulamada tut
#    — AuthService.verify birden fazla key ile doğrulayacak şekilde güncellenmeli
# 4. API restart
# 5. TTL dolduktan sonra eski key'i kaldır
```

## 13. Observability

Detaylı metrik / log / alarm rehberi: [docs/observability.md](observability.md).

---

## Sorun giderme hızlı kılavuz

| Belirti | Muhtemel sebep | Kontrol |
|---------|---------------|---------|
| `/v1/products` boş dönüyor | tenantId context set edilmedi | `X-Tenant-Subdomain` header / JWT `tenantId` claim |
| Cross-tenant leak | RLS policy atlanmış | `SELECT * FROM pg_policies WHERE tablename='<tbl>';` |
| 403 forbidden (staff) | TenantMember eksik | `SELECT * FROM tenant_members WHERE user_id=...` |
| Stok negatif görünüyor | Reservation release edilmedi | `InventoryReservation.expiresAt` kontrol, cleanup job |
| Coupon uygulanmıyor | isActive / window / min-amount | `coupons` tablosu satırı + storefront cart logu |
| 503 storefront | tenant.status != active | `SELECT status FROM tenants WHERE subdomain=...` |
