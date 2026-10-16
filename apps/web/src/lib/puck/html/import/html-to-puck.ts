import type {HtmlAttribute, HtmlPageScript, LandingPageSettings, PuckData} from '@merlin/types';

export const HTML_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const HTML_IMPORT_MAX_BLOCKS = 5000;

const OPAQUE_TAGS = new Set([
  'svg',
  'iframe',
  'video',
  'audio',
  'canvas',
  'picture',
  'table',
  'form',
  'input',
  'select',
  'textarea',
  'noscript',
  'template',
  'object',
  'embed',
  'style',
  'link',
]);

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'data',
  'dfn',
  'em',
  'i',
  'img',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
  'button',
]);

const RICH_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 'br', 's', 'sub', 'sup', 'span', 'code', 'small', 'mark']);

const URL_ATTRIBUTES = new Set(['src', 'href', 'poster', 'data-src', 'action', 'formaction']);

export interface HtmlImportReport {
  blocks: number;
  rawFallbacks: number;
  scripts: number;
}

export interface HtmlImportResult {
  data: PuckData;
  settings: LandingPageSettings;
  report: HtmlImportReport;
}

export interface HtmlImportOptions {
  baseUrl?: string;
  maxBytes?: number;
  maxBlocks?: number;
}

export class HtmlImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HtmlImportError';
  }
}

interface HtmlBlock {
  type: string;
  props: Record<string, unknown>;
  [key: string]: unknown;
}

interface Budget {
  count: number;
  rawFallbacks: number;
  max: number;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveUrl(value: string, baseUrl?: string): string {
  if (!baseUrl) {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(trimmed)) {
    return value;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return value;
  }
}

function resolveSrcset(value: string, baseUrl?: string): string {
  if (!baseUrl) {
    return value;
  }
  return value
    .split(',')
    .map(part => {
      const bits = part.trim().split(/\s+/);
      if (!bits[0]) {
        return part;
      }
      bits[0] = resolveUrl(bits[0], baseUrl);
      return bits.join(' ');
    })
    .join(', ');
}

function readAttributes(
  element: Element,
  baseUrl?: string,
  skip: string[] = [],
  keepPresentation = false,
): HtmlAttribute[] {
  const skipped = new Set(keepPresentation ? skip : ['class', 'style', ...skip]);
  const attributes: HtmlAttribute[] = [];
  for (const attribute of element.attributes) {
    if (skipped.has(attribute.name)) {
      continue;
    }
    let value = attribute.value;
    if (attribute.name === 'srcset') {
      value = resolveSrcset(value, baseUrl);
    } else if (URL_ATTRIBUTES.has(attribute.name)) {
      value = resolveUrl(value, baseUrl);
    }
    attributes.push({name: attribute.name, value});
  }
  return attributes;
}

function classAndStyle(element: Element): {className: string; style: string} {
  return {
    className: element.getAttribute('class') ?? '',
    style: element.getAttribute('style') ?? '',
  };
}

function isRichSafe(element: Element): boolean {
  for (const child of element.querySelectorAll('*')) {
    if (!RICH_TAGS.has(child.tagName.toLowerCase()) || child.attributes.length > 0) {
      return false;
    }
  }
  return true;
}

function hasStructuralChild(element: Element): boolean {
  return Array.from(element.children).some(child => {
    const tag = child.tagName.toLowerCase();
    return tag === 'img' || tag === 'a' || tag === 'button' || !INLINE_TAGS.has(tag);
  });
}

function runsInEditor(src?: string): boolean {
  return Boolean(src && /cdn\.tailwindcss\.com/i.test(src));
}

function absoluteHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function clip(value: string | null | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, max);
}

function extractSettings(document: Document, baseUrl?: string): LandingPageSettings {
  const settings: LandingPageSettings = {};
  const head = document.head;
  const title = clip(head.querySelector('title')?.textContent, 200);
  if (title) {
    settings.title = title;
  }
  head.querySelector('title')?.remove();

  const description = head.querySelector('meta[name="description" i]');
  const descriptionText = clip(description?.getAttribute('content'), 1000);
  if (descriptionText) {
    settings.description = descriptionText;
  }
  description?.remove();

  const ogTitle = clip(head.querySelector('meta[property="og:title" i]')?.getAttribute('content'), 200);
  const ogDescription = clip(head.querySelector('meta[property="og:description" i]')?.getAttribute('content'), 1000);
  const ogImage = absoluteHttpUrl(
    resolveUrl(head.querySelector('meta[property="og:image" i]')?.getAttribute('content') ?? '', baseUrl),
  );
  if (ogTitle) {
    settings.ogTitle = ogTitle;
  }
  if (ogDescription) {
    settings.ogDescription = ogDescription;
  }
  if (ogImage) {
    settings.ogImageUrl = ogImage;
  }
  head.querySelector('meta[property="og:title" i]')?.remove();
  head.querySelector('meta[property="og:description" i]')?.remove();
  head.querySelector('meta[property="og:image" i]')?.remove();

  const icon = head.querySelector('link[rel~="icon" i]');
  const favicon = absoluteHttpUrl(resolveUrl(icon?.getAttribute('href') ?? '', baseUrl));
  if (favicon) {
    settings.faviconUrl = favicon;
  }
  icon?.remove();

  const canonical = head.querySelector('link[rel="canonical" i]');
  const canonicalUrl = absoluteHttpUrl(resolveUrl(canonical?.getAttribute('href') ?? '', baseUrl));
  if (canonicalUrl) {
    settings.canonicalUrl = canonicalUrl;
  }
  canonical?.remove();

  const twitter = head.querySelector('meta[name="twitter:card" i]')?.getAttribute('content');
  if (twitter === 'summary' || twitter === 'summary_large_image') {
    settings.twitterCard = twitter;
  }
  head.querySelector('meta[name="twitter:card" i]')?.remove();

  return settings;
}

