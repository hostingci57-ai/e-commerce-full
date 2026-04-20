import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { JwtService } from '../jwt.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { IS_PUBLIC } from '../../../common/tenancy/tenancy.decorators';
import type { JwtPayload } from '@ecf/types';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly ctx: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers['authorization'] ?? '';
    const token = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : null;
    if (!token) {
      throw new UnauthorizedException({ code: 'missing_bearer_token', message: 'Missing bearer token' });
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAccess(token);
    } catch {
      throw new UnauthorizedException({ code: 'invalid_token', message: 'Invalid or expired token' });
    }

    this.ctx.init({
      userId: payload.sub,
      customerId: payload.customerId ?? null,
      audience: payload.aud,
      roles: payload.roles ?? [],
      jti: payload.jti,
      isLandlord: payload.aud === 'landlord',
    });

    // For staff/customer tokens, if no tenant has been resolved by subdomain yet,
    // fall back to the tenantId claim.
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
