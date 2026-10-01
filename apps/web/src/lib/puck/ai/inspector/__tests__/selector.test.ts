// @vitest-environment happy-dom

import {Window} from 'happy-dom';
import {describe, expect, it} from 'vitest';

import {describeElement} from '../describe-element';
import {
  buildRelativeSelector,
  elementsStackAtPoint,
  findBlockRoot,
  normalizeInspectTarget,
  pickElementFromPoint,
  walkTree,
} from '../selector';

describe('inspector selector', () => {
  it('builds a nth-of-type chain from the block wrapper', () => {
    document.body.innerHTML = `
      <div data-lp-block="Band-1">
        <section>
          <div class="flex gap-4">
            <h2>Title</h2>
          </div>
        </section>
      </div>
    `;
    const heading = document.querySelector('h2');
    const root = findBlockRoot(heading!);
    expect(root?.getAttribute('data-lp-block')).toBe('Band-1');
    expect(buildRelativeSelector(heading!, root)).toBe(
      '> section:nth-of-type(1) > div:nth-of-type(1) > h2:nth-of-type(1)',
    );
  });

  it('skips puck overlays when picking from a point', () => {
    document.body.innerHTML = `
      <div data-lp-block="A"><h1>Hi</h1></div>
      <div data-puck-overlay style="position:fixed;inset:0"></div>
    `;
    const heading = document.querySelector('h1') as HTMLElement;
    const overlay = document.querySelector('[data-puck-overlay]') as HTMLElement;

    document.elementsFromPoint = () => [overlay, heading];
    const picked = pickElementFromPoint(document, 20, 20);
    expect(picked).toBe(heading);
  });

  it('normalizes an inline-edit portal span to the host heading', () => {
    document.body.innerHTML = `
      <div data-lp-block="Band-1">
        <h2 class="title">Hello <span data-puck-overlay-portal="true">world</span></h2>
      </div>
    `;
    const portal = document.querySelector('[data-puck-overlay-portal]')!;
    const heading = document.querySelector('h2')!;
    const root = findBlockRoot(heading);

    expect(normalizeInspectTarget(portal)).toBe(heading);
    expect(buildRelativeSelector(portal, root)).toBe('> h2:nth-of-type(1)');
    expect(buildRelativeSelector(portal, root)).not.toContain('span');
  });

  it('resolves a display-contents block wrapper to the first real child', () => {
    document.body.innerHTML = `
      <div data-lp-block="Band-1">
        <section class="band"><h2>Title</h2></section>
      </div>
    `;
    const wrapper = document.querySelector('[data-lp-block]')!;
    const section = document.querySelector('section')!;
    expect(normalizeInspectTarget(wrapper)).toBe(section);
  });

  it('does not skip overlay portals in the hit stack — they become the parent', () => {
    document.body.innerHTML = `
      <div data-lp-block="A">
        <h2>Hi <span data-puck-overlay-portal="true">text</span></h2>
      </div>
    `;
    const heading = document.querySelector('h2') as HTMLElement;
    const portal = document.querySelector('[data-puck-overlay-portal]') as HTMLElement;

    document.elementsFromPoint = () => [portal, heading];
    expect(pickElementFromPoint(document, 10, 10)).toBe(heading);
  });

  it('walks up and down the tree, skipping the block wrapper', () => {
    document.body.innerHTML = `<div data-lp-block="A"><p><span>x</span></p></div>`;
    const span = document.querySelector('span')!;
    const paragraph = document.querySelector('p')!;
    const up = walkTree(span, 'up');
    expect(up).toBe(paragraph);
    expect(walkTree(up!, 'down')).toBe(span);
    expect(walkTree(paragraph, 'up')).toBeNull();
  });

  it('deduplicates the stack after portal normalization', () => {
    document.body.innerHTML = `
      <div data-lp-block="A">
        <section>
          <h2>Hi <span data-puck-overlay-portal="true">text</span></h2>
        </section>
      </div>
    `;
    const section = document.querySelector('section') as HTMLElement;
    const heading = document.querySelector('h2') as HTMLElement;
    const portal = document.querySelector('[data-puck-overlay-portal]') as HTMLElement;

    document.elementsFromPoint = () => [portal, heading, section];
    expect(elementsStackAtPoint(document, 10, 10)).toEqual([heading, section]);
  });

  it('picks nodes from another window realm', async () => {
    const frame = new Window();
    const doc = frame.document;
    doc.body.innerHTML = `
      <div data-lp-block="Band-1">
        <section><h2 class="title">Hello</h2></section>
      </div>
    `;
    const heading = doc.querySelector('h2')!;
    const frameDoc = doc as unknown as Document;
    frameDoc.elementsFromPoint = () => [heading as unknown as Element];

    expect(pickElementFromPoint(frameDoc, 10, 10)).toBe(heading);
    const described = describeElement(heading as unknown as Element, {
      props: {title: 'Hello'},
      id: 'pick-frame',
    });
    expect(described.tag).toBe('h2');
    expect(described.blockId).toBe('Band-1');
    expect(described.propMatches).toContain('title');

    await frame.happyDOM.close();
  });

  it('picks a foreign-realm node that fails instanceof Element', () => {
    type Foreign = {
      nodeType: 1;
      tagName: string;
      parentElement: Foreign | null;
      children: Foreign[];
      attrs: Record<string, string>;
      classList: string[];
      textContent: string;
      outerHTML: string;
      ownerDocument: {documentElement: null; body: null; defaultView: null};
      hasAttribute(name: string): boolean;
      getAttribute(name: string): string | null;
      closest(selector: string): Foreign | null;
      getBoundingClientRect(): {width: number; height: number; top: number; left: number; right: number; bottom: number};
    };

    const make = (tag: string, parent: Foreign | null, attrs: Record<string, string> = {}): Foreign => {
      const node: Foreign = {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        parentElement: parent,
        children: [],
        attrs,
        classList: (attrs.class ?? '').split(/\s+/).filter(Boolean),
        textContent: '',
        outerHTML: '',
        ownerDocument: {documentElement: null, body: null, defaultView: null},
        hasAttribute(name) {
          return Object.prototype.hasOwnProperty.call(this.attrs, name);
        },
        getAttribute(name) {
          return this.attrs[name] ?? null;
        },
        closest(selector) {
          const attr = selector.match(/^\[([^\]]+)\]$/)?.[1];
          if (attr && this.hasAttribute(attr)) {
            return this;
          }
          let current = this.parentElement;
          while (current) {
            if (attr && current.hasAttribute(attr)) {
              return current;
            }
            current = current.parentElement;
          }
          return null;
        },
        getBoundingClientRect() {
          return {width: 40, height: 16, top: 0, left: 0, right: 40, bottom: 16};
        },
      };
      parent?.children.push(node);
      return node;
    };

    const block = make('div', null, {'data-lp-block': 'Band-1'});
    const section = make('section', block);
    const heading = make('h2', section, {class: 'title'});
    heading.textContent = 'Hello';
    heading.outerHTML = '<h2 class="title">Hello</h2>';

    expect(heading instanceof Element).toBe(false);

    const doc = {
      documentElement: null,
      body: null,
      elementsFromPoint: () => [heading],
    } as unknown as Document;

    expect(pickElementFromPoint(doc, 8, 8)).toBe(heading);
    expect(elementsStackAtPoint(doc, 8, 8)).toEqual([heading]);

    const described = describeElement(heading as unknown as Element, {
      props: {title: 'Hello'},
      id: 'pick-x',
    });
    expect(described).toMatchObject({
      id: 'pick-x',
      tag: 'h2',
      blockId: 'Band-1',
      selector: '> section:nth-of-type(1) > h2:nth-of-type(1)',
    });
    expect(described.propMatches).toContain('title');
  });
});
