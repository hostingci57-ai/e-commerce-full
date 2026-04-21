export interface StorageAdapter {
  /**
   * Generate a presigned PUT URL the client can upload to directly (bypassing
   * our API). `ttlSeconds` controls how long the URL stays valid.
   */
  getPresignedPutUrl(params: {
    key: string;
    contentType: string;
    ttlSeconds: number;
    contentLength?: number;
  }): Promise<string>;

  /** Presigned GET URL for time-boxed reads. */
  getPresignedGetUrl(params: {
    key: string;
    ttlSeconds: number;
  }): Promise<string>;

  /** Upload a server-computed buffer (used by image-resize worker, etc.). */
  uploadBuffer(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void>;

  /** Delete an object (best-effort; swallows 404). */
  delete(key: string): Promise<void>;
}
