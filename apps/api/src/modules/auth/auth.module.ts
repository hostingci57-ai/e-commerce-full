import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { JwtGuard } from './guards/jwt.guard';
import { OptionalJwtGuard } from './guards/optional-jwt.guard';
import { LandlordGuard } from './guards/landlord.guard';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';

@Module({
  providers: [
    AuthService,
    JwtService,
    PasswordService,
    RefreshTokenRepository,
    JwtGuard,
    OptionalJwtGuard,
    LandlordGuard,
    TenantContextService,
    AbilityFactory,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtService, JwtGuard, OptionalJwtGuard, LandlordGuard],
})
export class AuthModule {}
