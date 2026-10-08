import { Global, Injectable, Module } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config';
@Injectable()
export class StorageService {
  // Empty credentials use the AWS task role; local MinIO uses the explicit pair.
  private readonly credentials = env.S3_ACCESS_KEY
    ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
    : undefined;
  readonly client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: this.credentials,
  });
  readonly publicClient = new S3Client({
    endpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: this.credentials,
  });
  uploadUrl(key: string, size: number) {
    return getSignedUrl(
      this.publicClient,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: 'application/pdf',
        ContentLength: size,
        IfNoneMatch: '*',
      }),
      { expiresIn: 300 },
    );
  }
  head(key: string) {
    return this.client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
  async bytes(key: string, range?: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: range }),
    );
    if (!result.Body) throw new Error('Empty object');
    return result.Body.transformToByteArray();
  }
  delete(key: string) {
    return this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
}
@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
