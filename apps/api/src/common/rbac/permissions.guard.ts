import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AbilityFactory } from './ability.factory';
import { ABILITIES_KEY, type RequiredAbility } from './permissions.decorator';
import type { RoleCode } from '@ecf/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ctx: TenantContextService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndMerge<RequiredAbility[]>(ABILITIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const rc = this.ctx.get();
    if (!rc || !rc.audience) {
      throw new ForbiddenException({ code: 'unauthenticated', message: 'Authentication required' });
    }

    const ability = this.abilityFactory.createForUser({
      audience: rc.audience,
      roles: ((rc as unknown as { roles?: RoleCode[] }).roles) ?? [],
      userId: rc.userId ?? null,
      tenantId: rc.tenant?.tenantId ?? null,
      customerId: rc.customerId ?? null,
    });

    for (const { action, subject } of required) {
      if (!ability.can(action, subject)) {
        throw new ForbiddenException({
          code: 'forbidden',
          message: `Missing ability: ${action} ${subject}`,
        });
      }
    }
    return true;
  }
}
