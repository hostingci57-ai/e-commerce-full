import { SetMetadata } from '@nestjs/common';

/** Marks a handler or controller as exempt from TenantGuard. */
export const SKIP_TENANCY = 'ecf:skip-tenancy';
export const SkipTenancy = (): ClassDecorator & MethodDecorator => SetMetadata(SKIP_TENANCY, true);

/** Marks a route as publicly accessible (skips JwtGuard). */
export const IS_PUBLIC = 'ecf:public';
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC, true);
