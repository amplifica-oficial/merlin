import {LANDING_AI_TOOL_NAMES} from '@merlin/shared';
import {describe, expect, it} from 'vitest';

import {parsePositiveInt} from '../../app/constants.js';
import {
  buildSystemPrompt,
  createLandingAiTools,
  isLandingAiEnabled,
  truncateJson,
  truncateOutline,
} from '../LandingPageAiService.js';

describe('LandingPageAiService helpers', () => {
  it('reports whether OpenAI is configured', () => {
    expect(typeof isLandingAiEnabled()).toBe('boolean');
  });

  it('keeps JSON under the character budget by dropping array tail', () => {
    const value = [
      {id: 'a', text: 'x'.repeat(40)},
      {id: 'b', text: 'y'.repeat(40)},
      {id: 'c', text: 'z'.repeat(40)},
    ];
    const truncated = truncateJson(value, 80);
    expect(Array.isArray(truncated)).toBe(true);
    expect(JSON.stringify(truncated).length).toBeLessThanOrEqual(80);
  });

  it('returns a preview object when a non-array payload is too large', () => {
    const truncated = truncateJson({huge: 'z'.repeat(200)}, 40);
    expect(truncated).toMatchObject({truncated: true});
    expect(typeof (truncated as {preview: string}).preview).toBe('string');
  });

  it('marks outline truncation instead of dropping silently', () => {
    const outline = {
      root: {},
      content: [
        {id: 'A', type: 'Heading', props: {text: 'x'.repeat(80)}},
        {id: 'B', type: 'Heading', props: {text: 'y'.repeat(80)}},
        {id: 'C', type: 'Heading', props: {text: 'z'.repeat(80)}},
      ],
    };
    const truncated = truncateOutline(outline, 160);
    expect(truncated.truncated).toBe(true);
    expect((truncated.omittedBlocks ?? 0) > 0).toBe(true);
    expect(truncated.content.length).toBeLessThan(outline.content.length);
  });

  it('falls back when the rate limit is not a positive integer', () => {
    expect(parsePositiveInt('60', 60)).toBe(60);
    expect(parsePositiveInt('abc', 60)).toBe(60);
    expect(parsePositiveInt('0', 60)).toBe(60);
    expect(parsePositiveInt('-3', 60)).toBe(60);
    expect(parsePositiveInt('1.5', 60)).toBe(60);
  });

  it('includes catalog, outline, picked elements, and selected block in the system prompt', () => {
    const prompt = buildSystemPrompt({
      catalog: [{type: 'Heading', label: 'Heading', slots: []}],
      outline: {root: {}, content: [{id: 'Heading-1', type: 'Heading', props: {text: 'Hi'}}], truncated: true, omittedBlocks: 2},
      selectedId: 'Heading-1',
      pickedElements: [
        {
          id: 'pick-1',
          blockId: 'Heading-1',
          blockType: 'Heading',
          selector: '> h1:nth-of-type(1)',
          tag: 'h1',
          classes: [],
          text: 'Hi',
          outerHtml: '<h1>Hi</h1>',
          rect: {width: 120, height: 32},
          styles: {color: 'rgb(0, 0, 0)'},
          propMatches: ['text'],
        },
        {
          id: 'pick-2',
          blockId: 'Heading-1',
          blockType: 'Heading',
          selector: '> p:nth-of-type(1)',
          tag: 'p',
          classes: [],
          text: 'Body',
          outerHtml: '<p>Body</p>',
          rect: {width: 80, height: 20},
          styles: {},
          propMatches: [],
        },
      ],
    });

    expect(prompt).toContain('Heading-1');
    expect(prompt).toContain('Only use component types from the catalog');
    expect(prompt).toContain('"type":"Heading"');
    expect(prompt).toContain('Elementos escolhidos pelo usuário');
    expect(prompt).toContain('update_block_prop');
    expect(prompt).toContain('"#":1');
    expect(prompt).toContain('"#":2');
    expect(prompt).toContain('cite #n');
    expect(prompt).toContain('once per element');
    expect(prompt).toContain('outline was truncated');
    expect(prompt).toContain('get_page');
  });

  it('defines client-side tools without execute handlers', () => {
    const tools = createLandingAiTools();
    expect(Object.keys(tools).sort()).toEqual([...LANDING_AI_TOOL_NAMES].sort());
    expect(tools.update_block.execute).toBeUndefined();
    expect(tools.insert_block.execute).toBeUndefined();
    expect(tools.update_block_prop.execute).toBeUndefined();
  });
});
