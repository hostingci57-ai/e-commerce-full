import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public, SkipTenancy } from '../tenancy/tenancy.decorators';
import { metrics } from './metrics.registry';

@ApiExcludeController()
@Controller('metrics')
@Public()
@SkipTenancy()
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return metrics.registry.metrics();
  }
}
