import type {LandingAiPickedElement} from '@merlin/types';
import {describe, expect, it} from 'vitest';

import {applyPick} from '../pick-list';

function pick(id: string, selector: string): LandingAiPickedElement {
  return {
    id,
    blockId: 'Band-1',
    blockType: 'PageUiBand',
    selector,
    tag: 'h2',
    classes: [],
    text: id,
    outerHtml: '',
    rect: {width: 10, height: 10},
    styles: {},
    propMatches: [],
  };
}

describe('applyPick', () => {
  it('accumulates clicks', () => {
    const first = applyPick([], pick('a', '> h2:nth-of-type(1)'));
    const second = applyPick(first.items, pick('b', '> p:nth-of-type(1)'));
    expect(second.items.map(item => item.id)).toEqual(['a', 'b']);
    expect(second.dropped).toBe(false);
  });

  it('toggles off an element that is already picked', () => {
    const start = applyPick([], pick('a', '> h2:nth-of-type(1)')).items;
    const next = applyPick(start, pick('a2', '> h2:nth-of-type(1)'));
    expect(next.items).toEqual([]);
    expect(next.dropped).toBe(false);
  });

  it('replaces the selection', () => {
    const start = [pick('a', '> h2:nth-of-type(1)'), pick('b', '> p:nth-of-type(1)')];
    const next = applyPick(start, pick('c', '> div:nth-of-type(1)'), {replace: true});
    expect(next.items.map(item => item.id)).toEqual(['c']);
  });

  it('drops the oldest item past the limit', () => {
    let items: LandingAiPickedElement[] = [];
    for (let index = 0; index < 10; index += 1) {
      items = applyPick(items, pick(String(index), `> h2:nth-of-type(${index + 1})`), {limit: 10}).items;
    }
    const next = applyPick(items, pick('extra', '> h2:nth-of-type(99)'), {limit: 10});
    expect(next.dropped).toBe(true);
    expect(next.items).toHaveLength(10);
    expect(next.items[0]?.id).toBe('1');
    expect(next.items.at(-1)?.id).toBe('extra');
  });
});
