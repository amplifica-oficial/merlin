import type {Data} from '@puckeditor/core';
import type {LandingAiComponentCatalog, LandingAiOutline, LandingAiOutlineNode} from '@merlin/types';

import {sanitizeJson} from './json';
import {getSlotNames, isBlock} from './operations';

export function buildOutline(data: Data, catalog: LandingAiComponentCatalog[]): LandingAiOutline {
  return {
    root: (sanitizeJson(data.root?.props ?? {}, {maxString: 200, maxArray: 4, depth: 3}) ?? {}) as Record<
      string,
      unknown
    >,
    content: (data.content ?? [])
      .map(item => toOutlineNode(item, catalog))
      .filter((node): node is LandingAiOutlineNode => node !== null),
  };
}

function toOutlineNode(item: unknown, catalog: LandingAiComponentCatalog[]): LandingAiOutlineNode | null {
  if (!isBlock(item)) {
    return null;
  }

  const slots = getSlotNames(item.type, catalog);
  const props: Record<string, unknown> = {};
  const slotMap: Record<string, LandingAiOutlineNode[]> = {};

  for (const [key, value] of Object.entries(item.props)) {
    if (key === 'id' || key === 'puck') {
      continue;
    }
    if (slots.includes(key) && Array.isArray(value)) {
      slotMap[key] = value
        .map(child => toOutlineNode(child, catalog))
        .filter((node): node is LandingAiOutlineNode => node !== null);
      continue;
    }
    props[key] = sanitizeJson(value, {maxString: 160, maxArray: 6, depth: 4});
  }

  const node: LandingAiOutlineNode = {
    id: item.props.id,
    type: item.type,
    props,
  };

  if (Object.keys(slotMap).length > 0) {
    node.slots = slotMap;
  }

  return node;
}
