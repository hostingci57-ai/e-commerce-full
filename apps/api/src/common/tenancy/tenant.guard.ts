import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { SKIP_TENANCY } from './tenancy.decorators';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANCY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;
    if (this.ctx.isLandlord) return true;
    if (!this.ctx.tenantId) {
      throw new ForbiddenException({ code: 'tenant_required', message: 'Tenant context required' });
    }
    return true;
  }
}
