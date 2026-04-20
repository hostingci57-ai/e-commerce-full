import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AppConfigModule } from './common/config/config.module';
import { RedisModule } from './common/redis/redis.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: (req) => (req.id as string) ?? crypto.randomUUID() },
    }),
    PrismaModule,
    RedisModule,
    TenancyModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
