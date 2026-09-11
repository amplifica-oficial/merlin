import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import signale from 'signale';

import {
  S3_ACCESS_KEY_ID,
  S3_ACCESS_KEY_SECRET,
  S3_BUCKET,
  S3_ENABLED,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_PUBLIC_URL,
  S3_REGION,
} from '../app/constants.js';
import {S3_MAX_UPLOAD_BYTES} from './fileUploadValidation.js';
import {BROWSER_PRESIGN_OPTIONS, createBrowserPresignedPutCommand} from './presignedPut.js';

const DELETE_BATCH_SIZE = 1000;

/**
 * S3-compatible storage client for Minio
 */
let s3Client: S3Client | null = null;

if (S3_ENABLED) {
  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_ACCESS_KEY_SECRET,
    },
    forcePathStyle: S3_FORCE_PATH_STYLE,
    followRegionRedirects: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function requireClient(): S3Client {
  if (!s3Client) {
    throw new Error('S3 is not enabled');
  }
  return s3Client;
}

/**
 * Initialize the S3 bucket if it doesn't exist
 */
export async function initializeBucket(): Promise<void> {
  const client = requireClient();

  let bucketExists = true;

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: S3_BUCKET,
      }),
    );
  } catch (error: unknown) {
    const isNotFoundError =
      error &&
      typeof error === 'object' &&
      (('name' in error && error.name === 'NotFound') ||
        ('$metadata' in error &&
          error.$metadata &&
          typeof error.$metadata === 'object' &&
          'httpStatusCode' in error.$metadata &&
          error.$metadata.httpStatusCode === 404));
    if (isNotFoundError) {
      bucketExists = false;
      try {
        await client.send(
          new CreateBucketCommand({
            Bucket: S3_BUCKET,
          }),
        );
        signale.info(`[S3] Created bucket: ${S3_BUCKET}`);
      } catch (createError) {
        signale.error('[S3] Failed to create bucket:', createError);
        throw createError;
      }
    } else {
      signale.error('[S3] Failed to check bucket:', error);
      throw error;
    }
  }

  // Set public read policy for the bucket (both for new and existing buckets)
  try {
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${S3_BUCKET}/*`],
        },
      ],
    };

    await client.send(
      new PutBucketPolicyCommand({
        Bucket: S3_BUCKET,
        Policy: JSON.stringify(bucketPolicy),
      }),
    );

    if (!bucketExists) {
      signale.info(`[S3] Set public read policy for bucket: ${S3_BUCKET}`);
    }
  } catch (policyError) {
    signale.error('[S3] Failed to set bucket policy:', policyError);
    // Don't throw - bucket was created but policy failed
  }

  signale.info(`[S3] Ready (bucket=${S3_BUCKET}, region=${S3_REGION})`);
}

interface UploadFileParams {
  file: Buffer;
  filename: string;
  contentType: string;
  projectId: string;
}

interface UploadFileResult {
  url: string;
  key: string;
}

/**
 * Upload a file to S3/Minio
 */
export async function uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
  const client = requireClient();
  const {file, filename, contentType, projectId} = params;

  // Generate a unique key for the file
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = filename.split('.').pop();
  const key = `${projectId}/${timestamp}-${randomString}.${extension}`;

  // Upload to S3/Minio
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  );

  return {url: getPublicObjectUrl(key), key};
}

export function getPublicObjectUrl(key: string): string {
  const base = S3_PUBLIC_URL.replace(/\/$/, '');
  const normalizedKey = key.replace(/^\/+/, '');
  return `${base}/${normalizedKey}`;
}

export async function getPresignedPutUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const client = requireClient();
  const {key, contentType, contentLength} = params;

  if (contentLength <= 0 || contentLength > S3_MAX_UPLOAD_BYTES) {
    throw new Error('Invalid file size.');
  }

  const command = createBrowserPresignedPutCommand({
    bucket: S3_BUCKET,
    key,
    contentType,
  });

  return getSignedUrl(client, command, BROWSER_PRESIGN_OPTIONS);
}

export async function headObject(key: string): Promise<{contentLength: number; contentType: string | undefined} | null> {
  const client = requireClient();
  try {
    const out = await client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      }),
    );
    return {
      contentLength: out.ContentLength ?? 0,
      contentType: out.ContentType,
    };
  } catch {
    return null;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const client = requireClient();
  const normalizedKeys = [
    ...new Set(keys.map(key => key.trim().replace(/^\/+/, '')).filter(key => key.length > 0)),
  ];

  if (normalizedKeys.length === 0) {
    return;
  }

  const ignorableCodes = new Set(['NoSuchKey', 'NotFound']);
  const failedKeys: string[] = [];

  for (let i = 0; i < normalizedKeys.length; i += DELETE_BATCH_SIZE) {
    const batch = normalizedKeys.slice(i, i + DELETE_BATCH_SIZE);
    try {
      const response = await client.send(
        new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: {
            Objects: batch.map(Key => ({Key})),
            Quiet: true,
          },
        }),
      );

      for (const error of response.Errors ?? []) {
        if (error.Code && ignorableCodes.has(error.Code)) {
          continue;
        }
        failedKeys.push(error.Key ?? 'unknown');
      }
    } catch (error) {
      signale.error('[S3] Failed to delete object batch:', error);
      failedKeys.push(...batch);
    }
  }

  if (failedKeys.length > 0) {
    throw new Error(`Failed to delete objects: ${[...new Set(failedKeys)].join(', ')}`);
  }
}

/**
 * Check if S3 is enabled and configured
 */
export function isS3Enabled(): boolean {
  return S3_ENABLED;
}
