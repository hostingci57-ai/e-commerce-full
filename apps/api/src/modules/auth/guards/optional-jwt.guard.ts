import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtService } from '../jwt.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import type { JwtPayload } from '@ecf/types';

/**
 * Soft authentication guard for routes that serve both guests AND members
 * (cart, checkout). When a Bearer token is present and valid, the guard
 * hydrates `TenantContextService` with the user/customer payload so that
 * downstream services (CartService.resolveOwner etc.) can route to member
 * keys. When the token is missing or invalid, the guard silently passes —
 * the request proceeds as a guest.
 *
 * Never throws 401. Use plain `JwtGuard` for endpoints that require auth.
 */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly ctx: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers['authorization'] ?? '';
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length).trim()
        : null;
    if (!token) return true;

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAccess(token);
    } catch {
      // Invalid / expired token on an optional-auth route: treat as guest.
      return true;
    }

    this.ctx.init({
      userId: payload.sub,
      customerId: payload.customerId ?? null,
      audience: payload.aud,
      roles: payload.roles ?? [],
      jti: payload.jti,
      isLandlord: payload.aud === 'landlord',
    });

    // Fallback tenant hydration when subdomain resolver did not run
    // (e.g. direct api. hostname). Matches JwtGuard behaviour.
    const current = this.ctx.get();
    if (payload.tenantId && !current?.tenant) {
      this.ctx.setTenant({
        tenantId: payload.tenantId,
        subdomain: '',
        status: 'active',
      });
    }

    return true;
  }
}
