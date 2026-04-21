import { Module } from '@nestjs/common';
import { ShippingRegistryService } from './shipping-registry.service';
import { FlatRateShippingProvider } from './providers/flat-rate.provider';
import { FreeShippingProvider } from './providers/free-shipping.provider';
import { ManualShippingProvider } from './providers/manual.provider';

@Module({
  providers: [
    FlatRateShippingProvider,
    FreeShippingProvider,
    ManualShippingProvider,
    ShippingRegistryService,
  ],
  exports: [ShippingRegistryService],
})
export class ShippingModule {}
