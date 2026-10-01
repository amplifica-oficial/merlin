import {MAX_CUSTOM_CSS_CHARS, sanitizeCss} from '../sanitize-css';

export function parseDeclarations(body: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (key && value) {
      output[key] = value;
    }
  }
  return output;
}

export function serializeDeclarations(declarations: Record<string, string>): string {
  return Object.entries(declarations)
    .filter(([key, value]) => key.trim().length > 0 && value.trim().length > 0)
    .map(([key, value]) => `${key.trim()}: ${value.trim()}`)
    .join('; ');
}

export function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim();
}

function isSafeDeclarationEntry(key: string, value: string): boolean {
  if (!key || /[{};]/.test(key) || /<\/|\bexpression\b|javascript\s*:/i.test(key)) {
    return false;
  }
  if (/[{}]|<\/|\bexpression\b|javascript\s*:/i.test(value)) {
    return false;
  }
  return true;
}

export function sanitizeDeclarations(declarations: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(declarations)) {
    if (typeof value !== 'string' || !isSafeDeclarationEntry(key, value)) {
      continue;
    }
    output[key.trim()] = value.trim();
  }
  return output;
}

function extractBlock(css: string, openBraceIndex: number): {end: number; body: string} {
  let depth = 0;
  for (let index = openBraceIndex; index < css.length; index++) {
    const char = css[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {end: index + 1, body: css.slice(openBraceIndex + 1, index)};
      }
    }
  }
  return {end: css.length, body: css.slice(openBraceIndex + 1)};
}

export function upsertCssRule(css: string, selector: string, declarations: Record<string, string>): string {
  const target = normalizeSelector(selector);
  const nextDecls = sanitizeDeclarations(declarations);
  if (!target || Object.keys(nextDecls).length === 0) {
    return sanitizeCss(css);
  }

  const source = sanitizeCss(css);
  let index = 0;
  let output = '';
  let replaced = false;

  while (index < source.length) {
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      const close = end === -1 ? source.length : end + 2;
      output += source.slice(index, close);
      index = close;
      continue;
    }

    if (source[index] === '@') {
      const brace = source.indexOf('{', index);
      if (brace === -1) {
        output += source.slice(index);
        break;
      }
      const atBlock = extractBlock(source, brace);
      output += source.slice(index, atBlock.end);
      index = atBlock.end;
      continue;
    }

    const brace = source.indexOf('{', index);
    if (brace === -1) {
      output += source.slice(index);
      break;
    }

    const currentSelector = source.slice(index, brace);
    const block = extractBlock(source, brace);
    if (!replaced && normalizeSelector(currentSelector) === target) {
      const merged = {...parseDeclarations(block.body), ...nextDecls};
      output += `${target}{${serializeDeclarations(merged)}}`;
      replaced = true;
    } else {
      output += `${currentSelector}{${block.body}}`;
    }
    index = block.end;
  }

  const next = replaced ? output : `${output.trim()}${output.trim() ? '\n' : ''}${target}{${serializeDeclarations(nextDecls)}}`;
  return sanitizeCss(next).slice(0, MAX_CUSTOM_CSS_CHARS);
}
