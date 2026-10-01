export const INSPECTOR_SKIP_SELECTORS = ['[data-puck-overlay]', '[data-lp-inspector]'];

/** Iframe nodes fail `instanceof Element` from the parent window. */
export function isElementNode(value: unknown): value is Element {
  return Boolean(value) && typeof value === 'object' && (value as Node).nodeType === 1;
}

export function cssEscapeIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char.codePointAt(0)?.toString(16)} `);
}

export function findBlockRoot(element: Element | null): Element | null {
  return element?.closest('[data-lp-block]') ?? null;
}

export function shouldSkipInspectTarget(element: Element): boolean {
  return INSPECTOR_SKIP_SELECTORS.some(selector => element.closest(selector));
}

function isBlockWrapper(element: Element): boolean {
  return element.hasAttribute('data-lp-block');
}

function isDisplayContents(element: Element): boolean {
  if (isBlockWrapper(element)) {
    return true;
  }
  const view = element.ownerDocument?.defaultView;
  if (!view) {
    return false;
  }
  return view.getComputedStyle(element).display === 'contents';
}

function isEditorOnlyPortal(element: Element): boolean {
  return element.hasAttribute('data-puck-overlay-portal');
}

function firstRealChild(element: Element): Element | null {
  for (const child of Array.from(element.children)) {
    if (!isElementNode(child)) {
      continue;
    }
    if (child.tagName === 'STYLE' || shouldSkipInspectTarget(child)) {
      continue;
    }
    if (isEditorOnlyPortal(child)) {
      const next = firstRealChild(child) ?? child.nextElementSibling;
      if (next && !isEditorOnlyPortal(next)) {
        return next;
      }
      continue;
    }
    return child;
  }
  return null;
}

export function normalizeInspectTarget(element: Element | null): Element | null {
  if (!element) {
    return null;
  }

  let current = element;
  const portal = current.closest('[data-puck-overlay-portal]');
  if (isElementNode(portal) && portal.parentElement) {
    current = portal.parentElement;
  }

  while (current && (isBlockWrapper(current) || isDisplayContents(current))) {
    const child = firstRealChild(current);
    if (!child || child === current) {
      break;
    }
    current = child;
  }

  if (current === current.ownerDocument?.documentElement || current === current.ownerDocument?.body) {
    return null;
  }

  return current;
}

function isInspectableHit(node: Element, doc: Document): boolean {
  if (shouldSkipInspectTarget(node)) {
    return false;
  }
  if (node === doc.documentElement || node === doc.body) {
    return false;
  }
  return true;
}

export function elementsStackAtPoint(doc: Document, x: number, y: number): Element[] {
  const hits = doc.elementsFromPoint(x, y);
  const seen = new Set<Element>();
  const stack: Element[] = [];

  for (const node of hits) {
    if (!isElementNode(node) || !isInspectableHit(node, doc)) {
      continue;
    }
    const normalized = normalizeInspectTarget(node);
    if (!normalized || seen.has(normalized) || shouldSkipInspectTarget(normalized)) {
      continue;
    }
    seen.add(normalized);
    stack.push(normalized);
  }

  return stack;
}

export function pickElementFromPoint(doc: Document, x: number, y: number): Element | null {
  return elementsStackAtPoint(doc, x, y)[0] ?? null;
}

export function buildRelativeSelector(element: Element, root: Element | null): string {
  const target = normalizeInspectTarget(element) ?? element;
  if (root && target === root) {
    return ':scope';
  }

  const parts: string[] = [];
  let current: Element | null = target;
  const stopAt = root;

  while (current && current !== stopAt) {
    if (isEditorOnlyPortal(current) || isBlockWrapper(current) || isDisplayContents(current)) {
      current = current.parentElement;
      continue;
    }

    const parent: Element | null = current.parentElement;
    if (!parent) {
      break;
    }
    const tag = current.tagName.toLowerCase();
    const currentTag = current.tagName;
    const siblings = Array.from(parent.children).filter(
      (child): child is Element => isElementNode(child) && child.tagName === currentTag && !isEditorOnlyPortal(child),
    );
    const nth = siblings.indexOf(current) + 1;
    parts.unshift(`> ${cssEscapeIdent(tag)}:nth-of-type(${nth})`);
    current = parent;
    if (stopAt && current === stopAt) {
      break;
    }
    if (!stopAt && current.tagName.toLowerCase() === 'body') {
      break;
    }
  }

  return parts.join(' ');
}

function skipWalkNode(element: Element): boolean {
  return (
    isEditorOnlyPortal(element) ||
    isBlockWrapper(element) ||
    isDisplayContents(element) ||
    element.tagName === 'STYLE' ||
    shouldSkipInspectTarget(element)
  );
}

export function walkTree(element: Element, direction: 'up' | 'down', root?: Element | null): Element | null {
  if (direction === 'up') {
    let parent: Element | null = element.parentElement;
    while (parent) {
      if (parent === element.ownerDocument?.documentElement || parent === element.ownerDocument?.body) {
        return null;
      }
      if (root && !root.contains(parent) && parent !== root) {
        return null;
      }
      if (!skipWalkNode(parent)) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  const visit = (node: Element): Element | null => {
    for (const child of Array.from(node.children)) {
      if (!isElementNode(child) || shouldSkipInspectTarget(child) || child.tagName === 'STYLE') {
        continue;
      }
      if (isEditorOnlyPortal(child) || isDisplayContents(child) || isBlockWrapper(child)) {
        const nested = visit(child);
        if (nested) {
          return nested;
        }
        continue;
      }
      return child;
    }
    return null;
  };

  return visit(element);
}

export function resolveSelector(root: Element | Document, selector: string): Element | null {
  if (!selector || selector === ':scope') {
    if (root.nodeType === 9) {
      return (root as Document).documentElement;
    }
    return root as Element;
  }
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}
