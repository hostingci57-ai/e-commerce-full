import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { withTenant, type Prisma } from '@ecf/db';
import type {
  CreateMediaAssetInput,
  ListMediaAssetsQuery,
  PresignedUploadInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AppConfigService } from '../../common/config/config.service';
import { QUEUE_IMAGE_PROCESSING } from '../../common/queue/queue.module';
import { S3StorageAdapter } from './s3.storage.adapter';

/** Map MIME → MediaKind. */
function kindFor(contentType: string): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
  if (contentType.startsWith('image/')) return 'IMAGE';
  if (contentType.startsWith('video/')) return 'VIDEO';
  return 'DOCUMENT';
}

function extFor(contentType: string, fallbackFilename: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
  };
  const byMime = map[contentType];
  if (byMime) return byMime;
  const dot = fallbackFilename.lastIndexOf('.');
  return dot >= 0 ? fallbackFilename.slice(dot + 1).toLowerCase() : 'bin';
}

@Injectable()
export class MediaService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly cfg: AppConfigService,
    private readonly storage: S3StorageAdapter,
    @Inject(QUEUE_IMAGE_PROCESSING) private readonly imageQ: Queue,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return id;
  }

  private tenantPrefix(tenantId: string): string {
    return `tenants/${tenantId}/media/`;
  }

  /**
   * Issue a presigned PUT URL for the client to upload directly to S3.
   * Tenant-scoped key prevents cross-tenant leakage at the storage layer
   * (defence-in-depth alongside RLS on the DB row).
   */
  async generateUploadUrl(input: PresignedUploadInput) {
    const tenantId = this.requireTenant();
    if (input.sizeBytes > this.cfg.mediaMaxBytes) {
      throw new BadRequestException({
        code: 'file_too_large',
        message: `File exceeds max ${this.cfg.mediaMaxBytes} bytes`,
      });
    }
    const ext = extFor(input.contentType, input.filename);
    const key = `${this.tenantPrefix(tenantId)}${randomUUID()}.${ext}`;
    const uploadUrl = await this.storage.getPresignedPutUrl({
      key,
      contentType: input.contentType,
      ttlSeconds: this.cfg.mediaUrlTtl,
      contentLength: input.sizeBytes,
    });
    return {
      key,
      uploadUrl,
      expiresAt: new Date(Date.now() + this.cfg.mediaUrlTtl * 1_000).toISOString(),
    };
  }

  /**
   * Record the MediaAsset row after client has PUT the file to S3. We do NOT
   * trust the client for the blob — we *do* trust them for the key (because
   * the key came from our presigned URL and is tenant-prefixed).
   */
  async createAsset(input: CreateMediaAssetInput) {
    const tenantId = this.requireTenant();
    const expectedPrefix = this.tenantPrefix(tenantId);
    if (!input.key.startsWith(expectedPrefix)) {
      throw new ForbiddenException({
        code: 'key_prefix_mismatch',
        message: 'Key is outside tenant prefix',
      });
    }
    if (input.sizeBytes > this.cfg.mediaMaxBytes) {
      throw new BadRequestException({
        code: 'file_too_large',
        message: `File exceeds max ${this.cfg.mediaMaxBytes} bytes`,
      });
    }

    const asset = await withTenant(
      { tenantId, userId: this.ctx.userId },
      (tx) =>
        tx.mediaAsset.create({
          data: {
            tenantId,
            key: input.key,
            filename: input.filename,
            contentType: input.contentType,
            mime: input.contentType,
            sizeBytes: BigInt(input.sizeBytes),
            width: input.width ?? null,
            height: input.height ?? null,
            kind: kindFor(input.contentType),
            tags: input.tags ?? [],
            uploadedBy: this.ctx.userId ?? null,
          },
        }),
    );

    // Fire-and-forget enqueue for image resize. Placeholder processor will no-op.
    if (asset.kind === 'IMAGE') {
      await this.imageQ
        .add(
          'resize',
          {
            tenantId,
            assetId: asset.id,
            key: asset.key,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: { count: 100 },
          },
        )
        .catch(() => {
          // queue unavailable — not fatal
        });
    }
    return asset;
  }

  async list(q: ListMediaAssetsQuery) {
    const tenantId = this.requireTenant();
    const where: Prisma.MediaAssetWhereInput = { tenantId };
    if (q.kind) where.kind = q.kind;
    if (q.tag) where.tags = { has: q.tag };
    if (q.cursor) {
      try {
        const [iso, cid] = Buffer.from(q.cursor, 'base64')
          .toString('utf-8')
          .split('|');
        if (iso && cid) {
          where.AND = [
            {
              OR: [
                { createdAt: { lt: new Date(iso) } },
                { AND: [{ createdAt: new Date(iso) }, { id: { lt: cid } }] },
              ],
            },
          ];
        }
      } catch {
        /* ignore */
      }
    }
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.mediaAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
      });
      const hasMore = rows.length > q.limit;
      const items = hasMore ? rows.slice(0, q.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? Buffer.from(
              `${last.createdAt.toISOString()}|${last.id}`,
            ).toString('base64')
          : null;
      return { items, nextCursor, hasMore };
    });
  }

  async getSignedUrl(id: string) {
    const tenantId = this.requireTenant();
    const asset = await withTenant({ tenantId }, (tx) =>
      tx.mediaAsset.findFirst({ where: { tenantId, id } }),
    );
    if (!asset) {
      throw new NotFoundException({
        code: 'asset_not_found',
        message: 'Asset not found',
      });
    }
    const url = await this.storage.getPresignedGetUrl({
      key: asset.key,
      ttlSeconds: this.cfg.mediaUrlTtl,
    });
    return {
      id: asset.id,
      url,
      expiresAt: new Date(Date.now() + this.cfg.mediaUrlTtl * 1_000).toISOString(),
    };
  }

  async delete(id: string) {
    const tenantId = this.requireTenant();
    const asset = await withTenant({ tenantId }, (tx) =>
      tx.mediaAsset.findFirst({ where: { tenantId, id } }),
    );
    if (!asset) {
      throw new NotFoundException({
        code: 'asset_not_found',
        message: 'Asset not found',
      });
    }
    await this.storage.delete(asset.key);
    await withTenant({ tenantId, userId: this.ctx.userId }, (tx) =>
      tx.mediaAsset.delete({ where: { id: asset.id } }),
    );
    return { ok: true as const };
  }
}
