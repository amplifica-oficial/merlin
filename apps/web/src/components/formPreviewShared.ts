import type {FormField, FormFieldType, FormSettings} from '@merlin/types';

import {
  FORM_APPEARANCE_DEFAULTS,
  FORM_COLOR_THEMES,
  FORM_COLOR_TOKEN_KEYS,
  type FormColorThemeId,
  type FormColorTokens,
} from '../lib/formColorThemes';

export {applyFormColorTheme} from '../lib/formColorThemes';

export type FormFieldValues = Record<string, string | number | boolean>;

/** Editor-only identity; never sent to the API */
export type EditorFormField = FormField & {clientId: string};

/** Reserved fieldOrder token for the required email field (not a custom field key) */
export const FORM_EMAIL_FIELD_KEY = '$email';

export function createEditorClientId(): string {
  return crypto.randomUUID();
}

export function toEditorFields(fields: FormField[]): EditorFormField[] {
  return fields.map(field => ({...field, clientId: createEditorClientId()}));
}

export function toPersistedFields(fields: EditorFormField[]): FormField[] {
  return fields.map(({clientId: _clientId, ...field}) => field);
}

export function resolveFieldOrder(fieldOrder: string[] | undefined, fields: FormField[]): string[] {
  const fieldKeySet = new Set(fields.map(f => f.key));
  const result: string[] = [];
  const seen = new Set<string>();

  for (const key of fieldOrder ?? []) {
    if (key === FORM_EMAIL_FIELD_KEY) {
      if (!seen.has(key)) {
        result.push(key);
        seen.add(key);
      }
      continue;
    }
    if (fieldKeySet.has(key) && !seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }

  if (!seen.has(FORM_EMAIL_FIELD_KEY)) {
    result.unshift(FORM_EMAIL_FIELD_KEY);
  }

  for (const field of fields) {
    if (!seen.has(field.key)) {
      result.push(field.key);
    }
  }

  return result;
}

/** Same as resolveFieldOrder, but tokens (except $email) are editor clientIds */
export function resolveEditorFieldOrder(fieldOrder: string[] | undefined, fields: EditorFormField[]): string[] {
  const clientIdSet = new Set(fields.map(f => f.clientId));
  const result: string[] = [];
  const seen = new Set<string>();

  for (const key of fieldOrder ?? []) {
    if (key === FORM_EMAIL_FIELD_KEY) {
      if (!seen.has(key)) {
        result.push(key);
        seen.add(key);
      }
      continue;
    }
    if (clientIdSet.has(key) && !seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }

  if (!seen.has(FORM_EMAIL_FIELD_KEY)) {
    result.unshift(FORM_EMAIL_FIELD_KEY);
  }

  for (const field of fields) {
    if (!seen.has(field.clientId)) {
      result.push(field.clientId);
    }
  }

  return result;
}

export function hydrateEditorFieldOrder(
  persistedOrder: string[] | undefined,
  fields: EditorFormField[],
): string[] {
  const keyToClientId = new Map(fields.map(f => [f.key, f.clientId]));
  return resolveFieldOrder(persistedOrder, fields).map(key =>
    key === FORM_EMAIL_FIELD_KEY ? key : (keyToClientId.get(key) ?? key),
  );
}

export function toPersistedFieldOrder(editorOrder: string[], fields: EditorFormField[]): string[] {
  const byClientId = new Map(fields.map(f => [f.clientId, f]));
  return editorOrder.flatMap(id => {
    if (id === FORM_EMAIL_FIELD_KEY) return [FORM_EMAIL_FIELD_KEY];
    const field = byClientId.get(id);
    return field?.key ? [field.key] : [];
  });
}

export function reorderFieldsFromOrder(fields: FormField[], fieldOrder: string[]): FormField[] {
  const byKey = new Map(fields.map(f => [f.key, f]));
  const ordered: FormField[] = [];

  for (const key of fieldOrder) {
    if (key === FORM_EMAIL_FIELD_KEY) continue;
    const field = byKey.get(key);
    if (field) {
      ordered.push(field);
      byKey.delete(key);
    }
  }

  for (const field of byKey.values()) {
    ordered.push(field);
  }

  return ordered;
}

export const FORM_SELECT_OPTIONS_MAX = 42;

export const FORM_DEFAULT_BUTTON_LABEL = 'Subscribe';
export const FORM_BUTTON_HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function resolveFormButtonLabel(label?: string): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed : FORM_DEFAULT_BUTTON_LABEL;
}

export function parseFormButtonHexColor(value?: string): string | undefined {
  if (!value || !FORM_BUTTON_HEX_COLOR_REGEX.test(value)) {
    return undefined;
  }
  return value;
}

export function resolveFormButtonStyle(settings: {
  buttonColor?: string;
  buttonTextColor?: string;
}): {backgroundColor?: string; color?: string} | undefined {
  const backgroundColor = parseFormButtonHexColor(settings.buttonColor);
  const color = parseFormButtonHexColor(settings.buttonTextColor);
  if (!backgroundColor && !color) {
    return undefined;
  }
  return {
    ...(backgroundColor ? {backgroundColor} : {}),
    ...(color ? {color} : {}),
  };
}

export type FormAppearance = {
  tokens: FormColorTokens;
  wrapperStyle: {
    backgroundColor: string;
    borderColor: string;
    '--form-placeholder': string;
  };
  titleStyle: {color: string};
  descriptionStyle: {color: string};
  labelStyle: {color: string};
  inputStyle: {
    backgroundColor: string;
    borderColor: string;
    color: string;
  };
  successStyle: {color: string};
  errorStyle: {color: string};
  buttonStyle: {backgroundColor: string; color: string};
};

export function resolveFormAppearanceTokens(settings?: Partial<FormSettings>): FormColorTokens {
  const tokens = {...FORM_APPEARANCE_DEFAULTS};
  for (const key of FORM_COLOR_TOKEN_KEYS) {
    const parsed = parseFormButtonHexColor(settings?.[key]);
    if (parsed) {
      tokens[key] = parsed;
    }
  }
  return tokens;
}

export function resolveFormAppearance(settings?: Partial<FormSettings>): FormAppearance {
  const tokens = resolveFormAppearanceTokens(settings);
  return {
    tokens,
    wrapperStyle: {
      backgroundColor: tokens.formBackgroundColor,
      borderColor: tokens.inputBorderColor,
      '--form-placeholder': tokens.inputPlaceholderColor,
    },
    titleStyle: {color: tokens.titleColor},
    descriptionStyle: {color: tokens.descriptionColor},
    labelStyle: {color: tokens.labelColor},
    inputStyle: {
      backgroundColor: tokens.inputBackgroundColor,
      borderColor: tokens.inputBorderColor,
      color: tokens.inputTextColor,
    },
    successStyle: {color: tokens.successColor},
    errorStyle: {color: tokens.errorColor},
    buttonStyle: {
      backgroundColor: tokens.buttonColor,
      color: tokens.buttonTextColor,
    },
  };
}

export function getActiveFormColorThemeId(settings?: Partial<FormSettings>): FormColorThemeId | undefined {
  const tokens = resolveFormAppearanceTokens(settings);
  for (const theme of Object.values(FORM_COLOR_THEMES)) {
    const matches = FORM_COLOR_TOKEN_KEYS.every(key => tokens[key].toLowerCase() === theme[key].toLowerCase());
    if (matches) {
      return theme.id;
    }
  }
  return undefined;
}

export const FORM_REDIRECT_COUNTDOWN_SECONDS = 3;

export function tickRedirectCountdown(seconds: number): {seconds: number; shouldRedirect: boolean} {
  if (seconds <= 1) {
    return {seconds: 0, shouldRedirect: true};
  }
  return {seconds: seconds - 1, shouldRedirect: false};
}

/** Official UF names, alphabetical, within the select options cap */
export const BRAZILIAN_STATES = [
  'Acre',
  'Alagoas',
  'Amapá',
  'Amazonas',
  'Bahia',
  'Ceará',
  'Distrito Federal',
  'Espírito Santo',
  'Goiás',
  'Maranhão',
  'Mato Grosso',
  'Mato Grosso do Sul',
  'Minas Gerais',
  'Pará',
  'Paraíba',
  'Paraná',
  'Pernambuco',
  'Piauí',
  'Rio de Janeiro',
  'Rio Grande do Norte',
  'Rio Grande do Sul',
  'Rondônia',
  'Roraima',
  'Santa Catarina',
  'São Paulo',
  'Sergipe',
  'Tocantins',
] as const;

export function sortOptionsAlphabetically(options: string[]): string[] {
  return [...options].sort((a, b) => a.localeCompare(b, 'pt-BR', {sensitivity: 'base'}));
}

const PASTED_OPTION_PREFIX = /^(?:[-*]\s+|\d+\.\s+)/;

export function parsePastedOptions(text: string): string[] {
  return text
    .split(/\r\n|\n|\r/)
    .map(line => line.trim().replace(PASTED_OPTION_PREFIX, '').trim())
    .filter(Boolean)
    .map(line => line.slice(0, 100));
}

export function insertPastedOptions(
  existing: string[],
  index: number,
  pasted: string[],
  max = FORM_SELECT_OPTIONS_MAX,
): {options: string[]; truncated: boolean} {
  if (pasted.length === 0) {
    return {options: existing, truncated: false};
  }

  const clampedIndex = Math.min(Math.max(index, 0), Math.max(existing.length - 1, 0));
  const next = [...existing.slice(0, clampedIndex), ...pasted, ...existing.slice(clampedIndex + 1)];
  const truncated = next.length > max;
  return {options: truncated ? next.slice(0, max) : next, truncated};
}

export const FORM_FIELD_TYPE_OPTIONS: Array<{value: FormFieldType; label: string}> = [
  {value: 'text', label: 'Text'},
  {value: 'email', label: 'Email'},
  {value: 'textarea', label: 'Textarea'},
  {value: 'number', label: 'Number'},
  {value: 'tel', label: 'Phone'},
  {value: 'url', label: 'URL'},
  {value: 'date', label: 'Date'},
  {value: 'select', label: 'Select'},
  {value: 'checkbox', label: 'Checkbox'},
];

export const selectClassName =
  'flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function getFormFieldInputType(field: FormField): string {
  switch (field.type) {
    case 'email':
      return 'email';
    case 'number':
      return 'number';
    case 'tel':
      return 'tel';
    case 'url':
      return 'url';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}
