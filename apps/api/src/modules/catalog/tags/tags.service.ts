import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * Tag model is not present in the current Prisma schema — the architect output
 * deferred tags to a post-MVP migration. The endpoints below exist as API
 * surface placeholders; they respond 501 until the migration lands. This keeps
 * storefront/admin clients able to feature-detect without code changes later.
 */
@Injectable()
export class TagsService {
  private notImplemented(): never {
    throw new NotImplementedException({
      code: 'tags_not_implemented',
      message: 'Tag model is scheduled for a future migration (schema stub).',
    });
  }

  list(): never {
    this.notImplemented();
  }

  create(): never {
    this.notImplemented();
  }

  findById(): never {
    this.notImplemented();
  }

  update(): never {
    this.notImplemented();
  }

  remove(): never {
    this.notImplemented();
  }
}
