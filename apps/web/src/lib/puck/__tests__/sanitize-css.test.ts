import {describe, expect, it} from 'vitest';

import {MAX_CUSTOM_CSS_CHARS, sanitizeCss, scopeCss} from '../sanitize-css';

describe('sanitizeCss', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeCss('')).toBe('');
  });

  it('strips style-breaking and import payloads', () => {
    const css = 'h1{color:red}</style>@import url("https://evil.test");body{color:blue}';
    const sanitized = sanitizeCss(css);
    expect(sanitized).not.toContain('</style');
    expect(sanitized).not.toContain('@import');
    expect(sanitized).toContain('color:red');
  });

  it('strips javascript urls and expression()', () => {
    const css = 'a{background:url(javascript:alert(1))}b{width:expression(alert(1))}';
    const sanitized = sanitizeCss(css);
    expect(sanitized.toLowerCase()).not.toContain('javascript:');
    expect(sanitized.toLowerCase()).not.toContain('expression(');
  });

  it('caps length', () => {
    const css = 'a'.repeat(MAX_CUSTOM_CSS_CHARS + 50);
    expect(sanitizeCss(css).length).toBe(MAX_CUSTOM_CSS_CHARS);
  });
});

describe('scopeCss', () => {
  it('prefixes selectors with the block attribute', () => {
    const scoped = scopeCss('Heading-1', 'h1 { color: red }');
    expect(scoped).toContain('[data-lp-block="Heading-1"] h1');
    expect(scoped).toContain('color: red');
  });

  it('scopes selectors inside media queries', () => {
    const scoped = scopeCss('Hero-1', '@media (max-width: 600px) { p { font-size: 14px } }');
    expect(scoped).toContain('@media (max-width: 600px)');
    expect(scoped).toContain('[data-lp-block="Hero-1"] p');
  });

  it('rewrites html/body/:root to the block scope', () => {
    const scoped = scopeCss('Root-1', 'body { background: black }');
    expect(scoped).toContain('[data-lp-block="Root-1"]{ background: black }');
    expect(scoped).not.toContain('body {');
  });

  it('leaves keyframes unprefixed', () => {
    const scoped = scopeCss('Anim-1', '@keyframes spin { from { opacity: 0 } }');
    expect(scoped).toContain('@keyframes spin');
    expect(scoped).not.toContain('[data-lp-block="Anim-1"] @keyframes');
  });
});
