import type {HtmlPageRootProps} from '@merlin/types';
import {useLayoutEffect, type ReactNode} from 'react';

import {isSafeAttrName} from './markup';

const appliedAttributes = new WeakMap<Document, {html: string[]; body: string[]}>();

function applyAttributes(element: Element, attributes: HtmlPageRootProps['htmlAttributes'], previous: string[]) {
  const nextNames: string[] = [];
  const next = new Set(attributes.map(attribute => attribute.name));
  for (const name of previous) {
    if (!next.has(name)) {
      element.removeAttribute(name);
    }
  }
  for (const attribute of attributes) {
    if (!isSafeAttrName(attribute.name)) {
      continue;
    }
    element.setAttribute(attribute.name, attribute.value);
    nextNames.push(attribute.name);
  }
  return nextNames;
}

export function applyRootToFrame(iframeDocument: Document, root: HtmlPageRootProps) {
  const previous = appliedAttributes.get(iframeDocument) ?? {html: [], body: []};
  appliedAttributes.set(iframeDocument, {
    html: applyAttributes(iframeDocument.documentElement, root.htmlAttributes, previous.html),
    body: applyAttributes(iframeDocument.body, root.bodyAttributes, previous.body),
  });

  iframeDocument.querySelectorAll('[data-merlin-head]').forEach(node => node.remove());
  const template = iframeDocument.createElement('template');
  template.innerHTML = root.headHtml;
  for (const node of Array.from(template.content.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      (node as Element).setAttribute('data-merlin-head', 'true');
    }
    iframeDocument.head.appendChild(node);
  }

  iframeDocument.querySelectorAll('script[data-merlin-script]').forEach(node => node.remove());
  for (const script of root.scripts) {
    if (!script.runInEditor || !script.src) {
      continue;
    }
    const element = iframeDocument.createElement('script');
    element.src = script.src;
    element.setAttribute('data-merlin-script', 'true');
    for (const attribute of script.attributes) {
      if (isSafeAttrName(attribute.name) && attribute.name !== 'src') {
        element.setAttribute(attribute.name, attribute.value);
      }
    }
    iframeDocument.head.appendChild(element);
  }
}

export function HtmlEditorFrame({
  children,
  document: iframeDocument,
  root,
}: {
  children: ReactNode;
  document?: Document;
  root: HtmlPageRootProps;
}) {
  const rootKey = JSON.stringify(root);
  useLayoutEffect(() => {
    if (!iframeDocument) {
      return;
    }
    applyRootToFrame(iframeDocument, root);
  }, [iframeDocument, root, rootKey]);

  return <>{children}</>;
}
