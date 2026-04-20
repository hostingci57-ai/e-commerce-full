import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { logger } from '../logging/logger';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly ctx?: TenantContextService) {}

  intercept(c: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = c.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.emit(req, reply, started, null),
        error: (err) => this.emit(req, reply, started, err as Error),
      }),
    );
  }

  private emit(
    req: FastifyRequest,
    reply: FastifyReply,
    started: bigint,
    err: Error | null,
  ): void {
    const durationMs = Math.round((Number(process.hrtime.bigint() - started) / 1e6) * 100) / 100;
    const rc = this.ctx?.get();
    const base = {
      reqId: req.id ?? rc?.requestId ?? null,
      tenantId: rc?.tenant?.tenantId ?? null,
      userId: rc?.userId ?? null,
      method: req.method,
      path: this.pathTemplate(req) ?? req.url,
      status: reply.statusCode,
      durationMs,
    };
    if (err) {
      logger.warn({ ...base, err: err.message }, 'req_err');
    } else {
      logger.info(base, 'req');
    }
  }

  private pathTemplate(req: FastifyRequest): string | null {
    const fromRoute = (req as unknown as { routeOptions?: { url?: string } }).routeOptions?.url;
    if (fromRoute) return fromRoute;
    const routerPath = (req as unknown as { routerPath?: string }).routerPath;
    if (routerPath) return routerPath;
    return null;
  }
}
