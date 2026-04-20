'use client';

import { API_PREFIX, API_URL } from './env';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './auth-store';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip auth header (for /auth/staff/login, /auth/refresh). */
  skipAuth?: boolean;
  /** Internal flag to avoid infinite refresh loop. */
  _retried?: boolean;
};

function buildUrl(
  path: string,
  query?: FetchOptions['query'],
): string {
  const base = `${API_URL}${API_PREFIX}`;
  const url = new URL(
    path.startsWith('/') ? `${base}${path}` : `${base}/${path}`,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

let inflightRefresh: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  inflightRefresh = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!opts.skipAuth) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    credentials: 'include',
  });

  if (res.status === 401 && !opts.skipAuth && !opts._retried) {
    const ok = await tryRefresh();
    if (ok) {
      return apiFetch<T>(path, { ...opts, _retried: true });
    }
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401, 'unauthorized');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const msg =
      (data as { message?: string } | null)?.message ||
      `Request failed with status ${res.status}`;
    const code = (data as { code?: string } | null)?.code;
    throw new ApiError(msg, res.status, code, data);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string, query?: FetchOptions['query']) =>
    apiFetch<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown, opts: Partial<FetchOptions> = {}) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
