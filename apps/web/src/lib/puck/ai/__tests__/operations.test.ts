import type {Data} from '@puckeditor/core';
import type {LandingAiComponentCatalog} from '@merlin/types';
import {describe, expect, it} from 'vitest';

import {buildOutline} from '../outline';
import {
  duplicateBlock,
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  replacePage,
  setBlockCss,
  setElementStyle,
  setPageStyle,
  updateBlock,
  updateBlockProp,
  updatePage,
} from '../operations';

const catalog: LandingAiComponentCatalog[] = [
  {
    type: 'Heading',
    label: 'Heading',
    fields: {
      text: {type: 'text'},
      customCss: {type: 'textarea'},
    },
    slots: [],
    defaultProps: {text: 'Heading', customCss: ''},
  },
  {
    type: 'Section',
    label: 'Section',
    fields: {
      content: {type: 'slot'},
      customCss: {type: 'textarea'},
    },
    slots: ['content'],
    defaultProps: {content: [], customCss: ''},
  },
  {
    type: 'PageUiTestimonials',
    label: 'Testimonials',
    fields: {
      testimonials: {type: 'array'},
      customCss: {type: 'textarea'},
    },
    slots: [],
    defaultProps: {testimonials: [], customCss: ''},
  },
];

function heading(id: string, text = 'Title'): Data['content'][number] {
  return {type: 'Heading', props: {id, text, customCss: ''}};
}

function page(content: Data['content']): Data {
  return {root: {props: {}}, content};
}

describe('landing AI operations', () => {
  it('updates props with a deep merge and keeps the id', () => {
    const data = page([heading('Heading-1', 'Old')]);
    const next = updateBlock(data, 'Heading-1', {text: 'New'}, catalog);
    expect(findBlock(next, 'Heading-1', catalog)?.block.props).toMatchObject({
      id: 'Heading-1',
      text: 'New',
    });
  });

  it('inserts into a parent slot and assigns an id', () => {
    const data = page([{type: 'Section', props: {id: 'Section-1', content: [], customCss: ''}}]);
    const inserted = insertBlock(data, {type: 'Heading', props: {text: 'Inside'}, parentId: 'Section-1'}, catalog);
    const parent = findBlock(inserted.data, 'Section-1', catalog);
    const children = parent?.block.props.content as Array<{props: {id: string; text: string}}>;
    expect(children).toHaveLength(1);
    expect(children[0]?.props.text).toBe('Inside');
    expect(children[0]?.props.id).toMatch(/^Heading-/);
    expect(inserted.id).toBe(children[0]?.props.id);
  });

  it('rejects unknown component types', () => {
    expect(() => insertBlock(page([]), {type: 'Nope'}, catalog)).toThrow('Unknown component type: Nope');
  });

  it('rejects types not allowed in a slot', () => {
    const restricted: LandingAiComponentCatalog[] = [
      ...catalog,
      {
        type: 'Hero',
        label: 'Hero',
        fields: {form: {type: 'slot', allow: ['Heading']}},
        slots: ['form'],
        defaultProps: {form: []},
      },
    ];
    const data = page([{type: 'Hero', props: {id: 'Hero-1', form: []}}]);
    expect(() => insertBlock(data, {type: 'Section', parentId: 'Hero-1', slot: 'form'}, restricted)).toThrow(
      'Section is not allowed in Hero.form',
    );
  });

  it('removes, duplicates, and moves blocks', () => {
    const start = page([
      heading('Heading-1', 'A'),
      heading('Heading-2', 'B'),
      {type: 'Section', props: {id: 'Section-1', content: [], customCss: ''}},
    ]);

    const removed = removeBlock(start, 'Heading-2', catalog);
    expect(findBlock(removed, 'Heading-2', catalog)).toBeNull();

    const duplicated = duplicateBlock(start, 'Heading-1', catalog);
    expect(duplicated.data.content).toHaveLength(4);
    expect(duplicated.id).not.toBe('Heading-1');

    const moved = moveBlock(start, {id: 'Heading-1', parentId: 'Section-1', index: 0}, catalog);
    expect(findBlock(moved, 'Heading-1', catalog)?.location).toMatchObject({
      parentId: 'Section-1',
      slot: 'content',
      index: 0,
    });
  });

  it('sets scoped css, page css, and replaces the page', () => {
    const data = page([heading('Heading-1')]);
    const withCss = setBlockCss(data, 'Heading-1', 'h1{color:red}', catalog);
    expect(findBlock(withCss, 'Heading-1', catalog)?.block.props.customCss).toBe('h1{color:red}');

    const withRoot = updatePage(data, {customCss: 'body{margin:0}'});
    expect(withRoot.root.props).toMatchObject({customCss: 'body{margin:0}'});

    const replaced = replacePage(data, [{type: 'Heading', props: {text: 'Fresh'}}], catalog);
    expect(replaced.content).toHaveLength(1);
    expect((replaced.content[0] as {props: {text: string}}).props.text).toBe('Fresh');
    expect((replaced.content[0] as {props: {id: string}}).props.id).toMatch(/^Heading-/);
  });

  it('updates a nested array prop by path', () => {
    const data = page([
      {
        type: 'PageUiTestimonials',
        props: {
          id: 'Testi-1',
          customCss: '',
          testimonials: [
            {text: 'A', name: 'Ana'},
            {text: 'B', name: 'Bia'},
            {text: 'C', name: 'Caio'},
          ],
        },
      },
    ]);
    const next = updateBlockProp(data, 'Testi-1', 'testimonials.2.text', 'Novo', catalog);
    const props = findBlock(next, 'Testi-1', catalog)?.block.props as unknown as {
      testimonials: Array<{text: string; name: string}>;
    };
    expect(props.testimonials[2]?.text).toBe('Novo');
    expect(props.testimonials[2]?.name).toBe('Caio');
    expect(props.testimonials[0]?.text).toBe('A');
  });

  it('merges a CSS rule on a block without dropping the rest', () => {
    const data = page([heading('Heading-1')]);
    const withCss = setBlockCss(data, 'Heading-1', 'h1{color:red} p{margin:0}', catalog);
    const next = setElementStyle(withCss, 'Heading-1', 'h1', {color: 'blue', 'font-size': '32px'}, catalog);
    expect(findBlock(next, 'Heading-1', catalog)?.block.props.customCss).toContain('h1{color: blue; font-size: 32px}');
    expect(findBlock(next, 'Heading-1', catalog)?.block.props.customCss).toContain('p{margin:0}');
  });

  it('merges page-level CSS', () => {
    const data = page([]);
    const next = setPageStyle(data, 'body', {background: '#111'});
    expect(String((next.root.props as Record<string, unknown> | undefined)?.customCss)).toContain(
      'body{background: #111}',
    );
  });

  it('builds a compact outline with slots', () => {
    const data = page([
      {
        type: 'Section',
        props: {
          id: 'Section-1',
          customCss: '',
          content: [heading('Heading-1', 'Hello')],
        },
      },
    ]);
    const outline = buildOutline(data, catalog);
    expect(outline.content[0]).toMatchObject({
      id: 'Section-1',
      type: 'Section',
      slots: {
        content: [{id: 'Heading-1', type: 'Heading', props: {text: 'Hello'}}],
      },
    });
  });
});
