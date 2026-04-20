import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaClient, JwtAudience as DbJwtAudience } from '@ecf/db';
import type { AuthTokens, JwtAudience, RoleCode } from '@ecf/types';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

interface IssueTokensArgs {
  userId: string;
  email: string;
  audience: JwtAudience;
  tenantId: string | null;
  customerId: string | null;
  roles: RoleCode[];
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly refreshRepo: RefreshTokenRepository,
    private readonly ctx: TenantContextService,
  ) {}

  // --- Registration (customer) ----------------------------------------------

  async registerCustomer(args: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    acceptsMarketing?: boolean;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<AuthTokens & { userId: string; customerId: string }> {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({
        code: 'tenant_required',
        message: 'Tenant context required for customer registration',
      });
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: args.email } });
    const passwordHash = await this.passwords.hash(args.password);

    const { userId, customerId } = await this.prisma.$transaction(async (tx) => {
      let userRow = existingUser;
      if (!userRow) {
        userRow = await tx.user.create({
          data: {
            email: args.email,
            passwordHash,
            firstName: args.firstName ?? null,
            lastName: args.lastName ?? null,
          },
        });
      }

      const existingCustomer = await tx.customer.findUnique({
        where: { tenantId_email: { tenantId, email: args.email } },
      });
      if (existingCustomer) {
        throw new ConflictException({
          code: 'customer_exists',
          message: 'Customer with this email already exists for tenant',
        });
      }

      const customer = await tx.customer.create({
        data: {
          tenantId,
          userId: userRow.id,
          email: args.email,
          firstName: args.firstName ?? null,
          lastName: args.lastName ?? null,
          acceptsMarketing: args.acceptsMarketing ?? false,
        },
      });
      return { userId: userRow.id, customerId: customer.id };
    });

    const tokens = await this.issueTokens({
      userId,
      email: args.email,
      audience: 'customer',
      tenantId,
      customerId,
      roles: ['CUSTOMER'],
      ip: args.ip,
      userAgent: args.userAgent,
    });
    return { ...tokens, userId, customerId };
  }

  // --- Login (customer) -----------------------------------------------------

  async loginCustomer(args: {
    email: string;
    password: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<AuthTokens> {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { tenantId_email: { tenantId, email: args.email } },
      include: { user: true },
    });
    if (!customer || !customer.user) {
      throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid email or password' });
    }

    const ok = await this.passwords.verify(customer.user.passwordHash, args.password);
    if (!ok) {
      throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid email or password' });
    }

    return this.issueTokens({
      userId: customer.user.id,
      email: customer.user.email,
      audience: 'customer',
      tenantId,
      customerId: customer.id,
      roles: ['CUSTOMER'],
      ip: args.ip,
      userAgent: args.userAgent,
    });
  }

  // --- Login (staff) --------------------------------------------------------

  async loginStaff(args: {
    email: string;
    password: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<AuthTokens> {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { email: args.email } });
    if (!user) {
      throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid email or password' });
    }
    const ok = await this.passwords.verify(user.passwordHash, args.password);
    if (!ok) {
      throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid email or password' });
    }

    const member = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      include: { role: true },
    });
    if (!member || !member.acceptedAt) {
      throw new UnauthorizedException({
        code: 'not_tenant_member',
        message: 'User is not an active staff member of this tenant',
      });
    }

    const roles: RoleCode[] = [member.role.code as RoleCode];
    return this.issueTokens({
      userId: user.id,
      email: user.email,
      audience: 'staff',
      tenantId,
      customerId: null,
      roles,
      ip: args.ip,
      userAgent: args.userAgent,
    });
  }

  // --- Refresh rotation -----------------------------------------------------

  async refresh(args: {
    refreshToken: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<AuthTokens> {
    let payload: Awaited<ReturnType<JwtService['verifyRefresh']>>;
    try {
      payload = await this.jwt.verifyRefresh(args.refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: 'invalid_refresh_token',
        message: 'Refresh token invalid or expired',
      });
    }

    const row = await this.refreshRepo.findByRaw(args.refreshToken);
    if (!row || row.revokedAt) {
      // Reuse detection: revoke the whole chain for the user
      if (row?.userId) await this.refreshRepo.revokeAllForUser(row.userId);
      throw new UnauthorizedException({
        code: 'refresh_token_reuse',
        message: 'Refresh token already used or revoked',
      });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'refresh_token_expired',
        message: 'Refresh token expired',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) {
      throw new UnauthorizedException({ code: 'user_not_found', message: 'User not found' });
    }

    // Re-derive roles / customerId so rotated token reflects current state
    let roles: RoleCode[] = [];
    let customerId: string | null = null;
    const audience = row.audience as JwtAudience;

    if (audience === 'staff' && row.tenantId) {
      const member = await this.prisma.tenantMember.findUnique({
        where: { tenantId_userId: { tenantId: row.tenantId, userId: user.id } },
        include: { role: true },
      });
      if (!member) {
        throw new UnauthorizedException({ code: 'not_tenant_member', message: 'Staff membership revoked' });
      }
      roles = [member.role.code as RoleCode];
    } else if (audience === 'customer' && row.tenantId) {
      roles = ['CUSTOMER'];
      const customer = await this.prisma.customer.findUnique({
        where: { tenantId_email: { tenantId: row.tenantId, email: user.email } },
      });
      customerId = customer?.id ?? null;
    }

    // Issue new pair
    const tokens = await this.issueTokens({
      userId: user.id,
      email: user.email,
      audience,
      tenantId: row.tenantId ?? null,
      customerId,
      roles,
      ip: args.ip,
      userAgent: args.userAgent,
    });

    // Mark old row as revoked + replaced (find the newly issued id)
    const newRow = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenRepository.hash(tokens.refreshToken) },
    });
    await this.refreshRepo.revoke(row.id, newRow?.id ?? null);

    return tokens;
  }

  // --- Logout ---------------------------------------------------------------

  async logout(args: { refreshToken?: string; userId: string }): Promise<{ revoked: number }> {
    if (args.refreshToken) {
      const row = await this.refreshRepo.findByRaw(args.refreshToken);
      if (row && !row.revokedAt) {
        await this.refreshRepo.revoke(row.id);
        return { revoked: 1 };
      }
      return { revoked: 0 };
    }
    const revoked = await this.refreshRepo.revokeAllForUser(args.userId);
    return { revoked };
  }

  // --- Helpers --------------------------------------------------------------

  private async issueTokens(args: IssueTokensArgs): Promise<AuthTokens> {
    const access = await this.jwt.signAccess({
      userId: args.userId,
      email: args.email,
      audience: args.audience,
      tenantId: args.tenantId,
      customerId: args.customerId,
      roles: args.roles,
    });
    const refresh = await this.jwt.signRefresh({
      userId: args.userId,
      audience: args.audience,
      tenantId: args.tenantId,
    });

    await this.refreshRepo.issue({
      userId: args.userId,
      tenantId: args.tenantId,
      audience: args.audience as unknown as DbJwtAudience,
      rawToken: refresh.token,
      expiresAt: refresh.expiresAt,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshTokenExpiresIn: refresh.expiresIn,
      tokenType: 'Bearer',
    };
  }

  // --- /me ------------------------------------------------------------------

  async me(userId: string, tenantId: string | null, audience: JwtAudience) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'user_not_found', message: 'User not found' });

    if (audience === 'staff' && tenantId) {
      const member = await this.prisma.tenantMember.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        include: { role: true },
      });
      return { ...user, audience, tenantId, role: member?.role.code ?? null };
    }
    if (audience === 'customer' && tenantId) {
      const customer = await this.prisma.customer.findUnique({
        where: { tenantId_email: { tenantId, email: user.email } },
      });
      return { ...user, audience, tenantId, customerId: customer?.id ?? null };
    }
    return { ...user, audience };
  }
}
