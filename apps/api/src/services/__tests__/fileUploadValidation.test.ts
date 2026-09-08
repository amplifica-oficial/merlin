import {describe, expect, it} from 'vitest';

import {S3_MAX_UPLOAD_BYTES, sanitizeFileName, validateUploadFile} from '../fileUploadValidation';

describe('validateUploadFile', () => {
  it('accepts a valid image under the size limit', () => {
    expect(validateUploadFile('photo.png', 'image/png', 1024, S3_MAX_UPLOAD_BYTES)).toEqual({ok: true});
  });

  it('rejects empty files', () => {
    expect(validateUploadFile('photo.png', 'image/png', 0, S3_MAX_UPLOAD_BYTES)).toEqual({
      ok: false,
      error: 'File is empty.',
    });
  });

  it('rejects files over the size limit', () => {
    expect(validateUploadFile('photo.png', 'image/png', S3_MAX_UPLOAD_BYTES + 1, S3_MAX_UPLOAD_BYTES)).toEqual({
      ok: false,
      error: `File exceeds the ${Math.round(S3_MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
    });
  });

  it('rejects blocked executable extensions', () => {
    expect(validateUploadFile('payload.exe', 'application/octet-stream', 100, S3_MAX_UPLOAD_BYTES)).toEqual({
      ok: false,
      error: 'This file type is not allowed.',
    });
  });

  it('rejects disallowed content types', () => {
    expect(validateUploadFile('script.js', 'application/javascript', 100, S3_MAX_UPLOAD_BYTES)).toEqual({
      ok: false,
      error: 'This content type is not allowed.',
    });
  });
});

describe('sanitizeFileName', () => {
  it('replaces unsafe characters and caps length', () => {
    expect(sanitizeFileName('My Photo (1).PNG')).toBe('My_Photo_1_.PNG');
    expect(sanitizeFileName('../secret.txt')).toBe('secret.txt');
    expect(sanitizeFileName('   ')).toBe('file');
    expect(sanitizeFileName('a'.repeat(250)).length).toBe(200);
  });
});
