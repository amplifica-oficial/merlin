import type {HtmlAttribute} from '@merlin/types';
import {registerOverlayPortal, useGetPuck, type Fields, type Slot, type SlotComponent} from '@puckeditor/core';
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

import {puckImageUrlField} from '../../../components/puck/shared/puckImageUrlField';

import {eventAttributes, joinClass, parseStyle, reactAttributes, safeTag} from './markup';

export interface HtmlElementProps {
  tag: string;
  className: string;
  style: string;
  attributes: HtmlAttribute[];
  children: Slot;
}

export interface HtmlTextProps {
  tag: string;
  className: string;
  style: string;
  attributes: HtmlAttribute[];
  html: string;
  richSafe: boolean;
}

export interface HtmlLinkProps {
  tag: 'a' | 'button';
  className: string;
  style: string;
  attributes: HtmlAttribute[];
  href: string;
  target: string;
  label: string;
}

export interface HtmlImageProps {
  className: string;
  style: string;
  attributes: HtmlAttribute[];
  src: string;
  alt: string;
}

export interface HtmlRawProps {
  tag: string;
  className: string;
  style: string;
  attributes: HtmlAttribute[];
  html: string;
}

interface PuckRenderProps {
  id?: string;
  puck?: {isEditing?: boolean};
}

const attributeFields = {
  type: 'array' as const,
  label: 'Attributes',
  arrayFields: {
    name: {type: 'text' as const, label: 'Name'},
    value: {type: 'text' as const, label: 'Value'},
  },
  defaultItemProps: {name: '', value: ''},
  getItemSummary: (item: HtmlAttribute) => item.name || 'Attribute',
};

const presentationFields = {
  tag: {type: 'text' as const, label: 'Tag'},
  className: {type: 'text' as const, label: 'Class'},
  style: {type: 'textarea' as const, label: 'Style'},
  attributes: attributeFields,
};

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

function createTagComponent(tag: string, className: string, styleText: string, attributes: HtmlAttribute[]) {
  const Tag = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function HtmlTag(props, ref) {
    const {className: extraClass, style: extraStyle, children, ...rest} = props;
    const setRef = useCallback(
      (node: HTMLElement | null) => {
        assignRef(ref, node);
        if (!node) {
          return;
        }
        for (const attribute of eventAttributes(attributes)) {
          node.setAttribute(attribute.name, attribute.value);
        }
      },
      [ref],
    );
    return createElement(
      safeTag(tag),
      // Arbitrary tags cannot be static components, and Puck requires the DOM node.
      // eslint-disable-next-line react-hooks/refs -- ref is only attached, not read, during render
      {
        ...rest,
        ...reactAttributes(attributes),
        ref: setRef,
        className: joinClass(className, extraClass),
        style: {...parseStyle(styleText), ...(extraStyle as CSSProperties | undefined)},
      },
      children,
    );
  });
  Tag.displayName = 'HtmlTag';
  return Tag;
}

function domProps(tag: string, className: string, styleText: string, attributes: HtmlAttribute[]) {
  return {
    tag: safeTag(tag),
    className: joinClass(className),
    style: parseStyle(styleText),
    ...reactAttributes(attributes),
  };
}

function HtmlElementView({
  tag,
  className,
  style,
  attributes,
  children: Content,
}: Omit<HtmlElementProps, 'children'> & {children: SlotComponent}) {
  const As = useMemo(
    () => createTagComponent(tag, className, style, attributes ?? []),
    [tag, className, style, attributes],
  );
  return <Content as={As} minEmptyHeight={32} />;
}

function InlineHtmlEditor({
  id,
  tag,
  html,
  className,
  style,
  attributes,
}: {
  id: string;
  tag: string;
  html: string;
  className?: string;
  style?: CSSProperties;
  attributes: HtmlAttribute[];
}) {
  const ref = useRef<HTMLElement>(null);
  const getPuck = useGetPuck();

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (element.innerHTML !== html) {
      element.innerHTML = html;
    }
    return registerOverlayPortal(element, {disableDragOnFocus: true});
  }, [html]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    for (const attribute of eventAttributes(attributes)) {
      element.setAttribute(attribute.name, attribute.value);
    }
  }, [attributes]);

  // Arbitrary tags cannot be static components, and Puck requires the DOM node.
  // eslint-disable-next-line react-hooks/refs -- ref is only attached, not read, during render
  return createElement(safeTag(tag), {
    ...reactAttributes(attributes),
    ref,
    className,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: () => {
      const next = ref.current?.innerHTML ?? '';
      if (next === html) {
        return;
      }
      const api = getPuck();
      const item = api.getItemById(id);
      const selector = api.getSelectorForId(id);
      if (!item || !selector) {
        return;
      }
      api.dispatch({
        type: 'replace',
        destinationIndex: selector.index,
        destinationZone: selector.zone,
        data: {...item, props: {...item.props, html: next}},
      });
    },
  });
}

