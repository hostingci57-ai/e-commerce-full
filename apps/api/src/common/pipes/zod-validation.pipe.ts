import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/**
 * Zod pipe that accepts any ZodTypeAny — we key the output type off
 * `z.infer<S>` so schemas with `.transform()` / `.default()` (input vs output
 * shape differs) compile without cast gymnastics at the call site.
 */
@Injectable()
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data as z.infer<S>;
  }
}
