import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {describe, expect, it} from 'vitest';

import {S3_BUCKET, S3_ENABLED} from '../../app/constants';
import * as S3Service from '../S3Service';
import {
  BROWSER_PRESIGN_OPTIONS,
  createBrowserPresignedPutCommand,
  signedHeadersFromPresignedUrl,
} from '../presignedPut';

function dummyS3Client() {
  return new S3Client({
    region: 'sa-east-1',
    credentials: {accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret'},
  });
}

describe('browser presigned PUT', () => {
  it('does not sign content-length (browser CORS cannot send that header)', async () => {
    const url = await getSignedUrl(
      dummyS3Client(),
      createBrowserPresignedPutCommand({
        bucket: 'test-bucket',
        key: 'proj/files/id/photo.png',
        contentType: 'image/png',
      }),
      BROWSER_PRESIGN_OPTIONS,
    );

    const headers = signedHeadersFromPresignedUrl(url);
    expect(headers).toContain('content-type');
    expect(headers).toContain('host');
    expect(headers).not.toContain('content-length');
  });

  it('AWS SDK signs content-length when ContentLength is set on the command', async () => {
    const url = await getSignedUrl(
      dummyS3Client(),
      new PutObjectCommand({
        Bucket: 'test-bucket',
        Key: 'proj/files/id/photo.png',
        ContentType: 'image/png',
        ContentLength: 12,
      }),
      BROWSER_PRESIGN_OPTIONS,
    );

    expect(signedHeadersFromPresignedUrl(url)).toContain('content-length');
  });
});

describe('live S3 browser upload', () => {
  it.skipIf(!S3_ENABLED)(
    'OPTIONS from localhost:3000 and PUT with only Content-Type succeed',
    async () => {
      const key = `vitest-presign/${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
      const contentType = 'text/plain';
      const body = 'merlin-presign-check';

      const url = await S3Service.getPresignedPutUrl({
        key,
        contentType,
        contentLength: body.length,
      });

      expect(signedHeadersFromPresignedUrl(url)).not.toContain('content-length');

      const preflight = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'content-type',
        },
      });

      expect(preflight.ok, `CORS preflight ${preflight.status}: ${await preflight.text()}`).toBe(true);
      expect(preflight.headers.get('access-control-allow-origin')).toBeTruthy();

      const put = await fetch(url, {
        method: 'PUT',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': contentType,
        },
        body,
      });

      expect(put.ok, `PUT ${put.status}: ${await put.text()}`).toBe(true);

      await S3Service.deleteObjects([key]);
    },
    20_000,
  );
});