function HtmlTextView({tag, className, style, attributes, html, richSafe, id, puck}: HtmlTextProps & PuckRenderProps) {
  const props = domProps(tag, className, style, attributes ?? []);
  if (puck?.isEditing && richSafe && id) {
    return (
      <InlineHtmlEditor
        id={id}
        tag={props.tag}
        html={html ?? ''}
        className={props.className}
        style={props.style}
        attributes={attributes ?? []}
      />
    );
  }
  const {tag: safe, ...dom} = props;
  return createElement(safe, {...dom, dangerouslySetInnerHTML: {__html: html ?? ''}});
}

function HtmlLinkView({tag, className, style, attributes, href, target, label}: HtmlLinkProps) {
  const linkTag = tag === 'button' ? 'button' : 'a';
  const props = domProps(linkTag, className, style, attributes ?? []);
  const {tag: safe, ...dom} = props;
  return createElement(safe, {
    ...dom,
    ...(linkTag === 'a' && href ? {href} : {}),
    ...(target ? {target} : {}),
    dangerouslySetInnerHTML: {__html: label ?? ''},
  });
}

function HtmlImageView({className, style, attributes, src, alt}: HtmlImageProps) {
  const props = domProps('img', className, style, attributes ?? []);
  const {tag, ...dom} = props;
  return createElement(tag, {...dom, src, alt});
}

function HtmlRawView({tag, className, style, attributes, html}: HtmlRawProps) {
  const props = domProps(tag, className, style, attributes ?? []);
  const {tag: safe, ...dom} = props;
  return createElement(safe, {...dom, dangerouslySetInnerHTML: {__html: html ?? ''}});
}

export const htmlElementFields: Fields<HtmlElementProps> = {
  ...presentationFields,
  children: {type: 'slot'},
};

export const htmlTextFields: Fields<HtmlTextProps> = {
  ...presentationFields,
  html: {type: 'textarea', label: 'HTML'},
  richSafe: {
    type: 'radio',
    label: 'Rich text',
    visible: false,
    options: [
      {label: 'Yes', value: true},
      {label: 'No', value: false},
    ],
  },
};

export const htmlLinkFields: Fields<HtmlLinkProps> = {
  tag: {
    type: 'select',
    label: 'Tag',
    options: [
      {label: 'Link', value: 'a'},
      {label: 'Button', value: 'button'},
    ],
  },
  className: presentationFields.className,
  style: presentationFields.style,
  href: {type: 'text', label: 'URL'},
  target: {type: 'text', label: 'Target'},
  label: {type: 'textarea', label: 'Label'},
  attributes: attributeFields,
};

export const htmlImageFields: Fields<HtmlImageProps> = {
  src: puckImageUrlField('Image URL'),
  alt: {type: 'text', label: 'Alt text'},
  className: presentationFields.className,
  style: presentationFields.style,
  attributes: attributeFields,
};

export const htmlRawFields: Fields<HtmlRawProps> = {
  ...presentationFields,
  html: {type: 'textarea', label: 'HTML'},
};

export function HtmlElementRender(props: Omit<HtmlElementProps, 'children'> & {children: SlotComponent}) {
  return <HtmlElementView {...props} />;
}

export function HtmlTextRender(props: HtmlTextProps & PuckRenderProps) {
  return <HtmlTextView {...props} />;
}

export function HtmlLinkRender(props: HtmlLinkProps) {
  return <HtmlLinkView {...props} />;
}

export function HtmlImageRender(props: HtmlImageProps) {
  return <HtmlImageView {...props} />;
}

export function HtmlRawRender(props: HtmlRawProps) {
  return <HtmlRawView {...props} />;
}

export function HtmlRootRender(props: {children?: ReactNode; [key: string]: unknown}) {
  return <>{props.children}</>;
}
