import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvSchema } from '@ecf/validation';
import { AppConfigService } from './config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => {
        const parsed = EnvSchema.safeParse(raw);
        if (!parsed.success) {
          // eslint-disable-next-line no-console
          console.error('[config] Invalid environment:', parsed.error.flatten().fieldErrors);
          throw new Error('Environment validation failed — see console above');
        }
        return parsed.data;
      },
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
