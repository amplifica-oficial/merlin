// @vitest-environment happy-dom

import {describe, expect, it} from 'vitest';

import {describeElement} from '../describe-element';

describe('describeElement', () => {
  it('snapshots tag, selector, text, and prop matches', () => {
    document.body.innerHTML = `
      <div data-lp-block="Band-1">
        <h2 class="title">Hello world</h2>
      </div>
    `;
    const heading = document.querySelector('h2')!;
    const picked = describeElement(heading, {
      props: {title: 'Hello world'},
      id: 'pick-1',
    });

    expect(picked).toMatchObject({
      id: 'pick-1',
      blockId: 'Band-1',
      tag: 'h2',
      text: 'Hello world',
      selector: '> h2:nth-of-type(1)',
    });
    expect(picked.classes).toContain('title');
    expect(picked.propMatches).toContain('title');
    expect(picked.outerHtml).toContain('Hello world');
  });

  it('snapshots inline-editable text as the host heading, not the portal span', () => {
    document.body.innerHTML = `
      <div data-lp-block="Band-1">
        <h2 class="title">Hello <span data-puck-overlay-portal="true">world</span></h2>
      </div>
    `;
    const portal = document.querySelector('[data-puck-overlay-portal]')!;
    const picked = describeElement(portal, {
      props: {title: 'Hello world'},
      id: 'pick-2',
    });

    expect(picked).toMatchObject({
      id: 'pick-2',
      blockId: 'Band-1',
      tag: 'h2',
      selector: '> h2:nth-of-type(1)',
    });
    expect(picked.propMatches).toContain('title');
    expect(picked.selector).not.toContain('span');
  });
});

