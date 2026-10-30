// Host-only alternative to the unavailable minio/mc image. Never changes bucket access.
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const apiRequire = createRequire(resolve(__dirname, '../../apps/api/package.json'));
apiRequire('dotenv').config({ path: resolve(__dirname, '../../.env'), quiet: true });
const { S3Client, HeadBucketCommand, CreateBucketCommand } = apiRequire('@aws-sdk/client-s3');
async function main() {
  const endpoint = new URL(process.env.S3_ENDPOINT);
  if (!['localhost', '127.0.0.1'].includes(endpoint.hostname)) {
    throw new Error('This script only initializes local development storage.');
  }
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET is required.');
  const client = new S3Client({
    endpoint: endpoint.href,
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 404) throw error;
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
    }
    console.log('Local private CV bucket is ready.');
  } finally {
    client.destroy();
  }
}
main().catch((error) => {
  console.error('Local storage initialization failed:', error.name);
  process.exitCode = 1;
});
