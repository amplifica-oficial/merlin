import {describe, expect, it} from 'vitest';

import {
  BRAZILIAN_STATES,
  FORM_DEFAULT_BUTTON_LABEL,
  FORM_EMAIL_FIELD_KEY,
  FORM_REDIRECT_COUNTDOWN_SECONDS,
  FORM_SELECT_OPTIONS_MAX,
  hydrateEditorFieldOrder,
  insertPastedOptions,
  parseFormButtonHexColor,
  parsePastedOptions,
  resolveFormButtonLabel,
  resolveFormButtonStyle,
  sortOptionsAlphabetically,
  tickRedirectCountdown,
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

describe('parsePastedOptions', () => {
  it('splits on newlines, trims, and drops empty lines', () => {
    expect(parsePastedOptions('Acre\n Bahia \n\nCeará\r\nPiauí')).toEqual(['Acre', 'Bahia', 'Ceará', 'Piauí']);
  });

  it('strips list prefixes', () => {
    expect(parsePastedOptions('- Acre\n* Bahia\n1. Ceará')).toEqual(['Acre', 'Bahia', 'Ceará']);
  });
});

describe('insertPastedOptions', () => {
  it('replaces the current option and inserts the rest below', () => {
    expect(insertPastedOptions(['Option 1', 'Keep'], 0, ['Acre', 'Bahia', 'Ceará'])).toEqual({
      options: ['Acre', 'Bahia', 'Ceará', 'Keep'],
      truncated: false,
    });
  });

  it('caps at the max and flags truncation', () => {
    const existing = Array.from({length: 48}, (_, i) => `Keep ${i}`);
    const pasted = ['A', 'B', 'C', 'D'];
    const result = insertPastedOptions(existing, 0, pasted);

    expect(result.truncated).toBe(true);
    expect(result.options).toHaveLength(FORM_SELECT_OPTIONS_MAX);
    expect(result.options.slice(0, 4)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('sortOptionsAlphabetically', () => {
  it('sorts with Portuguese collation', () => {
    expect(sortOptionsAlphabetically(['São Paulo', 'Acre', 'Ceará', 'Bahia'])).toEqual([
      'Acre',
      'Bahia',
      'Ceará',
      'São Paulo',
    ]);
  });
});

describe('BRAZILIAN_STATES', () => {
  it('lists 27 unique states within the options cap', () => {
    expect(BRAZILIAN_STATES).toHaveLength(27);
    expect(new Set(BRAZILIAN_STATES).size).toBe(27);
    expect(BRAZILIAN_STATES.length).toBeLessThanOrEqual(FORM_SELECT_OPTIONS_MAX);
    expect([...BRAZILIAN_STATES]).toEqual(sortOptionsAlphabetically([...BRAZILIAN_STATES]));
  });
});

describe('tickRedirectCountdown', () => {
  it('counts down 3, 2, 1 then signals redirect', () => {
    expect(tickRedirectCountdown(FORM_REDIRECT_COUNTDOWN_SECONDS)).toEqual({seconds: 2, shouldRedirect: false});
    expect(tickRedirectCountdown(2)).toEqual({seconds: 1, shouldRedirect: false});
    expect(tickRedirectCountdown(1)).toEqual({seconds: 0, shouldRedirect: true});
  });

  it('redirects when the countdown is already elapsed', () => {
    expect(tickRedirectCountdown(0)).toEqual({seconds: 0, shouldRedirect: true});
  });
});

describe('resolveFormButtonLabel', () => {
  it('defaults to Subscribe when the label is missing or blank', () => {
    expect(resolveFormButtonLabel(undefined)).toBe(FORM_DEFAULT_BUTTON_LABEL);
    expect(resolveFormButtonLabel('')).toBe(FORM_DEFAULT_BUTTON_LABEL);
    expect(resolveFormButtonLabel('   ')).toBe(FORM_DEFAULT_BUTTON_LABEL);
  });

  it('uses a custom label when provided', () => {
    expect(resolveFormButtonLabel('Join waitlist')).toBe('Join waitlist');
  });
});

describe('parseFormButtonHexColor', () => {
  it('accepts 3-digit and 6-digit hex colors', () => {
    expect(parseFormButtonHexColor('#abc')).toBe('#abc');
    expect(parseFormButtonHexColor('#AABBCC')).toBe('#AABBCC');
  });

  it('ignores invalid hex values', () => {
    expect(parseFormButtonHexColor(undefined)).toBeUndefined();
    expect(parseFormButtonHexColor('red')).toBeUndefined();
    expect(parseFormButtonHexColor('#gg0000')).toBeUndefined();
    expect(parseFormButtonHexColor('#1234')).toBeUndefined();
  });
});

describe('resolveFormButtonStyle', () => {
  it('returns no style when colors are unset', () => {
    expect(resolveFormButtonStyle({})).toBeUndefined();
  });

  it('applies valid custom colors and ignores invalid ones', () => {
    expect(resolveFormButtonStyle({buttonColor: '#2563eb', buttonTextColor: '#fff'})).toEqual({
      backgroundColor: '#2563eb',
      color: '#fff',
    });
    expect(resolveFormButtonStyle({buttonColor: 'blue', buttonTextColor: '#111111'})).toEqual({
      color: '#111111',
    });
  });
});
