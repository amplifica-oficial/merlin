import type {PuckData} from '@merlin/types';

import {asAttributeList, stringProp, wrapTag} from './markup';

interface HtmlBlock {
  type: string;
  props: Record<string, unknown>;
  [key: string]: unknown;
}

function isBlock(value: unknown): value is HtmlBlock {
  return Boolean(value && typeof value === 'object' && 'type' in value && 'props' in value);
}

function childBlocks(props: Record<string, unknown>): HtmlBlock[] {
  const value = props.children;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isBlock);
}

function blockOptions(props: Record<string, unknown>) {
  return {
    className: stringProp(props, 'className'),
    style: stringProp(props, 'style'),
    attributes: asAttributeList(props.attributes),
  };
}

function serializeBlock(block: HtmlBlock): string {
  const props = block.props ?? {};
  const tag = stringProp(props, 'tag') || 'div';
  const options = blockOptions(props);

  switch (block.type) {
    case 'HtmlElement':
      return wrapTag(tag, childBlocks(props).map(serializeBlock).join(''), options);
    case 'HtmlText':
    case 'HtmlRaw':
      return wrapTag(tag, stringProp(props, 'html'), options);
    case 'HtmlLink': {
      const linkTag = tag === 'button' ? 'button' : 'a';
      const attributes = [
        ...(linkTag === 'a' && stringProp(props, 'href') ? [{name: 'href', value: stringProp(props, 'href')}] : []),
        ...(stringProp(props, 'target') ? [{name: 'target', value: stringProp(props, 'target')}] : []),
        ...asAttributeList(props.attributes),
      ];
      return wrapTag(linkTag, stringProp(props, 'label'), {...options, attributes});
    }
    case 'HtmlImage': {
      const attributes = [
        {name: 'src', value: stringProp(props, 'src')},
        {name: 'alt', value: stringProp(props, 'alt')},
        ...asAttributeList(props.attributes),
      ];
      return wrapTag('img', '', {...options, attributes});
    }
    default:
      return '';
  }
}

export function serializeHtmlContent(data: Pick<PuckData, 'content'>): string {
  if (!Array.isArray(data.content)) {
    return '';
  }
  return data.content.filter(isBlock).map(serializeBlock).join('');
}
