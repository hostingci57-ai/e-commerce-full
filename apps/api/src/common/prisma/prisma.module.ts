import { Global, Module } from '@nestjs/common';
import { prisma, prismaLandlord } from '@ecf/db';

export const PRISMA = Symbol('PRISMA');
export const PRISMA_LANDLORD = Symbol('PRISMA_LANDLORD');

@Global()
@Module({
  providers: [
    { provide: PRISMA, useValue: prisma },
    { provide: PRISMA_LANDLORD, useValue: prismaLandlord },
  ],
  exports: [PRISMA, PRISMA_LANDLORD],
})
export class PrismaModule {}
