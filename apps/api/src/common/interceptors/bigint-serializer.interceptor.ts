import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Converts `bigint` values to strings recursively on response bodies.
 * Fastify's JSON serializer throws on bigint; money columns are stored as
 * `BigInt` in Prisma, so we stringify once at the controller boundary.
 */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(convert));
  }
}

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(convert);
  if (typeof value === 'object') {
    // Preserve Date, Buffer etc. by returning untouched unless it's a plain object.
    if (value instanceof Date) return value;
    if (Buffer.isBuffer?.(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = convert(v);
    return out;
  }
  return value;
}
