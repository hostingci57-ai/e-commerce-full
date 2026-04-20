import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { metrics } from './metrics.registry';

export const METRICS = Symbol('METRICS');

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsInterceptor, { provide: METRICS, useValue: metrics }],
  exports: [MetricsInterceptor, METRICS],
})
export class MetricsModule {}
