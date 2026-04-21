import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '../../common/config/config.service';
import type { StorageAdapter } from './storage.adapter';

/**
 * AWS S3 / MinIO implementation of the storage adapter. Uses path-style
 * addressing by default (S3_FORCE_PATH_STYLE=true) which is required for
 * MinIO compatibility in single-bucket deployments.
 */
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly log = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg: AppConfigService) {
    const s3 = cfg.s3;
    this.bucket = s3.bucket;
    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint,
      forcePathStyle: s3.forcePathStyle,
      credentials:
        s3.accessKey && s3.secretKey
          ? {
              accessKeyId: s3.accessKey,
              secretAccessKey: s3.secretKey,
            }
          : undefined,
    });
  }

  async getPresignedPutUrl(params: {
    key: string;
    contentType: string;
    ttlSeconds: number;
    contentLength?: number;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });
    return getSignedUrl(this.client, command, { expiresIn: params.ttlSeconds });
  }

  async getPresignedGetUrl(params: {
    key: string;
    ttlSeconds: number;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
    });
    return getSignedUrl(this.client, command, { expiresIn: params.ttlSeconds });
  }

  async uploadBuffer(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      // 404-style failures are fine (object already gone); log and swallow.
      this.log.warn(`delete(${key}) failed: ${(err as Error).message}`);
    }
  }
}
