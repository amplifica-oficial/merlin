import type {FormField, FormFieldType} from '@merlin/types';

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

export const FORM_SELECT_OPTIONS_MAX = 50;

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
