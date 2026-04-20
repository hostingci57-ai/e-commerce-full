import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from './jwt.service';
import type { AppConfigService } from '../../common/config/config.service';

/**
 * Unit tests for JwtService: sign + verify roundtrip, audience enforcement,
 * expiry, refresh typ marker.
 */
function makeService(accessTtl = 300, refreshTtl = 1_800): JwtService {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const stubCfg = {
    jwtPrivateKeyPem: privateKey as string,
    jwtPublicKeyPem: publicKey as string,
    jwtIssuer: 'ecf-api-test',
    jwtAccessTtl: accessTtl,
    jwtRefreshTtl: refreshTtl,
  } as unknown as AppConfigService;

  return new JwtService(stubCfg);
}

describe('JwtService', () => {
  let service: JwtService;

  beforeAll(async () => {
    service = makeService(300, 1_800);
    await service.onModuleInit();
  });

  it('signAccess returns a parseable RS256 JWT with expected payload', async () => {
    const issued = await service.signAccess({
      userId: 'u-1',
      email: 'u1@example.com',
      audience: 'staff',
      tenantId: 't-1',
      roles: ['ADMIN'],
    });

    expect(typeof issued.token).toBe('string');
    expect(issued.token.split('.')).toHaveLength(3);
    expect(issued.expiresIn).toBe(300);
    expect(issued.payload.aud).toBe('staff');
    expect(issued.payload.tenantId).toBe('t-1');
    expect(issued.payload.roles).toEqual(['ADMIN']);
    expect(issued.payload.iss).toBe('ecf-api-test');
    expect(issued.payload.sub).toBe('u-1');
    expect(issued.jti).toBeTruthy();
  });

  it('verifyAccess roundtrip returns the issued payload', async () => {
    const issued = await service.signAccess({
      userId: 'u-2',
      email: 'u2@example.com',
      audience: 'customer',
      tenantId: 't-1',
      customerId: 'c-1',
    });
    const verified = await service.verifyAccess(issued.token);
    expect(verified.sub).toBe('u-2');
    expect(verified.aud).toBe('customer');
    expect(verified.customerId).toBe('c-1');
    expect(verified.email).toBe('u2@example.com');
  });

  it('verifyAccess rejects tokens signed with a different key', async () => {
    const { privateKey: otherPriv } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    // Build a second JwtService with the VALID public key but sign with an
    // attacker's private key → verification must fail.
    const { SignJWT, importPKCS8 } = await import('jose');
    const badKey = await importPKCS8(otherPriv as string, 'RS256');
    const forged = await new SignJWT({ sub: 'attacker', aud: 'staff' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('ecf-api-test')
      .setAudience('staff')
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(badKey);

    await expect(service.verifyAccess(forged)).rejects.toThrow();
  });

  it('verifyAccess rejects when audience filter does not match', async () => {
    const issued = await service.signAccess({
      userId: 'u-3',
      email: 'u3@example.com',
      audience: 'customer',
    });
    await expect(service.verifyAccess(issued.token, 'staff')).rejects.toThrow();
    // And accepts when the filter matches:
    const ok = await service.verifyAccess(issued.token, 'customer');
    expect(ok.sub).toBe('u-3');
  });

  it('verifyAccess rejects expired tokens', async () => {
    const fresh = makeService(1, 1);
    await fresh.onModuleInit();

    const issued = await fresh.signAccess({
      userId: 'u-exp',
      email: 'exp@example.com',
      audience: 'staff',
    });
    // Wait past the 1s TTL.
    await new Promise((r) => setTimeout(r, 1_500));
    await expect(fresh.verifyAccess(issued.token)).rejects.toThrow();
  });

  it('signRefresh embeds typ=refresh and verifyRefresh only accepts that typ', async () => {
    const issued = await service.signRefresh({
      userId: 'u-r',
      audience: 'staff',
      tenantId: 't-r',
    });
    const payload = await service.verifyRefresh(issued.token);
    expect(payload.typ).toBe('refresh');
    expect(payload.aud).toBe('staff');
    expect(payload.tenantId).toBe('t-r');
  });

  it('verifyRefresh rejects an access token (missing typ=refresh)', async () => {
    const access = await service.signAccess({
      userId: 'u-a',
      email: 'a@example.com',
      audience: 'staff',
    });
    await expect(service.verifyRefresh(access.token)).rejects.toThrow();
  });
});
