import type {Config} from '@puckeditor/core';
import type {LandingAiComponentCatalog, LandingAiFieldCatalog} from '@merlin/types';

import {getComponentDoc} from './component-docs';
import {sanitizeJson} from './json';

const FIELD_HINTS_BY_NAME: Record<string, string> = {
  src: 'image-url',
  iconSrc: 'image-url',
  imageSrc: 'image-url',
  backgroundImageSrc: 'image-url',
  avatarSrc: 'image-url',
  logoSrc: 'image-url',
  posterSrc: 'image-url',
  thumbnailSrc: 'image-url',
  formPublicId: 'form-public-id',
};

export function inferFieldHint(name: string, field: Record<string, unknown>): string | undefined {
  if (typeof field.aiHint === 'string' && field.aiHint.length > 0) {
    return field.aiHint;
  }
  if (FIELD_HINTS_BY_NAME[name]) {
    return FIELD_HINTS_BY_NAME[name];
  }

  const type = typeof field.type === 'string' ? field.type : '';
  const label = typeof field.label === 'string' ? field.label : '';
  const haystack = `${name} ${label}`;

  if ((type === 'custom' || type === 'text') && /image|src|icon|photo|avatar|logo|poster|thumb/i.test(haystack)) {
    return 'image-url';
  }
  if ((type === 'external' || type === 'custom') && /form/i.test(haystack)) {
    return 'form-public-id';
  }

  return undefined;
}

export function serializeField(field: unknown, name = ''): LandingAiFieldCatalog {
  if (!field || typeof field !== 'object') {
    return {type: 'unknown'};
  }

  const raw = field as Record<string, unknown>;
  const type = typeof raw.type === 'string' ? raw.type : 'unknown';
  const serialized: LandingAiFieldCatalog = {type};

  if (typeof raw.label === 'string') {
    serialized.label = raw.label;
  }

  const hint = inferFieldHint(name, raw);
  if (hint) {
    serialized.hint = hint;
  }

  if (Array.isArray(raw.options)) {
    serialized.options = raw.options
      .filter(option => option && typeof option === 'object')
      .map(option => {
        const item = option as {label?: unknown; value?: unknown};
        return {
          label: typeof item.label === 'string' ? item.label : String(item.value ?? ''),
          value: item.value,
        };
      });
  }

  if (Array.isArray(raw.allow)) {
    serialized.allow = raw.allow.filter((item): item is string => typeof item === 'string');
  }

  if (raw.objectFields && typeof raw.objectFields === 'object') {
    serialized.objectFields = serializeFields(raw.objectFields as Record<string, unknown>);
  }

  if (raw.arrayFields && typeof raw.arrayFields === 'object') {
    serialized.arrayFields = serializeFields(raw.arrayFields as Record<string, unknown>);
  }

  return serialized;
}

export function serializeFields(fields: Record<string, unknown>): Record<string, LandingAiFieldCatalog> {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, serializeField(field, name)]));
}

export type SerializeCatalogOptions = {
  includeDefaults?: boolean;
  summary?: boolean;
};

export function serializeCatalog(
  config: Config,
  options?: SerializeCatalogOptions,
): LandingAiComponentCatalog[] {
  const typeToCategory = new Map<string, string>();
  for (const [categoryName, category] of Object.entries(config.categories ?? {})) {
    const title = typeof category.title === 'string' ? category.title : categoryName;
    for (const type of category.components ?? []) {
      typeToCategory.set(type, title);
    }
  }

  return Object.entries(config.components ?? {}).map(([type, component]) => {
    const fields = serializeFields((component.fields ?? {}) as Record<string, unknown>);
    const slots = Object.entries(fields)
      .filter(([, field]) => field.type === 'slot')
      .map(([name]) => name);
    const doc = getComponentDoc(type);

    const entry: LandingAiComponentCatalog = {
      type,
      label: component.label ?? type,
      category: typeToCategory.get(type),
      description: doc?.description,
      useWhen: doc?.useWhen,
      fields: options?.summary ? {} : fields,
      slots,
    };

    if (options?.includeDefaults) {
      entry.defaultProps = sanitizeJson(component.defaultProps ?? {}, {
        maxString: 300,
        maxArray: 6,
        depth: 5,
      }) as Record<string, unknown>;
    }

    return entry;
  });
}

export function serializeCatalogSummary(config: Config): LandingAiComponentCatalog[] {
  return serializeCatalog(config, {summary: true});
}

export function getComponentSchema(config: Config, type: string): LandingAiComponentCatalog | undefined {
  return serializeCatalog(config, {includeDefaults: true}).find(component => component.type === type);
}
