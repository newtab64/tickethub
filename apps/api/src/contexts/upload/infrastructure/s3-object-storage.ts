import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../../config/env.config";
import type { ObjectStorage, StoredObjectInfo } from "../domain/upload.ports";

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket = env.S3_BUCKET;

  constructor() {
    const config: {
      region: string;
      requestChecksumCalculation: "WHEN_REQUIRED";
      credentials?: { accessKeyId: string; secretAccessKey: string };
    } = {
      region: env.S3_REGION,
      requestChecksumCalculation: "WHEN_REQUIRED",
    };
    if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      };
    }
    this.client = new S3Client(config);
  }

  presignPut(key: string, contentType: string, expiresInSeconds: number) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
      signableHeaders: new Set(["content-type"]),
    });
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { contentLength: res.ContentLength, contentType: res.ContentType };
    } catch {
      return null;
    }
  }

  async readRange(key: string, range: string): Promise<Uint8Array | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }),
      );
      return (await object.Body?.transformToByteArray()) ?? null;
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string | null {
    const base = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
    return base ? `${base}/${key}` : null;
  }
}
