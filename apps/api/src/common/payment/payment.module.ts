import { Module } from '@nestjs/common';
import { PaymentRegistryService } from './payment-registry.service';
import { CodPaymentProvider } from './providers/cod.provider';
import { BankTransferPaymentProvider } from './providers/bank-transfer.provider';
import { StubCardPaymentProvider } from './providers/stub-card.provider';
import { ManualPaymentProvider } from './providers/manual.provider';

@Module({
  providers: [
    CodPaymentProvider,
    BankTransferPaymentProvider,
    StubCardPaymentProvider,
    ManualPaymentProvider,
    PaymentRegistryService,
  ],
  exports: [PaymentRegistryService],
})
export class PaymentModule {}
