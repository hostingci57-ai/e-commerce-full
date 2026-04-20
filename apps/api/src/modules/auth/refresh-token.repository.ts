import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { JwtAudience, PrismaClient } from '@ecf/db';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';

/**
 * Refresh tokens are stored hashed (SHA-256) so a DB leak cannot be replayed.
 * We always write/read via the landlord PrismaClient (BYPASSRLS): refresh
 * rotation needs cross-tenant-ish access and the tenantId column itself is
 * the scoping guarantee.
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(params: {
    userId: string;
    tenantId: string | null;
    audience: JwtAudience;
    rawToken: string;
    expiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: params.userId,
        tenantId: params.tenantId,
        audience: params.audience,
        tokenHash: RefreshTokenRepository.hash(params.rawToken),
        expiresAt: params.expiresAt,
        issuedIp: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  /** Look up a token row by hash, regardless of status. */
  async findByRaw(token: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenRepository.hash(token) },
    });
  }

  /** Mark a row revoked and, optionally, link to its replacement. */
  async revoke(id: string, replacedById?: string | null): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById: replacedById ?? null },
    });
  }

  /** Revoke all active refresh tokens for a user (logout-all). */
  async revokeAllForUser(userId: string): Promise<number> {
    const res = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }
}
