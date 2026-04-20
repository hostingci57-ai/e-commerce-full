import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { BigIntSerializerInterceptor } from '../../src/common/interceptors/bigint-serializer.interceptor';

/**
 * Boot a Fastify NestJS app for e2e tests. Intentionally light — skips
 * request-logging, metrics, and swagger which are not needed for assertions
 * and add noise to test output.
 *
 * Environment:
 *   NODE_ENV=test  (skips the force-throw on missing CORS origins in main.ts)
 *   DATABASE_URL + REDIS_URL must be set by the caller's .env or setup script.
 */
export async function bootTestApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true, bodyLimit: 1 * 1024 * 1024 }),
    { bufferLogs: true, logger: ['error', 'warn'] },
  );

  app.setGlobalPrefix('v1', {
    exclude: ['health', 'health/ready', 'health/startup', 'metrics'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());

  await app.init();
  // Ensure the fastify adapter routes are ready even without listen().
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
