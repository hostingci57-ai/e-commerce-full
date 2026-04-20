import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { logger } from '../logging/logger';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const durMs = Number(process.hrtime.bigint() - started) / 1e6;
          logger.info(
            {
              requestId: req.id,
              method: req.method,
              url: req.url,
              status: reply.statusCode,
              durMs: Math.round(durMs * 100) / 100,
            },
            'req',
          );
        },
        error: (err) => {
          const durMs = Number(process.hrtime.bigint() - started) / 1e6;
          logger.warn(
            {
              requestId: req.id,
              method: req.method,
              url: req.url,
              status: reply.statusCode,
              durMs: Math.round(durMs * 100) / 100,
              err: (err as Error).message,
            },
            'req_err',
          );
        },
      }),
    );
  }
}
