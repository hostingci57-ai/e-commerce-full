import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  CustomerRegisterSchema,
  LoginSchema,
  LogoutSchema,
  RefreshSchema,
  type CustomerRegisterInput,
  type LoginInput,
  type LogoutInput,
  type RefreshInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { Public } from '../../common/tenancy/tenancy.decorators';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly ctx: TenantContextService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('customer/register')
  async registerCustomer(
    @Body(new ZodValidationPipe(CustomerRegisterSchema)) body: CustomerRegisterInput,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.registerCustomer({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('customer/login')
  async loginCustomer(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.loginCustomer({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('staff/login')
  async loginStaff(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.loginStaff({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('landlord/login')
  async loginLandlord(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.loginLandlord({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.refresh({
      refreshToken: body.refreshToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body(new ZodValidationPipe(LogoutSchema)) body: LogoutInput) {
    const userId = this.ctx.userId;
    if (!userId) return { revoked: 0 };
    return this.auth.logout({ refreshToken: body.refreshToken, userId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Get('me')
  async me() {
    const rc = this.ctx.get();
    if (!rc?.userId || !rc.audience) {
      return { authenticated: false };
    }
    return this.auth.me(rc.userId, rc.tenant?.tenantId ?? null, rc.audience);
  }
}
