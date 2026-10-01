export const MAX_CUSTOM_CSS_CHARS = 20_000;

const STRIP_PATTERNS: Array<RegExp> = [
  /<\/style/gi,
  /@import\b[^;{]*;?/gi,
  /@charset\b[^;]*;?/gi,
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /-moz-binding\s*:/gi,
  /behavior\s*:/gi,
];

export function sanitizeCss(css: string): string {
  if (typeof css !== 'string' || css.length === 0) {
    return '';
  }

  let next = css.slice(0, MAX_CUSTOM_CSS_CHARS);
  for (const pattern of STRIP_PATTERNS) {
    next = next.replace(pattern, '');
  }
  return next;
}

export function scopeCss(blockId: string, css: string): string {
  const sanitized = sanitizeCss(css);
  if (!sanitized.trim() || !blockId) {
    return '';
  }

  const scope = `[data-lp-block="${escapeAttributeValue(blockId)}"]`;
  return prefixCssSelectors(sanitized, scope);
}

export function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function prefixCssSelectors(css: string, scope: string): string {
  return transformCssRules(css, selector => {
    return selector
      .split(',')
      .map(part => {
        const sel = part.trim();
        if (!sel) {
          return sel;
        }
        if (sel.startsWith(scope)) {
          return sel;
        }
        if (/^(html|body|:root)\b/.test(sel)) {
          return sel.replace(/^(html|body|:root)/, scope);
        }
        return `${scope} ${sel}`;
      })
      .join(', ');
  });
}

function transformCssRules(css: string, mapSelector: (selector: string) => string): string {
  let index = 0;
  let output = '';

  while (index < css.length) {
    if (css.startsWith('/*', index)) {
      const end = css.indexOf('*/', index + 2);
      const close = end === -1 ? css.length : end + 2;
      output += css.slice(index, close);
      index = close;
      continue;
    }

    if (css[index] === '@') {
      const brace = css.indexOf('{', index);
      if (brace === -1) {
        output += css.slice(index);
        break;
      }
      const header = css.slice(index, brace).trim();
      const block = extractBlock(css, brace);
      if (/^@(media|supports|layer)\b/i.test(header)) {
        output += `${header}{${transformCssRules(block.body, mapSelector)}}`;
      } else {
        output += css.slice(index, block.end);
      }
      index = block.end;
      continue;
    }

    const brace = css.indexOf('{', index);
    if (brace === -1) {
      output += css.slice(index);
      break;
    }

    const selector = css.slice(index, brace);
    const block = extractBlock(css, brace);
    output += `${mapSelector(selector)}{${block.body}}`;
    index = block.end;
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
