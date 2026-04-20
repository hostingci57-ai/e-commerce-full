import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { prisma, prismaLandlord, type PrismaClient } from '@ecf/db';
import { metrics } from '../metrics/metrics.registry';

export const PRISMA = Symbol('PRISMA');
export const PRISMA_LANDLORD = Symbol('PRISMA_LANDLORD');

/** Attach a tiny Prisma `$use` middleware that records query duration. */
function instrument(client: PrismaClient): void {
  // `$use` is a no-op on newer Prisma when using extensions; the type is still
  // present as deprecated but works for our purpose (FSD MVP).
  const anyClient = client as unknown as {
    $use?: (fn: (params: { model?: string; action: string }, next: (p: unknown) => Promise<unknown>) => Promise<unknown>) => void;
    __ecfInstrumented?: boolean;
  };
  if (anyClient.__ecfInstrumented || typeof anyClient.$use !== 'function') return;
  anyClient.__ecfInstrumented = true;
  anyClient.$use(async (params, next) => {
    const started = process.hrtime.bigint();
    try {
      return await next(params);
    } finally {
      const durSec = Number(process.hrtime.bigint() - started) / 1e9;
      metrics.dbQueryDuration.observe(
        { operation: params.action, model: params.model ?? 'raw' },
        durSec,
      );
    }
  });
}

@Global()
@Module({
  providers: [
    { provide: PRISMA, useValue: prisma },
    { provide: PRISMA_LANDLORD, useValue: prismaLandlord },
  ],
  exports: [PRISMA, PRISMA_LANDLORD],
})
export class PrismaModule implements OnModuleInit {
  onModuleInit(): void {
    instrument(prisma);
    instrument(prismaLandlord);
  }
}
