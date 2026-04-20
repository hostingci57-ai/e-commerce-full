import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizePemKey, type Env } from '@ecf/validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true }) as Env[K];
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProd(): boolean {
    return this.nodeEnv === 'production';
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.get('REDIS_URL');
  }

  get jwtPrivateKeyPem(): string {
    return normalizePemKey(this.get('JWT_PRIVATE_KEY'));
  }

  get jwtPublicKeyPem(): string {
    return normalizePemKey(this.get('JWT_PUBLIC_KEY'));
  }

  get jwtIssuer(): string {
    return this.get('JWT_ISSUER');
  }

  get jwtAccessTtl(): number {
    return this.get('JWT_ACCESS_TTL_SECONDS');
  }

  get jwtRefreshTtl(): number {
    return this.get('JWT_REFRESH_TTL_SECONDS');
  }
}
