import {PutObjectCommand} from '@aws-sdk/client-s3';

export const PRESIGN_EXPIRES_SECONDS = 15 * 60;

/** Browser fetch cannot set Content-Length; signing it breaks CORS preflight. */
export const BROWSER_PRESIGN_OPTIONS = {
  expiresIn: PRESIGN_EXPIRES_SECONDS,
  signableHeaders: new Set(['content-type']),
  unhoistableHeaders: new Set(['content-length']),
};

export function createBrowserPresignedPutCommand(input: {
  bucket: string;
  key: string;
  contentType: string;
}): PutObjectCommand {
  return new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
}

export function signedHeadersFromPresignedUrl(url: string): string[] {
  const raw = new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? '';
  return raw
    .split(';')
    .map(header => decodeURIComponent(header).trim().toLowerCase())
    .filter(Boolean);
}
