import type {Data} from '@puckeditor/core';
import {useGetPuck} from '@puckeditor/core';
import type {LandingAiPickedElement} from '@merlin/types';
import {useEffect, useRef} from 'react';

import {serializeCatalog} from '../../../lib/puck/ai/catalog';
import {describeElement} from '../../../lib/puck/ai/inspector/describe-element';
import {
  cssEscapeIdent,
  elementsStackAtPoint,
  isElementNode,
  pickElementFromPoint,
  resolveSelector,
  walkTree,
} from '../../../lib/puck/ai/inspector/selector';
import {findBlock} from '../../../lib/puck/ai/operations';
import {puckConfig} from '../../../lib/puck/config';

import {useLandingAi} from './LandingAiProvider';

const INSPECTOR_STYLE = `
html[data-lp-inspecting] body * {
  pointer-events: auto !important;
  cursor: crosshair !important;
}
html[data-lp-inspecting] [data-lp-inspector],
html[data-lp-inspecting] [data-lp-inspector] *,
html[data-lp-inspecting] [data-puck-overlay],
html[data-lp-inspecting] [data-puck-overlay] * {
  pointer-events: none !important;
  cursor: default !important;
}
html[data-lp-inspecting] [data-puck-overlay] {
  opacity: 0 !important;
}
html[data-lp-inspecting] [data-puck-overlay-portal] {
  outline: none !important;
}
[data-lp-inspector] {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483646;
}
[data-lp-inspector] .lp-box {
  position: absolute;
  box-sizing: border-box;
}
[data-lp-inspector] .lp-margin { background: rgba(246, 178, 107, 0.35); }
[data-lp-inspector] .lp-padding { background: rgba(147, 196, 125, 0.35); }
[data-lp-inspector] .lp-content { background: rgba(111, 168, 220, 0.28); outline: 1px solid #4a90d9; }
[data-lp-inspector] .lp-picked {
  position: absolute;
  outline: 2px solid #7c3aed;
  outline-offset: 1px;
  box-sizing: border-box;
}
[data-lp-inspector] .lp-picked-badge {
  position: absolute;
  z-index: 1;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #7c3aed;
  color: #fff;
  font: 700 10px/16px ui-sans-serif, system-ui, sans-serif;
  text-align: center;
}
[data-lp-inspector] .lp-tooltip {
  position: absolute;
  transform: translateY(-100%);
  margin-top: -6px;
  background: #111;
  color: #fff;
  font: 11px/1.3 ui-sans-serif, system-ui, sans-serif;
  padding: 4px 6px;
  border-radius: 4px;
  white-space: nowrap;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;

const BLOCKED_EVENTS = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'mouseover',
  'mouseout',
  'pointerover',
  'pointerout',
  'focusin',
] as const;

function getPreviewFrame(): HTMLIFrameElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const frame = document.querySelector('#preview-frame');
  return frame instanceof HTMLIFrameElement ? frame : null;
}

function getPreviewDoc(): Document | null {
  return getPreviewFrame()?.contentDocument ?? null;
}

function readBox(element: Element) {
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument?.defaultView;
  const style = view?.getComputedStyle(element);
  const num = (value: string | undefined) => Number.parseFloat(value ?? '0') || 0;
  return {
    rect,
    margin: {
      top: num(style?.marginTop),
      right: num(style?.marginRight),
      bottom: num(style?.marginBottom),
      left: num(style?.marginLeft),
    },
    padding: {
      top: num(style?.paddingTop),
      right: num(style?.paddingRight),
      bottom: num(style?.paddingBottom),
      left: num(style?.paddingLeft),
    },
  };
}

function tooltipLabel(element: Element, extra?: string): string {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).slice(0, 4).join('.');
  const classPart = classes ? `.${classes}` : '';
  const {rect} = readBox(element);
  const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  return `${tag}${classPart}  ${size}${extra ? `  ·  ${extra}` : ''}`;
}

function ensureOverlay(doc: Document): {root: HTMLElement; hover: HTMLElement; picked: HTMLElement} {
  let style = doc.getElementById('lp-inspector-style');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'lp-inspector-style';
    style.textContent = INSPECTOR_STYLE;
    doc.head.append(style);
  }

  let root = doc.querySelector('[data-lp-inspector]') as HTMLElement | null;
  if (!root) {
    root = doc.createElement('div');
    root.setAttribute('data-lp-inspector', 'true');
    const hover = doc.createElement('div');
    hover.setAttribute('data-lp-inspector-hover', '');
    const picked = doc.createElement('div');
    picked.setAttribute('data-lp-inspector-picked', '');
    root.append(hover, picked);
    doc.body.append(root);
  }

  return {
    root,
    hover: root.querySelector('[data-lp-inspector-hover]') as HTMLElement,
    picked: root.querySelector('[data-lp-inspector-picked]') as HTMLElement,
  };
}

function renderHover(doc: Document, host: HTMLElement, element: Element | null, extra?: string) {
  host.replaceChildren();
  if (!element) {
    return;
  }
  const {rect, margin, padding} = readBox(element);

  const marginBox = doc.createElement('div');
  marginBox.className = 'lp-box lp-margin';
  marginBox.style.top = `${rect.top - margin.top}px`;
  marginBox.style.left = `${rect.left - margin.left}px`;
  marginBox.style.width = `${rect.width + margin.left + margin.right}px`;
  marginBox.style.height = `${rect.height + margin.top + margin.bottom}px`;

  const paddingBox = doc.createElement('div');
  paddingBox.className = 'lp-box lp-padding';
  paddingBox.style.top = `${rect.top}px`;
  paddingBox.style.left = `${rect.left}px`;
  paddingBox.style.width = `${rect.width}px`;
  paddingBox.style.height = `${rect.height}px`;

  const contentBox = doc.createElement('div');
  contentBox.className = 'lp-box lp-content';
  contentBox.style.top = `${rect.top + padding.top}px`;
  contentBox.style.left = `${rect.left + padding.left}px`;
  contentBox.style.width = `${Math.max(0, rect.width - padding.left - padding.right)}px`;
  contentBox.style.height = `${Math.max(0, rect.height - padding.top - padding.bottom)}px`;

  const tooltip = doc.createElement('div');
  tooltip.className = 'lp-tooltip';
  tooltip.style.top = `${Math.max(rect.top, 16)}px`;
  tooltip.style.left = `${rect.left}px`;
  tooltip.textContent = tooltipLabel(element, extra);

  host.append(marginBox, paddingBox, contentBox, tooltip);
}

function renderPicked(doc: Document, host: HTMLElement, items: Array<{element: Element; index: number}>) {
  host.replaceChildren();
  for (const item of items) {
    const rect = item.element.getBoundingClientRect();
    const box = doc.createElement('div');
    box.className = 'lp-picked';
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    const badge = doc.createElement('div');
    badge.className = 'lp-picked-badge';
    badge.style.top = `${rect.top}px`;
    badge.style.left = `${rect.left}px`;
    badge.textContent = String(item.index + 1);
    host.append(box, badge);
  }
}

function resolvePickedDom(doc: Document, picked: LandingAiPickedElement[]): Array<{element: Element; index: number}> {
  return picked.flatMap((item, index) => {
    const root = item.blockId ? doc.querySelector(`[data-lp-block="${cssEscapeIdent(item.blockId)}"]`) : doc.body;
    if (!root) {
      return [];
    }
    const node = resolveSelector(root, item.selector);
    return isElementNode(node) ? [{element: node, index}] : [];
  });
}

const inspectorCatalog = serializeCatalog(puckConfig);

export function ElementInspector() {
  const getPuck = useGetPuck();
  const catalog = inspectorCatalog;
  const {
    inspectorActive,
    setInspectorActive,
    toggleInspector,
    togglePickedElement,
    pickedElements,
    hoveredPickId,
  } = useLandingAi();
  const hoverRef = useRef<Element | null>(null);
  const stackRef = useRef<Element[]>([]);
  const stackIndexRef = useRef(0);
  const pickedRef = useRef(pickedElements);
  const hoveredPickRef = useRef(hoveredPickId);
  const dirtyRef = useRef(true);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        toggleInspector();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [toggleInspector]);

  useEffect(() => {
    pickedRef.current = pickedElements;
    hoveredPickRef.current = hoveredPickId;
    dirtyRef.current = true;
  }, [pickedElements, hoveredPickId]);

  useEffect(() => {
    if (!inspectorActive) {
      const doc = getPreviewDoc();
      doc?.documentElement.removeAttribute('data-lp-inspecting');
      doc?.querySelector('[data-lp-inspector]')?.remove();
      hoverRef.current = null;
      stackRef.current = [];
      stackIndexRef.current = 0;
      return;
    }

    let disposed = false;
    let overlay: ReturnType<typeof ensureOverlay> | null = null;
    let frameId = 0;

    const snapshot = (element: Element): LandingAiPickedElement => {
      const blockRoot = element.closest('[data-lp-block]');
      const blockId = blockRoot?.getAttribute('data-lp-block') ?? null;
      const found = blockId ? findBlock(getPuck().appState.data as Data, blockId, catalog) : null;
      const described = describeElement(element, {
        props: found?.block.props ?? null,
        id: `pick-${crypto.randomUUID()}`,
      });
      return {
        ...described,
        blockType: found?.block.type ?? null,
      };
    };

    const bind = (doc: Document) => {
      overlay = ensureOverlay(doc);
      doc.documentElement.setAttribute('data-lp-inspecting', 'true');
      dirtyRef.current = true;

      const redraw = () => {
        if (!overlay) {
          return;
        }
        const hover = hoverRef.current;
        const blockId = hover?.closest('[data-lp-block]')?.getAttribute('data-lp-block');
        const found = blockId ? findBlock(getPuck().appState.data as Data, blockId, catalog) : null;
        renderHover(doc, overlay.hover, hover, found?.block.type ?? undefined);
        const picked = pickedRef.current;
        const nodes = resolvePickedDom(doc, picked);
        const hovered = picked.find(item => item.id === hoveredPickRef.current);
        if (hovered) {
          const extra = resolvePickedDom(doc, [hovered])[0];
          if (extra && !nodes.some(node => node.element === extra.element)) {
            nodes.push(extra);
          }
        }
        renderPicked(doc, overlay.picked, nodes);
      };

      const markDirty = () => {
        dirtyRef.current = true;
      };

      const setHoverFromPoint = (x: number, y: number) => {
        const stack = elementsStackAtPoint(doc, x, y);
        stackRef.current = stack;
        stackIndexRef.current = 0;
        hoverRef.current = stack[0] ?? null;
        markDirty();
      };

      const onMove = (event: PointerEvent) => {
        setHoverFromPoint(event.clientX, event.clientY);
      };

      const blockEvent = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      };

      const onClick = (event: MouseEvent) => {
        blockEvent(event);
        const target = hoverRef.current ?? pickElementFromPoint(doc, event.clientX, event.clientY);
        if (!target) {
          return;
        }
        hoverRef.current = target;
        togglePickedElement(snapshot(target), {replace: event.shiftKey});
        markDirty();
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setInspectorActive(false);
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const current = hoverRef.current;
          if (!current) {
            return;
          }
          const next = walkTree(current, event.key === 'ArrowUp' ? 'up' : 'down');
          if (next) {
            hoverRef.current = next;
            markDirty();
          }
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          const stack = stackRef.current;
          if (stack.length === 0) {
            return;
          }
          const delta = event.key === 'ArrowRight' ? 1 : -1;
          const nextIndex = (stackIndexRef.current + delta + stack.length) % stack.length;
          stackIndexRef.current = nextIndex;
          hoverRef.current = stack[nextIndex] ?? null;
          markDirty();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
          event.preventDefault();
          toggleInspector();
        }
      };

      const loop = () => {
        if (disposed) {
          return;
        }
        if (dirtyRef.current) {
          dirtyRef.current = false;
          try {
            redraw();
          } catch {
            // Keep the loop alive if a frame throws (cross-realm DOM, detached nodes).
          }
        }
        frameId = doc.defaultView?.requestAnimationFrame(loop) ?? 0;
      };

      const onScrollOrResize = () => {
        markDirty();
      };

      doc.addEventListener('pointermove', onMove, true);
      for (const name of BLOCKED_EVENTS) {
        if (name === 'click') {
          continue;
        }
        doc.addEventListener(name, blockEvent, true);
      }
      doc.addEventListener('click', onClick, true);
      doc.addEventListener('keydown', onKey, true);
      doc.addEventListener('scroll', onScrollOrResize, true);
      doc.defaultView?.addEventListener('resize', onScrollOrResize);
      loop();

      return () => {
        doc.removeEventListener('pointermove', onMove, true);
        for (const name of BLOCKED_EVENTS) {
          if (name === 'click') {
            continue;
          }
          doc.removeEventListener(name, blockEvent, true);
        }
        doc.removeEventListener('click', onClick, true);
        doc.removeEventListener('keydown', onKey, true);
        doc.removeEventListener('scroll', onScrollOrResize, true);
        doc.defaultView?.removeEventListener('resize', onScrollOrResize);
        doc.defaultView?.cancelAnimationFrame(frameId);
        doc.documentElement.removeAttribute('data-lp-inspecting');
        overlay?.root.remove();
      };
    };

    const frame = getPreviewFrame();
    const doc = frame?.contentDocument ?? null;
    if (doc?.body) {
      return bind(doc);
    }

    const onLoad = () => {
      const next = getPreviewDoc();
      if (next?.body && !disposed) {
        cleanup = bind(next);
      }
    };
    frame?.addEventListener('load', onLoad);
    let cleanup: (() => void) | undefined;

    return () => {
      disposed = true;
      frame?.removeEventListener('load', onLoad);
      cleanup?.();
    };
  }, [catalog, getPuck, inspectorActive, setInspectorActive, toggleInspector, togglePickedElement]);

  return null;
}
