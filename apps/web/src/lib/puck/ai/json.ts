export interface SanitizeJsonOptions {
  maxString?: number;
  maxArray?: number;
  depth?: number;
}

export function sanitizeJson(value: unknown, options: SanitizeJsonOptions = {}): unknown {
  const maxString = options.maxString ?? 300;
  const maxArray = options.maxArray ?? 8;
  const depth = options.depth ?? 6;
  return sanitizeValue(value, maxString, maxArray, depth);
}

function sanitizeValue(value: unknown, maxString: number, maxArray: number, depth: number): unknown {
  if (depth <= 0) {
    return undefined;
  }
  if (typeof value === 'function') {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.length > maxString ? `${value.slice(0, maxString)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, maxArray).map(item => sanitizeValue(item, maxString, maxArray, depth - 1));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'puck') {
        continue;
      }
      const next = sanitizeValue(nested, maxString, maxArray, depth - 1);
      if (next !== undefined) {
        output[key] = next;
      }
    }
    return output;
  }
  return undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
