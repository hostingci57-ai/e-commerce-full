# Observability

API health, logs and metrics. Target scrapes:

- Liveness + readiness probes by the orchestrator (Kubernetes / Docker Swarm)
- Prometheus metrics scraped every 15s
- Structured JSON logs ingested by Loki/Elasticsearch

---

## Health endpoints

All are served without the `/v1` prefix and require no auth.

| Endpoint | Purpose | Success | Failure |
|---|---|---|---|
| `GET /health` | Liveness — process is running. Never hits dependencies. | `200` `{ status: "ok", service: "api", ts }` | Only if the process itself is dead (TCP refused) |
| `GET /health/ready` | Readiness — the process can serve traffic. Checks DB, Redis, MinIO. | `200` with each dependency `status: "up"` | `503` if any dependency is down |
| `GET /health/startup` | Startup probe — DB migration has run (tenants table reachable). | `200` | `503` while migrations are still pending |

### Readiness payload shape

```json
{
  "status": "ok",
  "info":   { "db": { "status": "up" }, "redis": { "status": "up" }, "s3": { "status": "up" } },
  "error":  {},
  "details": { "db": { "status": "up" }, "redis": { "status": "up" }, "s3": { "status": "up" } }
}
```

If MinIO/S3 is not configured (no `S3_ENDPOINT` / `MINIO_ENDPOINT` env) the
check reports `s3: { status: "up", note: "not_configured" }` so readiness does
not falsely fail in environments without object storage.

---

## Metrics

Prometheus exposition format, `GET /metrics`.

### Default Node.js (`ecf_` prefix)

Standard `prom-client` default collectors:

- `ecf_process_cpu_user_seconds_total`, `ecf_process_cpu_system_seconds_total`
- `ecf_process_resident_memory_bytes`, `ecf_process_heap_bytes`
- `ecf_nodejs_eventloop_lag_seconds`, `ecf_nodejs_eventloop_lag_p99_seconds`
- `ecf_nodejs_gc_duration_seconds`

### Custom application metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `ecf_http_requests_total` | counter | `method`, `status`, `path` | Total HTTP requests; `path` is the route template (e.g. `/v1/products/:id`). |
| `ecf_http_request_duration_seconds` | histogram | `method`, `path` | Request latency in seconds. Buckets: 5ms .. 5s. |
| `ecf_db_query_duration_seconds` | histogram | `operation`, `model` | Prisma query duration. `operation` = Prisma action (`findMany`, `create`, …). |
| `ecf_outbox_events_published_total` | counter | `event_type` | Outbox events written (dispatcher publishes them to the broker). |
| `ecf_cart_operations_total` | counter | `op` | `add` / `update` / `remove` / `clear` cart mutations. |

### Recommended Prometheus scrape config

```yaml
scrape_configs:
  - job_name: ecf-api
    metrics_path: /metrics
    scrape_interval: 15s
    static_configs:
      - targets: ['api:3001']
```

### Useful queries

```promql
# p95 latency per route (last 5m)
histogram_quantile(
  0.95,
  sum by (le, method, path) (rate(ecf_http_request_duration_seconds_bucket[5m]))
)

# Error rate (%) per route
100 *
sum by (path) (rate(ecf_http_requests_total{status=~"5.."}[5m]))
/ ignoring(status)
sum by (path) (rate(ecf_http_requests_total[5m]))

# Cart conversions — add-to-cart vs checkout completion
rate(ecf_cart_operations_total{op="add"}[5m])
```

---

## Structured logs (pino)

One JSON object per HTTP request, emitted by `RequestLoggingInterceptor`. Keys:

| Field | Source | Example |
|---|---|---|
| `timestamp` | pino ISO time | `2025-05-11T08:12:03.411Z` |
| `level` | pino level name | `info`, `warn`, `error` |
| `msg` | event label | `req`, `req_err` |
| `reqId` | `nestjs-cls` request id (mirrors `X-Request-Id`) | UUID v4 |
| `tenantId` | resolved tenant in CLS | UUID v4 |
| `userId` | JWT `sub` after auth guard | UUID v4 or null |
| `method` | HTTP verb | `GET` |
| `path` | route template | `/v1/products/:id` |
| `status` | response status | `200` |
| `durationMs` | measured wall time | `12.4` |

### Redaction

Pino `redact.paths` automatically masks:

- `req.headers.authorization`, `req.headers.cookie`
- `password`, `*.password`, `passwordHash`, `*.passwordHash`
- `tokenHash`, `*.tokenHash`
- `accessToken`, `*.accessToken`, `refreshToken`, `*.refreshToken`

Never log a full JWT or raw password — if a new sensitive field is introduced,
add it to `REDACT_PATHS` in `apps/api/src/common/logging/logger.ts`.

---

## Related source

- `apps/api/src/modules/health/health.controller.ts`
- `apps/api/src/common/metrics/metrics.registry.ts`
- `apps/api/src/common/metrics/metrics.interceptor.ts`
- `apps/api/src/common/logging/logger.ts`
- `apps/api/src/common/interceptors/request-logging.interceptor.ts`
