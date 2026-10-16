import type {CSSProperties} from 'react';

import type {HtmlAttribute, HtmlPageRootProps, HtmlPageScript, PuckData} from '@merlin/types';

export const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const TAG_NAME = /^[a-zA-Z][\w:-]*$/;
const ATTR_NAME = /^[a-zA-Z_:][\w:.-]*$/;

export function safeTag(tag: string | undefined, fallback = 'div'): string {
  const normalized = (tag || fallback).trim().toLowerCase();
  return TAG_NAME.test(normalized) ? normalized : fallback;
}

export function isSafeAttrName(name: string): boolean {
  return ATTR_NAME.test(name);
}

export function isEventAttr(name: string): boolean {
  return /^on/i.test(name);
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function parseStyle(style: string | undefined): CSSProperties {
  const result: Record<string, string> = {};
  if (!style) {
    return result;
  }

  for (const part of style.split(';')) {
    const index = part.indexOf(':');
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key || !value) {
      continue;
    }
    const reactKey = key.startsWith('--') ? key : key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    result[reactKey] = value;
  }

  return result;
}

export function joinClass(...parts: Array<string | undefined>): string | undefined {
  const value = parts
    .flatMap(part => (part ? part.split(/\s+/) : []))
    .filter(Boolean)
    .join(' ');
  return value || undefined;
}

export function reactAttributes(attributes: HtmlAttribute[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const attribute of attributes ?? []) {
    if (!isSafeAttrName(attribute.name) || isEventAttr(attribute.name)) {
      continue;
    }
    if (attribute.name === 'class' || attribute.name === 'style') {
      continue;
    }
    const name = attribute.name === 'for' ? 'htmlFor' : attribute.name;
    result[name] = attribute.value;
  }
  return result;
}

export function eventAttributes(attributes: HtmlAttribute[] | undefined): HtmlAttribute[] {
  return (attributes ?? []).filter(attribute => isSafeAttrName(attribute.name) && isEventAttr(attribute.name));
}

export function serializeAttributes(attributes: HtmlAttribute[] | undefined): string {
  const parts: string[] = [];
  for (const attribute of attributes ?? []) {
    if (!isSafeAttrName(attribute.name)) {
      continue;
    }
    parts.push(` ${attribute.name}="${escapeAttr(attribute.value)}"`);
  }
  return parts.join('');
}

export function openTag(
  tag: string,
  options: {className?: string; style?: string; attributes?: HtmlAttribute[]},
): string {
  const safe = safeTag(tag);
  const classAttr = options.className ? ` class="${escapeAttr(options.className)}"` : '';
  const styleAttr = options.style ? ` style="${escapeAttr(options.style)}"` : '';
  return `<${safe}${classAttr}${styleAttr}${serializeAttributes(options.attributes)}>`;
}

export function wrapTag(
  tag: string,
  inner: string,
  options: {className?: string; style?: string; attributes?: HtmlAttribute[]},
): string {
  const safe = safeTag(tag);
  const open = openTag(safe, options);
  if (VOID_TAGS.has(safe)) {
    return open;
  }
  return `${open}${inner}</${safe}>`;
}

export function asAttributeList(value: unknown): HtmlAttribute[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const name = 'name' in item && typeof item.name === 'string' ? item.name : '';
    const attrValue = 'value' in item && typeof item.value === 'string' ? item.value : '';
    if (!name) {
      return [];
    }
    return [{name, value: attrValue}];
  });
}

export function asScripts(value: unknown): HtmlPageScript[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const record = item as Record<string, unknown>;
    const placement = record.placement === 'body' ? 'body' : 'head';
    return [
      {
        src: typeof record.src === 'string' ? record.src : undefined,
        content: typeof record.content === 'string' ? record.content : undefined,
        attributes: asAttributeList(record.attributes),
        placement,
        runInEditor: record.runInEditor === true,
      },
    ];
  });
}

export function readHtmlRoot(
  data: PuckData | {root?: {props?: Record<string, unknown>}} | null | undefined,
): HtmlPageRootProps {
  const props = data?.root?.props ?? {};
  return {
    headHtml: typeof props.headHtml === 'string' ? props.headHtml : '',
    htmlAttributes: asAttributeList(props.htmlAttributes),
    bodyAttributes: asAttributeList(props.bodyAttributes),
    scripts: asScripts(props.scripts),
  };
}

export function stringProp(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value : '';
}
