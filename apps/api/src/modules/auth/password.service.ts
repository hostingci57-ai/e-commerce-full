import { Injectable } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * argon2id password hashing via @node-rs/argon2 (Rust bindings, no native build).
 * OWASP-recommended parameters (m=19 MiB, t=2, p=1).
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plain: string): Promise<string> {
    return hash(plain, this.options);
  }

  async verify(stored: string, plain: string): Promise<boolean> {
    try {
      return await verify(stored, plain);
    } catch {
      return false;
    }
  }
}
