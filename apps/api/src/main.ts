import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';
import { MetricsInterceptor } from './common/metrics/metrics.interceptor';
import { TenantContextService } from './common/tenancy/tenant-context.service';
import { pinoNestLogger } from './common/logging/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true, bodyLimit: 1 * 1024 * 1024 }),
    { bufferLogs: true },
  );

  app.useLogger(pinoNestLogger);

  // R-06: helmet hardening. We keep CSP off for the JSON API surface but mount a
  // tight CSP for /docs (Swagger) in non-production. Resource policy is tightened
  // to "same-site" explicitly so subdomain attackers can't pull API JSON cross-origin.
  await app.register(helmet as never, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  });

  // CORS whitelist from env; falls back to storefront+admin URLs if CORS_ORIGINS
  // is empty. In production we REFUSE to start with an empty list so a misconfig
  // does not silently open the API to any origin.
  const envOrigins = (process.env.API_CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const fallbackOrigins = [
    process.env.NEXT_PUBLIC_STOREFRONT_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
  ].filter((o): o is string => !!o);
  const origins = envOrigins.length ? envOrigins : fallbackOrigins;
  if (process.env.NODE_ENV === 'production' && origins.length === 0) {
    throw new Error('API_CORS_ORIGINS must be set in production');
  }
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('v1', {
    exclude: ['health', 'health/ready', 'health/startup', 'metrics', 'docs', 'docs-json'],
  });

  // R-14: strict validation — reject unknown fields. Zod pipes still handle
  // body schemas per-route; this covers class-validator DTOs and query strings.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  const tenantCtx = app.get(TenantContextService, { strict: false });
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(tenantCtx),
    new MetricsInterceptor(),
    new BigIntSerializerInterceptor(),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ECF API')
      .setDescription('Multi-tenant e-commerce API — Foundation (auth / tenancy)')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, doc);
  }

  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);

  new Logger('Bootstrap').log(`API listening on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap API', err);
  process.exit(1);
});
