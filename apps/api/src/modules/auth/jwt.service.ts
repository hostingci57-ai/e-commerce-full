import { Injectable, OnModuleInit } from '@nestjs/common';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike } from 'jose';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../common/config/config.service';
import type { JwtAudience, JwtPayload, RefreshTokenPayload, RoleCode } from '@ecf/types';

const ALG = 'RS256';

export interface IssueAccessArgs {
  userId: string;
  email: string;
  audience: JwtAudience;
  tenantId?: string | null;
  customerId?: string | null;
  roles?: RoleCode[];
}

export interface IssueRefreshArgs {
  userId: string;
  audience: JwtAudience;
  tenantId?: string | null;
}

export interface IssuedAccess {
  token: string;
  jti: string;
  expiresAt: Date;
  expiresIn: number;
  payload: JwtPayload;
}

export interface IssuedRefresh {
  token: string;
  jti: string;
  expiresAt: Date;
  expiresIn: number;
}

@Injectable()
export class JwtService implements OnModuleInit {
  private privateKey!: KeyLike;
  private publicKey!: KeyLike;

  constructor(private readonly cfg: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    this.privateKey = await importPKCS8(this.cfg.jwtPrivateKeyPem, ALG);
    this.publicKey = await importSPKI(this.cfg.jwtPublicKeyPem, ALG);
  }

  async signAccess(args: IssueAccessArgs): Promise<IssuedAccess> {
    const ttl = this.cfg.jwtAccessTtl;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ttl;
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: args.userId,
      aud: args.audience,
      iss: this.cfg.jwtIssuer,
      iat,
      exp,
      jti,
      email: args.email,
      ...(args.tenantId ? { tenantId: args.tenantId } : {}),
      ...(args.customerId ? { customerId: args.customerId } : {}),
      ...(args.roles?.length ? { roles: args.roles } : {}),
    };

    const token = await new SignJWT({ ...payload } as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: ALG, kid: 'ecf-default' })
      .setIssuedAt(iat)
      .setIssuer(this.cfg.jwtIssuer)
      .setAudience(args.audience)
      .setExpirationTime(exp)
      .setJti(jti)
      .setSubject(args.userId)
      .sign(this.privateKey);

    return { token, jti, expiresAt: new Date(exp * 1000), expiresIn: ttl, payload };
  }

  async signRefresh(args: IssueRefreshArgs): Promise<IssuedRefresh> {
    const ttl = this.cfg.jwtRefreshTtl;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ttl;
    const jti = randomUUID();

    const token = await new SignJWT({
      typ: 'refresh',
      ...(args.tenantId ? { tenantId: args.tenantId } : {}),
    })
      .setProtectedHeader({ alg: ALG, kid: 'ecf-default' })
      .setIssuedAt(iat)
      .setIssuer(this.cfg.jwtIssuer)
      .setAudience(args.audience)
      .setExpirationTime(exp)
      .setJti(jti)
      .setSubject(args.userId)
      .sign(this.privateKey);

    return { token, jti, expiresAt: new Date(exp * 1000), expiresIn: ttl };
  }

  async verifyAccess(token: string, audience?: JwtAudience | JwtAudience[]): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: this.cfg.jwtIssuer,
      audience,
      algorithms: [ALG],
    });
    return payload as unknown as JwtPayload;
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: this.cfg.jwtIssuer,
      algorithms: [ALG],
    });
    if ((payload as { typ?: string }).typ !== 'refresh') {
      throw new Error('Not a refresh token');
    }
    return payload as unknown as RefreshTokenPayload;
  }
}
