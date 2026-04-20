import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { metrics } from './metrics.registry';

/**
 * Records HTTP request counts + latency into Prometheus metrics.
 * Uses the route template (e.g. `/v1/products/:id`) rather than the raw URL
 * so cardinality stays bounded.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const started = process.hrtime.bigint();
    const method = req.method ?? 'UNKNOWN';
    const pathTemplate = this.templateFor(req);

    const record = (statusCode: number): void => {
      const durSec = Number(process.hrtime.bigint() - started) / 1e9;
      metrics.httpRequestsTotal.inc({ method, status: String(statusCode), path: pathTemplate });
      metrics.httpRequestDuration.observe({ method, path: pathTemplate }, durSec);
    };

    return next.handle().pipe(
      tap({
        next: () => record(reply.statusCode ?? 200),
        error: () => record(reply.statusCode ?? 500),
      }),
    );
  }

  private templateFor(req: FastifyRequest): string {
    // Fastify + Nest expose the matched route on req.routeOptions.url (5.x)
    // or fall back to `req.routerPath` (older) — try both, then strip the URL.
    const fromRoute = (req as unknown as { routeOptions?: { url?: string } }).routeOptions?.url;
    if (fromRoute) return fromRoute;
    const routerPath = (req as unknown as { routerPath?: string }).routerPath;
    if (routerPath) return routerPath;
    // Strip query string from raw URL as last resort.
    const raw = (req.url ?? '/').split('?')[0] ?? '/';
    return raw;
  }
}
