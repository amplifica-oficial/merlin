import type {Config} from '@puckeditor/core';
import {describe, expect, it} from 'vitest';

import {serializeCatalog, serializeField} from '../catalog';

const fakeConfig = {
  categories: {
    content: {title: 'Content', components: ['Heading']},
    layout: {title: 'Layout', components: ['Section']},
  },
  components: {
    Heading: {
      label: 'Heading',
      defaultProps: {text: 'Hello', level: '1'},
      fields: {
        text: {type: 'text', label: 'Text'},
        level: {
          type: 'select',
          options: [
            {label: 'H1', value: '1'},
            {label: 'H2', value: '2'},
          ],
        },
      },
    },
    Section: {
      label: 'Section',
      defaultProps: {content: []},
      fields: {
        content: {type: 'slot', label: 'Content', allow: ['Heading']},
      },
    },
  },
} as unknown as Config;

describe('serializeField', () => {
  it('keeps type, label, and options', () => {
    expect(
      serializeField({
        type: 'select',
        label: 'Level',
        options: [{label: 'H1', value: '1'}],
      }),
    ).toEqual({
      type: 'select',
      label: 'Level',
      options: [{label: 'H1', value: '1'}],
    });
  });

  it('ignores render functions on custom fields and adds an image-url hint', () => {
    const field = serializeField(
      {
        type: 'custom',
        label: 'Image URL',
        render: () => null,
      },
      'src',
    );
    expect(field).toEqual({type: 'custom', label: 'Image URL', hint: 'image-url'});
  });

  it('marks form public ids', () => {
    expect(serializeField({type: 'external', label: 'Form'}, 'formPublicId')).toMatchObject({
      hint: 'form-public-id',
    });
  });
});

describe('serializeCatalog', () => {
  it('includes category, slots, and field options', () => {
    const catalog = serializeCatalog(fakeConfig);
    expect(catalog).toHaveLength(2);
    expect(catalog[0]).toMatchObject({
      type: 'Heading',
      label: 'Heading',
      category: 'Content',
      slots: [],
    });
    expect(catalog[1]).toMatchObject({
      type: 'Section',
      category: 'Layout',
      slots: ['content'],
    });
    expect(catalog[1]?.fields.content?.allow).toEqual(['Heading']);
  });

  it('omits defaultProps unless requested', () => {
    const summary = serializeCatalog(fakeConfig);
    expect(summary[0]?.defaultProps).toBeUndefined();

    const full = serializeCatalog(fakeConfig, {includeDefaults: true});
    expect(full[0]?.defaultProps).toMatchObject({text: 'Hello', level: '1'});
  });

  it('omits fields in the two-level summary catalog', () => {
    const summary = serializeCatalog(fakeConfig, {summary: true});
    expect(summary[0]?.fields).toEqual({});
    expect(summary[0]?.slots).toEqual([]);
    expect(summary[1]?.slots).toEqual(['content']);
  });
});
