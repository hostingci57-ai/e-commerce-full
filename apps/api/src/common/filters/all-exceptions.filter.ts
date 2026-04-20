import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../logging/logger';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = {
      error: {
        code: 'internal_error',
        message: 'Internal server error',
      },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        body = { error: { code: slug(exception.name), message: res } };
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        body = {
          error: {
            code: (obj.code as string) ?? slug((obj.error as string) ?? exception.name),
            message: (obj.message as string) ?? 'Error',
            details: obj.details,
          },
        };
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      body = {
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: exception.flatten(),
        },
      };
    } else if (exception instanceof Error) {
      logger.error({ err: exception, url: request.url }, 'Unhandled error');
      body = { error: { code: 'internal_error', message: exception.message } };
    }

    const requestId = (request.id as string | undefined) ?? undefined;
    if (requestId) body.error.requestId = requestId;

    void reply.status(status).send(body);
  }
}

function slug(name: string): string {
  return name
    .replace(/Exception$/, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}
