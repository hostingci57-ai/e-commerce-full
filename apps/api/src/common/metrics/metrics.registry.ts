import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Central Prometheus registry. A single shared instance avoids duplicate-metric
 * registration when modules are reloaded (dev) or re-imported (tests).
 */
class MetricsRegistryHolder {
  private static instance: MetricsRegistryHolder | null = null;

  readonly registry: Registry;
  readonly httpRequestsTotal: Counter<'method' | 'status' | 'path'>;
  readonly httpRequestDuration: Histogram<'method' | 'path'>;
  readonly dbQueryDuration: Histogram<'operation' | 'model'>;
  readonly outboxEventsPublished: Counter<'event_type'>;
  readonly outboxEventsFailed: Counter<'event_type'>;
  readonly webhookDeliveries: Counter<'event_type' | 'outcome'>;
  readonly emailDeliveries: Counter<'template' | 'outcome'>;
  readonly cartOperations: Counter<'op'>;

  private constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry, prefix: 'ecf_' });

    this.httpRequestsTotal = new Counter({
      name: 'ecf_http_requests_total',
      help: 'Total HTTP requests.',
      labelNames: ['method', 'status', 'path'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'ecf_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'path'] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'ecf_db_query_duration_seconds',
      help: 'Prisma query duration in seconds.',
      labelNames: ['operation', 'model'] as const,
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    this.outboxEventsPublished = new Counter({
      name: 'ecf_outbox_events_published_total',
      help: 'Total outbox events successfully published.',
      labelNames: ['event_type'] as const,
      registers: [this.registry],
    });

    this.outboxEventsFailed = new Counter({
      name: 'ecf_outbox_events_failed_total',
      help: 'Outbox events that exceeded max attempts and were marked failed.',
      labelNames: ['event_type'] as const,
      registers: [this.registry],
    });

    this.webhookDeliveries = new Counter({
      name: 'ecf_webhook_deliveries_total',
      help: 'Webhook HTTP deliveries by outcome.',
      labelNames: ['event_type', 'outcome'] as const,
      registers: [this.registry],
    });

    this.emailDeliveries = new Counter({
      name: 'ecf_email_deliveries_total',
      help: 'Email deliveries by outcome.',
      labelNames: ['template', 'outcome'] as const,
      registers: [this.registry],
    });

    this.cartOperations = new Counter({
      name: 'ecf_cart_operations_total',
      help: 'Total cart operations (add/update/remove/checkout).',
      labelNames: ['op'] as const,
      registers: [this.registry],
    });
  }

  static get(): MetricsRegistryHolder {
    if (!MetricsRegistryHolder.instance) {
      MetricsRegistryHolder.instance = new MetricsRegistryHolder();
    }
    return MetricsRegistryHolder.instance;
  }
}

export const metrics = MetricsRegistryHolder.get();
export type MetricsRegistry = typeof metrics;
