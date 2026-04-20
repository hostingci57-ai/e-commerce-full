import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class LandlordGuard implements CanActivate {
  constructor(private readonly ctx: TenantContextService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.ctx.isLandlord) {
      throw new ForbiddenException({ code: 'landlord_only', message: 'Landlord scope required' });
    }
    return true;
  }
}
