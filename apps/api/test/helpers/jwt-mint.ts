import { SignJWT, importPKCS8 } from 'jose';
import { randomUUID } from 'node:crypto';
import type { JwtAudience, JwtPayload, RoleCode } from '@ecf/types';
import { normalizePemKey } from '@ecf/validation';

/**
 * Mint an access JWT directly using the project's RS256 private key (read
 * from JWT_PRIVATE_KEY env). Bypasses the NestJS DI graph so tests can cheaply
 * forge access tokens for seeded users without hitting /v1/auth/login.
 */
export interface MintAccessArgs {
  userId: string;
  audience: JwtAudience;
  tenantId?: string | null;
  customerId?: string | null;
  roles?: RoleCode[];
  email?: string;
  ttlSeconds?: number;
  issuer?: string;
}

export async function mintAccessToken(args: MintAccessArgs): Promise<string> {
  const pem = normalizePemKey(process.env.JWT_PRIVATE_KEY ?? '');
  if (!pem) throw new Error('JWT_PRIVATE_KEY not set — mintAccessToken requires it');

  const pk = await importPKCS8(pem, 'RS256');
  const iat = Math.floor(Date.now() / 1000);
  const ttl = args.ttlSeconds ?? 300;
  const exp = iat + ttl;
  const jti = randomUUID();
  const issuer = args.issuer ?? process.env.JWT_ISSUER ?? 'ecf-api';

  const payload: JwtPayload = {
    sub: args.userId,
    aud: args.audience,
    iss: issuer,
    iat,
    exp,
    jti,
    email: args.email ?? `${args.userId}@test.local`,
    ...(args.tenantId ? { tenantId: args.tenantId } : {}),
    ...(args.customerId ? { customerId: args.customerId } : {}),
    ...(args.roles?.length ? { roles: args.roles } : {}),
  };

  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'RS256', kid: 'ecf-default' })
    .setIssuedAt(iat)
    .setIssuer(issuer)
    .setAudience(args.audience)
    .setExpirationTime(exp)
    .setJti(jti)
    .setSubject(args.userId)
    .sign(pk);
}

/** Forge a JWT signed by a random attacker key — for 401 assertions. */
export async function mintForgedToken(args: Omit<MintAccessArgs, 'ttlSeconds'>): Promise<string> {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const pk = await importPKCS8(privateKey as string, 'RS256');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 300;
  const jti = randomUUID();
  const issuer = args.issuer ?? process.env.JWT_ISSUER ?? 'ecf-api';
  return new SignJWT({
    sub: args.userId,
    aud: args.audience,
    iss: issuer,
    iat,
    exp,
    jti,
    email: args.email ?? 'forged@test.local',
    ...(args.tenantId ? { tenantId: args.tenantId } : {}),
    ...(args.customerId ? { customerId: args.customerId } : {}),
    ...(args.roles?.length ? { roles: args.roles } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'ecf-default' })
    .setIssuedAt(iat)
    .setIssuer(issuer)
    .setAudience(args.audience)
    .setExpirationTime(exp)
    .setJti(jti)
    .setSubject(args.userId)
    .sign(pk);
}
