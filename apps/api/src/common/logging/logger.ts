import pino from 'pino';
import type { LoggerService } from '@nestjs/common';

const pretty = process.env.LOG_PRETTY === 'true' && process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: pretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } }
    : undefined,
  base: { svc: 'api' },
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password', 'tokenHash'],
    censor: '[REDACTED]',
  },
});

/** Adapter so Nest's built-in Logger forwards to pino. */
export const pinoNestLogger: LoggerService = {
  log: (msg, ctx) => logger.info({ ctx }, typeof msg === 'string' ? msg : JSON.stringify(msg)),
  error: (msg, trace, ctx) => logger.error({ ctx, trace }, typeof msg === 'string' ? msg : JSON.stringify(msg)),
  warn: (msg, ctx) => logger.warn({ ctx }, typeof msg === 'string' ? msg : JSON.stringify(msg)),
  debug: (msg, ctx) => logger.debug({ ctx }, typeof msg === 'string' ? msg : JSON.stringify(msg)),
  verbose: (msg, ctx) => logger.trace({ ctx }, typeof msg === 'string' ? msg : JSON.stringify(msg)),
};
