import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export interface InjectOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  payload?: unknown;
}

export interface InjectResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json<T = unknown>(): T;
}

/**
 * Thin wrapper around fastify.inject so tests read a small, predictable API.
 * Each call goes through the full middleware/guard/interceptor stack.
 */
export async function inject(app: NestFastifyApplication, opts: InjectOptions): Promise<InjectResponse> {
  const res = await app.getHttpAdapter().getInstance().inject({
    method: opts.method ?? 'GET',
    url: opts.url,
    headers: opts.headers,
    payload: opts.payload as object | undefined,
  });
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
    json<T>() {
      return JSON.parse(res.body) as T;
    },
  };
}
