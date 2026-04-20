/**
 * Thin fetch wrapper that injects the landlord access token and normalises
 * error responses. All calls must be made client-side — landlord admin is a
 * SPA-style app with no SSR fetches (the API may not exist at build time).
 */
import { getToken, clearToken } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://api.localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const h = new Headers(headers ?? {});
  h.set('Accept', 'application/json');
  if (body !== undefined) h.set('Content-Type', 'application/json');
  if (auth) {
    const token = getToken();
    if (token) h.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await res.text();
  const data: unknown = raw ? safeJsonParse(raw) : null;

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const err = extractError(data);
    throw new ApiError(err.message, res.status, err.code, data);
  }

  return data as T;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function extractError(data: unknown): { message: string; code?: string } {
  if (data && typeof data === 'object') {
    const maybeMsg = (data as { message?: unknown }).message;
    const maybeCode = (data as { code?: unknown }).code;
    if (typeof maybeMsg === 'string') {
      return {
        message: maybeMsg,
        code: typeof maybeCode === 'string' ? maybeCode : undefined,
      };
    }
  }
  return { message: 'Request failed' };
}