function extractScripts(document: Document): HtmlPageScript[] {
  const scripts: HtmlPageScript[] = [];
  for (const script of Array.from(document.querySelectorAll('script'))) {
    const src = script.getAttribute('src') ?? undefined;
    scripts.push({
      src: src || undefined,
      content: src ? undefined : (script.textContent ?? ''),
      attributes: readAttributes(script, undefined, ['src']),
      placement: script.closest('head') ? 'head' : 'body',
      runInEditor: runsInEditor(src ?? undefined),
    });
    script.remove();
  }
  return scripts;
}

function nodesHtml(nodes: ChildNode[]): string {
  return nodes
    .map(node => (node.nodeType === Node.ELEMENT_NODE ? (node as Element).outerHTML : (node.textContent ?? '')))
    .join('');
}

function makeRaw(element: Element, id: string, baseUrl: string | undefined, budget: Budget): HtmlBlock {
  budget.rawFallbacks += 1;
  const {className, style} = classAndStyle(element);
  return {
    type: 'HtmlRaw',
    props: {
      id,
      tag: element.tagName.toLowerCase(),
      className,
      style,
      attributes: readAttributes(element, baseUrl),
      html: element.innerHTML,
    },
  };
}

export function htmlToPuckData(html: string, options: HtmlImportOptions = {}): HtmlImportResult {
  const maxBytes = options.maxBytes ?? HTML_IMPORT_MAX_BYTES;
  if (byteLength(html) > maxBytes) {
    throw new HtmlImportError('HTML is larger than 2 MB');
  }

  const baseUrl = options.baseUrl?.trim() || undefined;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const settings = extractSettings(document, baseUrl);
  const scripts = extractScripts(document);
  const budget: Budget = {count: 0, rawFallbacks: 0, max: options.maxBlocks ?? HTML_IMPORT_MAX_BLOCKS};
  let nextId = 0;
  const id = () => `html-${++nextId}`;

  const convertChildren = (nodes: ChildNode[]): HtmlBlock[] => {
    const blocks: HtmlBlock[] = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!node) {
        continue;
      }
      if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) {
        continue;
      }
      if (node.nodeType === Node.COMMENT_NODE) {
        continue;
      }
      if (budget.count >= budget.max) {
        const remainder = nodesHtml(nodes.slice(index)).trim();
        if (remainder) {
          budget.count += 1;
          budget.rawFallbacks += 1;
          blocks.push({
            type: 'HtmlRaw',
            props: {id: id(), tag: 'div', className: '', style: '', attributes: [], html: remainder},
          });
        }
        break;
      }
      blocks.push(...convertNode(node));
    }
    return blocks;
  };

  const convertNode = (node: ChildNode): HtmlBlock[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text.trim()) {
        return [];
      }
      budget.count += 1;
      return [
        {
          type: 'HtmlText',
          props: {
            id: id(),
            tag: 'span',
            className: '',
            style: '',
            attributes: [],
            html: escapeText(text),
            richSafe: true,
          },
        },
      ];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    budget.count += 1;
    const {className, style} = classAndStyle(element);
    const blockId = id();

    if (OPAQUE_TAGS.has(tag)) {
      return [makeRaw(element, blockId, baseUrl, budget)];
    }

    if (tag === 'img') {
      return [
        {
          type: 'HtmlImage',
          props: {
            id: blockId,
            className,
            style,
            src: resolveUrl(element.getAttribute('src') ?? '', baseUrl),
            alt: element.getAttribute('alt') ?? '',
            attributes: readAttributes(element, baseUrl, ['src', 'alt']),
          },
        },
      ];
    }

    if ((tag === 'a' || tag === 'button') && !hasStructuralChild(element)) {
      return [
        {
          type: 'HtmlLink',
          props: {
            id: blockId,
            tag,
            className,
            style,
            href: tag === 'a' ? resolveUrl(element.getAttribute('href') ?? '', baseUrl) : '',
            target: element.getAttribute('target') ?? '',
            label: element.innerHTML,
            attributes: readAttributes(element, baseUrl, ['href', 'target']),
          },
        },
      ];
    }

    if (!hasStructuralChild(element)) {
      return [
        {
          type: 'HtmlText',
          props: {
            id: blockId,
            tag,
            className,
            style,
            attributes: readAttributes(element, baseUrl),
            html: element.innerHTML,
            richSafe: isRichSafe(element),
          },
        },
      ];
    }

    return [
      {
        type: 'HtmlElement',
        props: {
          id: blockId,
          tag,
          className,
          style,
          attributes: readAttributes(element, baseUrl),
          children: convertChildren(Array.from(element.childNodes)),
        },
      },
    ];
  };

  const content = convertChildren(Array.from(document.body.childNodes));
  const htmlAttributes = readAttributes(document.documentElement, baseUrl, [], true);
  const bodyAttributes = readAttributes(document.body, baseUrl, [], true);

  return {
    data: {
      root: {
        props: {
          headHtml: document.head.innerHTML.trim(),
          htmlAttributes,
          bodyAttributes,
          scripts,
        },
      },
      content,
    },
    settings,
    report: {
      blocks: budget.count,
      rawFallbacks: budget.rawFallbacks,
      scripts: scripts.length,
    },
  };
}
