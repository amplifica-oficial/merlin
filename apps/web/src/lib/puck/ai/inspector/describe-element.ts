import type {LandingAiPickedElement} from '@merlin/types';

import {buildRelativeSelector, findBlockRoot, isElementNode, normalizeInspectTarget} from './selector';
import {findPropMatches} from './prop-match';

const STYLE_KEYS = [
  'color',
  'backgroundColor',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'padding',
  'margin',
  'borderRadius',
  'display',
  'gap',
  'width',
  'height',
] as const;

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export function readComputedStyles(element: Element): Record<string, string> {
  const view = element.ownerDocument?.defaultView;
  if (!view) {
    return {};
  }
  const computed = view.getComputedStyle(element);
  const styles: Record<string, string> = {};
  for (const key of STYLE_KEYS) {
    styles[key] = computed.getPropertyValue(
      key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`),
    );
  }
  return styles;
}

function unionChildRect(element: Element): {width: number; height: number} {
  const own = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
  if (own && own.width > 0 && own.height > 0) {
    return {width: Math.round(own.width), height: Math.round(own.height)};
  }

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const child of Array.from(element.children)) {
    if (!isElementNode(child) || child.tagName === 'STYLE') {
      continue;
    }
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    found = true;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (!found) {
    return {width: Math.round(own?.width ?? 0), height: Math.round(own?.height ?? 0)};
  }

  return {width: Math.round(right - left), height: Math.round(bottom - top)};
}

export function describeElement(
  element: Element,
  options?: {props?: Record<string, unknown> | null; id?: string},
): LandingAiPickedElement {
  const target = normalizeInspectTarget(element) ?? element;
  const blockRoot = findBlockRoot(target);
  const blockId = blockRoot?.getAttribute('data-lp-block') || null;
  const tag = target.tagName.toLowerCase();
  const text = clip(target.textContent ?? '', 120);
  const src = target.tagName === 'IMG' ? target.getAttribute('src') : null;
  const href = target.tagName === 'A' ? target.getAttribute('href') : null;
  const needles = [text, src ?? '', href ?? ''];
  const props = options?.props ?? {};

  return {
    id: options?.id ?? `pick-${Math.random().toString(36).slice(2, 10)}`,
    blockId,
    blockType: null,
    selector: buildRelativeSelector(target, blockRoot),
    tag,
    classes: Array.from(target.classList).slice(0, 20),
    text,
    outerHtml: clip(target.outerHTML ?? '', 1_500),
    rect: unionChildRect(target),
    styles: readComputedStyles(target),
    propMatches: findPropMatches(props, needles),
  };
}
