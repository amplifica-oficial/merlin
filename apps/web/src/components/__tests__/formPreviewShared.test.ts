import {describe, expect, it} from 'vitest';

import {
  FORM_EMAIL_FIELD_KEY,
  hydrateEditorFieldOrder,
  toPersistedFieldOrder,
  toPersistedFields,
  type EditorFormField,
} from '../formPreviewShared';

function field(partial: Partial<EditorFormField> & Pick<EditorFormField, 'clientId' | 'key'>): EditorFormField {
  return {
    label: 'Label',
    type: 'text',
    required: false,
    ...partial,
  };
}

describe('editor field identity helpers', () => {
  it('hydrates persisted keys into stable clientIds', () => {
    const fields = [field({clientId: 'c-name', key: 'name'}), field({clientId: 'c-city', key: 'city'})];

    expect(hydrateEditorFieldOrder(['city', FORM_EMAIL_FIELD_KEY, 'name'], fields)).toEqual([
      'c-city',
      FORM_EMAIL_FIELD_KEY,
      'c-name',
    ]);
  });

  it('translates clientIds back to field keys and strips editor ids', () => {
    const fields = [field({clientId: 'c-name', key: 'full_name'}), field({clientId: 'c-empty', key: ''})];

    expect(toPersistedFieldOrder([FORM_EMAIL_FIELD_KEY, 'c-name', 'c-empty'], fields)).toEqual([
      FORM_EMAIL_FIELD_KEY,
      'full_name',
    ]);
    expect(toPersistedFields(fields)).toEqual([
      {key: 'full_name', label: 'Label', type: 'text', required: false},
      {key: '', label: 'Label', type: 'text', required: false},
    ]);
  });

  it('keeps a field addressable after the typed key changes', () => {
    const fields = [field({clientId: 'stable', key: 'n'})];
    const editorOrder = [FORM_EMAIL_FIELD_KEY, 'stable'];

    expect(toPersistedFieldOrder(editorOrder, [{...fields[0]!, key: 'name'}])).toEqual([
      FORM_EMAIL_FIELD_KEY,
      'name',
    ]);
  });
});
