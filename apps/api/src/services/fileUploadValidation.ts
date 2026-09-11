const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.sh',
  '.dll',
  '.svg',
  '.html',
  '.htm',
  '.xhtml',
]);

const BLOCKED_CONTENT_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
]);

const ALLOWED_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.',
];

const UNSAFE_CHARS = /[^a-zA-Z0-9._-]+/g;

/** Max upload size for presigned PUT (50 MiB). */
export const S3_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function validateUploadFile(
  fileName: string,
  contentType: string,
  sizeBytes: number,
  maxBytes: number = S3_MAX_UPLOAD_BYTES,
): {ok: true} | {ok: false; error: string} {
  if (sizeBytes <= 0) {
    return {ok: false, error: 'File is empty.'};
  }
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    };
  }

  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot >= 0) {
    const ext = lower.slice(dot);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return {ok: false, error: 'This file type is not allowed.'};
    }
  }

  const type = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (BLOCKED_CONTENT_TYPES.has(type)) {
    return {ok: false, error: 'This content type is not allowed.'};
  }
  if (!ALLOWED_PREFIXES.some(prefix => type === prefix || type.startsWith(prefix))) {
    return {ok: false, error: 'This content type is not allowed.'};
  }

  return {ok: true};
}

export function sanitizeFileName(name: string): string {
  const base = name.trim().replace(UNSAFE_CHARS, '_').replace(/_+/g, '_');
  const trimmed = base.replace(/^[._-]+|[._-]+$/g, '');
  return trimmed.length > 0 ? trimmed.slice(0, 200) : 'file';
}

export function buildProjectFileStorageKey(projectId: string, fileId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${projectId}/files/${fileId}/${safeName}`;
}
