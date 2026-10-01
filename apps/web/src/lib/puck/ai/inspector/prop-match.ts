const MAX_MATCHES = 20;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNeedle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function findPropMatches(props: Record<string, unknown>, needles: string[]): string[] {
  const normalized = needles.map(normalizeNeedle).filter(needle => needle.length > 0);
  if (normalized.length === 0) {
    return [];
  }

  const matches: string[] = [];

  const visit = (value: unknown, path: string) => {
    if (matches.length >= MAX_MATCHES) {
      return;
    }
    if (typeof value === 'string') {
      const haystack = normalizeNeedle(value);
      if (!haystack) {
        return;
      }
      if (normalized.some(needle => haystack === needle || haystack.includes(needle) || needle.includes(haystack))) {
        matches.push(path);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, path ? `${path}.${index}` : String(index)));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key === 'id' || key === 'puck' || key === 'customCss') {
          continue;
        }
        visit(child, path ? `${path}.${key}` : key);
      }
    }
  };

  visit(props, '');
  return matches;
}
