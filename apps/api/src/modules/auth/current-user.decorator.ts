import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '@ecf/types';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Decorator that reads the authenticated user from CLS (populated by JwtGuard).
 * Usage:  @CurrentUser() user: AuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const req = ctx.switchToHttp().getRequest<{ ctx?: TenantContextService }>();
    // Fallback path — we don't really need it because the guard sets CLS
    // and downstream services read via TenantContextService directly.
    const rc = (req as unknown as { cls?: { get<T>(k: string): T | undefined } }).cls?.get<{
      tenant?: { tenantId: string } | null;
      userId?: string | null;
      customerId?: string | null;
      audience?: AuthenticatedUser['audience'];
      roles?: AuthenticatedUser['roles'];
      jti?: string | null;
    }>('ecf.requestContext');

    if (!rc || !rc.userId || !rc.audience) return null;
    return {
      userId: rc.userId,
      email: '',
      audience: rc.audience,
      tenantId: rc.tenant?.tenantId ?? null,
      customerId: rc.customerId ?? null,
      roles: rc.roles ?? [],
      jti: rc.jti ?? '',
    };
  },
);
