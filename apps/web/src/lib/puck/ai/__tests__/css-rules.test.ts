import {describe, expect, it} from 'vitest';

import {upsertCssRule} from '../css-rules';

describe('upsertCssRule', () => {
  it('appends a new rule', () => {
    expect(upsertCssRule('', 'h1', {color: 'red'})).toBe('h1{color: red}');
  });

  it('replaces the same selector and keeps siblings', () => {
    const next = upsertCssRule('h1{color: red} p{margin: 0}', 'h1', {color: 'blue', 'font-size': '20px'});
    expect(next).toContain('h1{color: blue; font-size: 20px}');
    expect(next).toContain('p{margin: 0}');
  });

  it('preserves @media blocks', () => {
    const css = '@media (min-width: 800px){h1{font-size: 40px}} h1{color: red}';
    const next = upsertCssRule(css, 'h1', {color: 'navy'});
    expect(next).toContain('@media (min-width: 800px){h1{font-size: 40px}}');
    expect(next).toContain('h1{color: navy}');
  });

  it('sanitizes dangerous declarations', () => {
    const next = upsertCssRule('', 'a', {color: 'red', background: 'javascript:alert(1)'});
    expect(next).toBe('a{color: red}');
  });
});
