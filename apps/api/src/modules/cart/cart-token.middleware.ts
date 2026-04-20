import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Cookie name carrying the guest cart token. */
export const CART_TOKEN_COOKIE = 'cart_token';

/**
 * Ensures every incoming request has a cart_token. If the cookie is missing
 * or malformed, generate a fresh UUID and set it for the response (httpOnly,
 * sameSite=lax, 30d). The value is attached to `req.cartToken` for downstream
 * handlers to read without touching the header themselves.
 *
 * We deliberately only issue tokens for safe routes (GET) and cart/checkout
 * paths — other API endpoints do not need a cart token and shouldn't pay the
 * Set-Cookie overhead.
 */
@Injectable()
export class CartTokenMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const existing = this.readCookie(req.headers['cookie'] ?? null, CART_TOKEN_COOKIE);
    let token = existing && isUuid(existing) ? existing : null;
    if (!token) {
      token = randomUUID();
      this.setCookie(res, CART_TOKEN_COOKIE, token, 60 * 60 * 24 * 30);
    }
    (req as unknown as { cartToken?: string }).cartToken = token;
    next();
  }

  private readCookie(header: string | null, name: string): string | null {
    if (!header) return null;
    for (const part of header.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k === name && v) return decodeURIComponent(v);
    }
    return null;
  }

  private setCookie(res: FastifyReply['raw'], name: string, value: string, maxAgeSec: number): void {
    // Avoid overwriting Set-Cookie headers that may already be present.
    const existing = res.getHeader('Set-Cookie');
    const cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax`;
    if (!existing) {
      res.setHeader('Set-Cookie', cookie);
    } else if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, cookie]);
    } else {
      res.setHeader('Set-Cookie', [String(existing), cookie]);
    }
  }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Typed helper — retrieves the cart token the middleware attached. */
export function getCartToken(req: FastifyRequest): string | null {
  const raw = (req.raw as unknown as { cartToken?: string }).cartToken;
  return typeof raw === 'string' ? raw : null;
}
