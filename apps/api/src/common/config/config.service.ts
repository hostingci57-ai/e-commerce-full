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

  // -------- Outbox / queues ------------------------------------------------
  get workersEnabled(): boolean {
    return this.get('WORKERS_ENABLED');
  }
  get outboxDispatchIntervalMs(): number {
    return this.get('OUTBOX_DISPATCH_INTERVAL_MS');
  }
  get outboxDispatchBatchSize(): number {
    return this.get('OUTBOX_DISPATCH_BATCH_SIZE');
  }
  get outboxMaxAttempts(): number {
    return this.get('OUTBOX_MAX_ATTEMPTS');
  }

  // -------- Email ----------------------------------------------------------
  get emailProvider(): 'console' | 'smtp' {
    return this.get('EMAIL_PROVIDER');
  }
  get emailFrom(): string {
    return this.get('EMAIL_FROM');
  }
  get smtp(): {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    secure: boolean;
  } {
    return {
      host: this.get('SMTP_HOST'),
      port: this.get('SMTP_PORT'),
      user: this.get('SMTP_USER'),
      pass: this.get('SMTP_PASS'),
      secure: this.get('SMTP_SECURE'),
    };
  }

  // -------- Webhooks -------------------------------------------------------
  get webhookTimeoutMs(): number {
    return this.get('WEBHOOK_TIMEOUT_MS');
  }
  get webhookAutoDisableThreshold(): number {
    return this.get('WEBHOOK_AUTO_DISABLE_THRESHOLD');
  }

  // -------- Media / S3 -----------------------------------------------------
  get s3(): {
    endpoint?: string;
    region: string;
    accessKey?: string;
    secretKey?: string;
    bucket: string;
    forcePathStyle: boolean;
  } {
    return {
      endpoint: this.get('S3_ENDPOINT'),
      region: this.get('S3_REGION'),
      accessKey: this.get('S3_ACCESS_KEY'),
      secretKey: this.get('S3_SECRET_KEY'),
      bucket: this.get('S3_BUCKET'),
      forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
    };
  }
  get mediaMaxBytes(): number {
    return this.get('MEDIA_MAX_BYTES');
  }
  get mediaUrlTtl(): number {
    return this.get('MEDIA_URL_TTL');
  }
}
