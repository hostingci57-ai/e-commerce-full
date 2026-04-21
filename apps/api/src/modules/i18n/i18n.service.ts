import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { withTenant, withoutTenant } from '@ecf/db';
import type {
  UpdateLanguageInput,
  UpdateUiBundleInput,
  UpsertLanguageInput,
  UpsertTenantLanguageInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { prismaLandlord } from '@ecf/db';
import { DEFAULT_STOREFRONT_STRINGS_TR, DEFAULT_STOREFRONT_STRINGS_EN } from './default-strings';

const BUNDLE_CACHE_TTL_SEC = 300;

type UiStrings = Record<string, string>;

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);

  constructor(
    private readonly ctx: TenantContextService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private requireTenant(): string {
    const tid = this.ctx.tenantId;
    if (!tid) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return tid;
  }

  /* ---------------- Languages (global, no RLS) ---------------- */

  async listLanguages() {
    return prismaLandlord.language.findMany({ orderBy: { code: 'asc' } });
  }

  async upsertLanguage(input: UpsertLanguageInput) {
    return prismaLandlord.language.upsert({
      where: { code: input.code },
      update: {
        name: input.name,
        nativeName: input.nativeName,
        rtl: input.rtl,
        isActive: input.isActive,
      },
      create: {
        code: input.code,
        name: input.name,
        nativeName: input.nativeName,
        rtl: input.rtl,
        isActive: input.isActive,
      },
    });
  }

  async updateLanguage(code: string, input: UpdateLanguageInput) {
    const existing = await prismaLandlord.language.findUnique({ where: { code } });
    if (!existing) {
      throw new NotFoundException({
        code: 'language_not_found',
        message: `Language ${code} not found`,
      });
    }
    return prismaLandlord.language.update({
      where: { code },
      data: {
        name: input.name ?? undefined,
        nativeName: input.nativeName ?? undefined,
        rtl: input.rtl ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });
  }

  /* ---------------- Tenant languages ---------------- */

  async listTenantLanguages() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      return tx.tenantLanguage.findMany({
        where: { tenantId },
        orderBy: [{ isDefault: 'desc' }, { languageCode: 'asc' }],
      });
    });
  }

  async upsertTenantLanguage(input: UpsertTenantLanguageInput) {
    const tenantId = this.requireTenant();
    // Validate language exists in global catalog
    const lang = await prismaLandlord.language.findUnique({
      where: { code: input.languageCode },
    });
    if (!lang || !lang.isActive) {
      throw new NotFoundException({
        code: 'language_not_found',
        message: `Language ${input.languageCode} not available`,
      });
    }
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      if (input.isDefault) {
        // Only one default at a time
        await tx.tenantLanguage.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = await tx.tenantLanguage.upsert({
        where: {
          tenantId_languageCode: { tenantId, languageCode: input.languageCode },
        },
        update: {
          isDefault: input.isDefault,
          isPublished: input.isPublished,
        },
        create: {
          tenantId,
          languageCode: input.languageCode,
          isDefault: input.isDefault,
          isPublished: input.isPublished,
        },
      });
      await this.invalidateTenantCache(tenantId);
      return row;
    });
  }

  async deleteTenantLanguage(languageCode: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.tenantLanguage.findUnique({
        where: { tenantId_languageCode: { tenantId, languageCode } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'tenant_language_not_found',
          message: 'Tenant language not found',
        });
      }
      if (existing.isDefault) {
        throw new ConflictException({
          code: 'default_language_removal',
          message: 'Cannot remove the default language',
        });
      }
      await tx.tenantLanguage.delete({
        where: { tenantId_languageCode: { tenantId, languageCode } },
      });
      await this.invalidateTenantCache(tenantId);
      return { deleted: true as const };
    });
  }

  /* ---------------- UI bundles ---------------- */

  async listBundles(params: { languageCode?: string; namespace?: string }) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      return tx.uiStringBundle.findMany({
        where: {
          tenantId,
          ...(params.languageCode ? { languageCode: params.languageCode } : {}),
          ...(params.namespace ? { namespace: params.namespace } : {}),
        },
        orderBy: [{ namespace: 'asc' }, { languageCode: 'asc' }],
      });
    });
  }

  async updateBundle(input: UpdateUiBundleInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.uiStringBundle.findUnique({
        where: {
          tenantId_languageCode_namespace: {
            tenantId,
            languageCode: input.languageCode,
            namespace: input.namespace,
          },
        },
      });
      const row = await tx.uiStringBundle.upsert({
        where: {
          tenantId_languageCode_namespace: {
            tenantId,
            languageCode: input.languageCode,
            namespace: input.namespace,
          },
        },
        update: {
          strings: input.strings,
          version: (existing?.version ?? 0) + 1,
        },
        create: {
          tenantId,
          languageCode: input.languageCode,
          namespace: input.namespace,
          strings: input.strings,
          version: 1,
        },
      });
      await this.invalidateBundleCache(
        tenantId,
        input.languageCode,
        input.namespace,
      );
      return row;
    });
  }

  async getPublicBundle(
    tenantId: string,
    lang: string,
    namespace: string,
  ): Promise<{ lang: string; namespace: string; strings: UiStrings; version: number }> {
    const cacheKey = this.bundleCacheKey(tenantId, lang, namespace);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as {
            lang: string;
            namespace: string;
            strings: UiStrings;
            version: number;
          };
        } catch {
          /* fall through */
        }
      }
    } catch (err) {
      this.logger.warn(`redis get bundle cache failed: ${(err as Error).message}`);
    }

    const bundle = await withTenant({ tenantId }, async (tx) => {
      return tx.uiStringBundle.findUnique({
        where: {
          tenantId_languageCode_namespace: {
            tenantId,
            languageCode: lang,
            namespace,
          },
        },
      });
    });

    let strings: UiStrings = {};
    let version = 0;
    if (bundle && bundle.strings && typeof bundle.strings === 'object') {
      strings = bundle.strings as UiStrings;
      version = bundle.version;
    } else {
      // Fall back to built-in defaults so the storefront always renders sensible copy.
      strings = this.defaultBundle(lang, namespace);
    }

    const payload = { lang, namespace, strings, version };
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        BUNDLE_CACHE_TTL_SEC,
      );
    } catch (err) {
      this.logger.warn(`redis set bundle cache failed: ${(err as Error).message}`);
    }
    return payload;
  }

  async getTenantPublicLanguages(tenantId: string) {
    const cacheKey = `i18n:tenant-langs:${tenantId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as unknown;
    } catch {
      /* ignore */
    }

    const rows = await withTenant({ tenantId }, async (tx) => {
      return tx.tenantLanguage.findMany({
        where: { tenantId, isPublished: true },
        orderBy: [{ isDefault: 'desc' }, { languageCode: 'asc' }],
      });
    });
    // Join with global language catalog for display names
    const codes = rows.map((r) => r.languageCode);
    const langs = await withoutTenant(async (tx) => {
      return tx.language.findMany({ where: { code: { in: codes }, isActive: true } });
    });
    const langMap = new Map(langs.map((l) => [l.code, l]));
    const out = rows.map((r) => {
      const l = langMap.get(r.languageCode);
      return {
        code: r.languageCode,
        name: l?.name ?? r.languageCode,
        nativeName: l?.nativeName ?? r.languageCode,
        rtl: l?.rtl ?? false,
        isDefault: r.isDefault,
      };
    });
    try {
      await this.redis.set(cacheKey, JSON.stringify(out), 'EX', BUNDLE_CACHE_TTL_SEC);
    } catch {
      /* ignore */
    }
    return out;
  }

  /* ---------------- Seed (default TR + EN bundle) ---------------- */

  async seedDefaultsForTenant(tenantId: string): Promise<void> {
    await withTenant({ tenantId }, async (tx) => {
      await tx.tenantLanguage.upsert({
        where: { tenantId_languageCode: { tenantId, languageCode: 'tr' } },
        update: {},
        create: { tenantId, languageCode: 'tr', isDefault: true, isPublished: true },
      });
      await tx.tenantLanguage.upsert({
        where: { tenantId_languageCode: { tenantId, languageCode: 'en' } },
        update: {},
        create: { tenantId, languageCode: 'en', isDefault: false, isPublished: true },
      });
      await tx.uiStringBundle.upsert({
        where: {
          tenantId_languageCode_namespace: {
            tenantId,
            languageCode: 'tr',
            namespace: 'storefront',
          },
        },
        update: {},
        create: {
          tenantId,
          languageCode: 'tr',
          namespace: 'storefront',
          strings: DEFAULT_STOREFRONT_STRINGS_TR,
          version: 1,
        },
      });
      await tx.uiStringBundle.upsert({
        where: {
          tenantId_languageCode_namespace: {
            tenantId,
            languageCode: 'en',
            namespace: 'storefront',
          },
        },
        update: {},
        create: {
          tenantId,
          languageCode: 'en',
          namespace: 'storefront',
          strings: DEFAULT_STOREFRONT_STRINGS_EN,
          version: 1,
        },
      });
    });
  }

  /* ---------------- Helpers ---------------- */

  private defaultBundle(lang: string, namespace: string): UiStrings {
    if (namespace === 'storefront') {
      return lang === 'en'
        ? DEFAULT_STOREFRONT_STRINGS_EN
        : DEFAULT_STOREFRONT_STRINGS_TR;
    }
    return {};
  }

  private bundleCacheKey(tenantId: string, lang: string, namespace: string): string {
    return `i18n:bundle:${tenantId}:${lang}:${namespace}`;
  }

  private async invalidateBundleCache(
    tenantId: string,
    lang: string,
    namespace: string,
  ): Promise<void> {
    try {
      await this.redis.del(this.bundleCacheKey(tenantId, lang, namespace));
    } catch (err) {
      this.logger.warn(`redis del bundle cache failed: ${(err as Error).message}`);
    }
  }

  private async invalidateTenantCache(tenantId: string): Promise<void> {
    try {
      await this.redis.del(`i18n:tenant-langs:${tenantId}`);
    } catch (err) {
      this.logger.warn(
        `redis del tenant-langs cache failed: ${(err as Error).message}`,
      );
    }
  }
}
