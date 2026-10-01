import type {Data} from '@puckeditor/core';
import type {LandingAiComponentCatalog} from '@merlin/types';

import {upsertCssRule} from './css-rules';
import {isPlainObject} from './json';

export type PuckBlock = {
  type: string;
  props: Record<string, unknown> & {id: string};
};

export type BlockLocation = {
  parentId: string | null;
  slot: string | null;
  index: number;
};

export class LandingAiOperationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'LandingAiOperationError';
  }
}

export function isBlock(value: unknown): value is PuckBlock {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.type === 'string' && isPlainObject(value.props) && typeof value.props.id === 'string';
}

export function getSlotNames(type: string, catalog: LandingAiComponentCatalog[]): string[] {
  return catalog.find(component => component.type === type)?.slots ?? [];
}

const FORBIDDEN_PROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafePropKey(key: string): void {
  if (FORBIDDEN_PROP_KEYS.has(key)) {
    throw new LandingAiOperationError(`Forbidden prop key: ${key}`);
  }
}

export function deepMerge(target: unknown, source: unknown): unknown {
  if (Array.isArray(source)) {
    return source;
  }
  if (isPlainObject(source) && isPlainObject(target)) {
    const output: Record<string, unknown> = {...target};
    for (const [key, value] of Object.entries(source)) {
      assertSafePropKey(key);
      output[key] = key in target ? deepMerge(target[key], value) : value;
    }
    return output;
  }
  return source;
}

export function generateBlockId(type: string): string {
  return `${type}-${crypto.randomUUID()}`;
}

export function findBlock(
  data: Data,
  id: string,
  catalog: LandingAiComponentCatalog[],
): {block: PuckBlock; location: BlockLocation} | null {
  const walk = (
    items: unknown[],
    parentId: string | null,
    slot: string | null,
  ): {block: PuckBlock; location: BlockLocation} | null => {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!isBlock(item)) {
        continue;
      }
      if (item.props.id === id) {
        return {block: item, location: {parentId, slot, index}};
      }
      for (const slotName of getSlotNames(item.type, catalog)) {
        const children = item.props[slotName];
        if (Array.isArray(children)) {
          const found = walk(children, item.props.id, slotName);
          if (found) {
            return found;
          }
        }
      }
    }
    return null;
  };

  return walk(data.content ?? [], null, null);
}

function allowedPropKeys(type: string, catalog: LandingAiComponentCatalog[]): Set<string> | null {
  const schema = catalog.find(component => component.type === type);
  if (!schema) {
    return null;
  }
  return new Set(['id', 'customCss', ...Object.keys(schema.fields), ...schema.slots]);
}

function pickAllowedProps(
  type: string,
  props: Record<string, unknown>,
  catalog: LandingAiComponentCatalog[],
): Record<string, unknown> {
  const allowed = allowedPropKeys(type, catalog);
  if (!allowed) {
    return {...props};
  }
  return Object.fromEntries(Object.entries(props).filter(([key]) => allowed.has(key)));
}

function assertKnownType(type: string, catalog: LandingAiComponentCatalog[]): LandingAiComponentCatalog {
  const schema = catalog.find(component => component.type === type);
  if (!schema) {
    throw new LandingAiOperationError(`Unknown component type: ${type}`);
  }
  return schema;
}

function rawBlockProps(raw: unknown): {type: string; props: Record<string, unknown>} {
  if (!isPlainObject(raw) || typeof raw.type !== 'string') {
    throw new LandingAiOperationError('Invalid block: missing type');
  }
  if (isPlainObject(raw.props)) {
    return {type: raw.type, props: raw.props};
  }
  const rest = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'type'));
  return {type: raw.type, props: rest};
}

export function normalizeBlock(
  raw: unknown,
  catalog: LandingAiComponentCatalog[],
  regenerateId = true,
): PuckBlock {
  const {type, props} = rawBlockProps(raw);
  const schema = assertKnownType(type, catalog);
  const merged = deepMerge(schema.defaultProps ?? {}, props) as Record<string, unknown>;
  const picked = pickAllowedProps(type, merged, catalog);
  const id =
    regenerateId || typeof picked.id !== 'string' || picked.id.length === 0
      ? generateBlockId(type)
      : picked.id;

  for (const slot of schema.slots) {
    const children = Array.isArray(picked[slot]) ? (picked[slot] as unknown[]) : [];
    picked[slot] = children
      .filter(child => isPlainObject(child))
      .map(child => normalizeBlock(child, catalog, regenerateId));
  }

  picked.id = id;
  return {type, props: picked as PuckBlock['props']};
}

function cloneBlockWithNewIds(block: PuckBlock, catalog: LandingAiComponentCatalog[]): PuckBlock {
  const nextProps: Record<string, unknown> = {...block.props, id: generateBlockId(block.type)};
  for (const slot of getSlotNames(block.type, catalog)) {
    const children = Array.isArray(nextProps[slot]) ? (nextProps[slot] as unknown[]) : [];
    nextProps[slot] = children.filter(isBlock).map(child => cloneBlockWithNewIds(child, catalog));
  }
  return {type: block.type, props: nextProps as PuckBlock['props']};
}

function updateSlot(
  items: PuckBlock[],
  parentId: string | null,
  slot: string | null,
  catalog: LandingAiComponentCatalog[],
  update: (list: PuckBlock[]) => PuckBlock[],
): PuckBlock[] {
  if (parentId === null) {
    return update(items);
  }

  return items.map(block => {
    if (block.props.id === parentId && slot) {
      const current = Array.isArray(block.props[slot]) ? (block.props[slot] as PuckBlock[]) : [];
      return {type: block.type, props: {...block.props, [slot]: update(current)}};
    }

    let changed = false;
    const nextProps = {...block.props};
    for (const slotName of getSlotNames(block.type, catalog)) {
      if (!Array.isArray(nextProps[slotName])) {
        continue;
      }
      const next = updateSlot(nextProps[slotName] as PuckBlock[], parentId, slot, catalog, update);
      if (next !== nextProps[slotName]) {
        nextProps[slotName] = next;
        changed = true;
      }
    }
    return changed ? {type: block.type, props: nextProps} : block;
  });
}

function replaceBlock(
  items: PuckBlock[],
  id: string,
  catalog: LandingAiComponentCatalog[],
  replacer: (block: PuckBlock) => PuckBlock,
): PuckBlock[] {
  return items.map(block => {
    if (block.props.id === id) {
      return replacer(block);
    }
    let changed = false;
    const nextProps = {...block.props};
    for (const slotName of getSlotNames(block.type, catalog)) {
      if (!Array.isArray(nextProps[slotName])) {
        continue;
      }
      const next = replaceBlock(nextProps[slotName] as PuckBlock[], id, catalog, replacer);
      if (next !== nextProps[slotName]) {
        nextProps[slotName] = next;
        changed = true;
      }
    }
    return changed ? {type: block.type, props: nextProps} : block;
  });
}

function asContent(data: Data): PuckBlock[] {
  return (data.content ?? []).filter(isBlock);
}

function withContent(data: Data, content: PuckBlock[]): Data {
  return {...data, content};
}

export function updateBlock(
  data: Data,
  id: string,
  props: Record<string, unknown>,
  catalog: LandingAiComponentCatalog[],
): Data {
  const found = findBlock(data, id, catalog);
  if (!found) {
    throw new LandingAiOperationError(`Block not found: ${id}`);
  }

  const merged = deepMerge(found.block.props, props) as Record<string, unknown>;
  const picked = pickAllowedProps(found.block.type, merged, catalog);
  picked.id = found.block.props.id;

  for (const slot of getSlotNames(found.block.type, catalog)) {
    if (!Array.isArray(picked[slot])) {
      continue;
    }
    picked[slot] = (picked[slot] as unknown[]).map(child =>
      isBlock(child) && typeof child.props.id === 'string'
        ? normalizeBlock(child, catalog, false)
        : normalizeBlock(child, catalog, true),
    );
  }

  return withContent(
    data,
    replaceBlock(asContent(data), id, catalog, block => ({
      type: block.type,
      props: picked as PuckBlock['props'],
    })),
  );
}

export function insertBlock(
  data: Data,
  input: {
    type: string;
    props?: Record<string, unknown>;
    parentId?: string;
    slot?: string;
    index?: number;
  },
  catalog: LandingAiComponentCatalog[],
): {data: Data; id: string} {
  const block = normalizeBlock({type: input.type, props: input.props ?? {}}, catalog, true);
  const parentId = input.parentId ?? null;
  let slot = input.slot ?? null;

  if (parentId) {
    const parent = findBlock(data, parentId, catalog);
    if (!parent) {
      throw new LandingAiOperationError(`Parent block not found: ${parentId}`);
    }
    const slots = getSlotNames(parent.block.type, catalog);
    if (slots.length === 0) {
      throw new LandingAiOperationError(`Parent ${parent.block.type} has no slots`);
    }
    slot = slot && slots.includes(slot) ? slot : slots[0] ?? null;
    if (!slot) {
      throw new LandingAiOperationError(`Parent ${parent.block.type} has no slots`);
    }
    const allowed = catalog.find(component => component.type === parent.block.type)?.fields[slot]?.allow;
    if (allowed && allowed.length > 0 && !allowed.includes(input.type)) {
      throw new LandingAiOperationError(`${input.type} is not allowed in ${parent.block.type}.${slot}`);
    }
  } else {
    slot = null;
  }

  const next = updateSlot(asContent(data), parentId, slot, catalog, list => {
    const index = input.index === undefined ? list.length : Math.min(Math.max(input.index, 0), list.length);
    const copy = [...list];
    copy.splice(index, 0, block);
    return copy;
  });

  return {data: withContent(data, next), id: block.props.id};
}

export function removeBlock(data: Data, id: string, catalog: LandingAiComponentCatalog[]): Data {
  const found = findBlock(data, id, catalog);
  if (!found) {
    throw new LandingAiOperationError(`Block not found: ${id}`);
  }

  return withContent(
    data,
    updateSlot(asContent(data), found.location.parentId, found.location.slot, catalog, list =>
      list.filter(block => block.props.id !== id),
    ),
  );
}

export function duplicateBlock(data: Data, id: string, catalog: LandingAiComponentCatalog[]): {data: Data; id: string} {
  const found = findBlock(data, id, catalog);
  if (!found) {
    throw new LandingAiOperationError(`Block not found: ${id}`);
  }

  const clone = cloneBlockWithNewIds(found.block, catalog);
  const next = updateSlot(asContent(data), found.location.parentId, found.location.slot, catalog, list => {
    const copy = [...list];
    copy.splice(found.location.index + 1, 0, clone);
    return copy;
  });

  return {data: withContent(data, next), id: clone.props.id};
}

export function moveBlock(
  data: Data,
  input: {id: string; parentId?: string; slot?: string; index?: number},
  catalog: LandingAiComponentCatalog[],
): Data {
  const found = findBlock(data, input.id, catalog);
  if (!found) {
    throw new LandingAiOperationError(`Block not found: ${input.id}`);
  }

  const destinationParentId = input.parentId ?? null;
  let destinationSlot = input.slot ?? null;

  if (destinationParentId) {
    const parent = findBlock(data, destinationParentId, catalog);
    if (!parent) {
      throw new LandingAiOperationError(`Parent block not found: ${destinationParentId}`);
    }
    if (destinationParentId === input.id) {
      throw new LandingAiOperationError('Cannot move a block into itself');
    }
    const slots = getSlotNames(parent.block.type, catalog);
    if (slots.length === 0) {
      throw new LandingAiOperationError(`Parent ${parent.block.type} has no slots`);
    }
    destinationSlot = destinationSlot && slots.includes(destinationSlot) ? destinationSlot : slots[0] ?? null;
  } else {
    destinationSlot = null;
  }

  const sameList =
    found.location.parentId === destinationParentId && found.location.slot === destinationSlot;

  if (sameList) {
    const next = updateSlot(asContent(data), destinationParentId, destinationSlot, catalog, list => {
      const copy = [...list];
      const [item] = copy.splice(found.location.index, 1);
      if (!item) {
        return list;
      }
      const rawIndex = input.index === undefined ? copy.length : input.index;
      const dest = Math.min(Math.max(rawIndex, 0), copy.length);
      copy.splice(dest, 0, item);
      return copy;
    });
    return withContent(data, next);
  }

  const removed = updateSlot(asContent(data), found.location.parentId, found.location.slot, catalog, list =>
    list.filter(block => block.props.id !== input.id),
  );
  const inserted = updateSlot(removed, destinationParentId, destinationSlot, catalog, list => {
    const index = input.index === undefined ? list.length : Math.min(Math.max(input.index, 0), list.length);
    const copy = [...list];
    copy.splice(index, 0, found.block);
    return copy;
  });

  return withContent(data, inserted);
}

export function setPathValue(root: unknown, path: string, value: unknown): unknown {
  const parts = path
    .split('.')
    .map(part => part.trim())
    .filter(part => part.length > 0);
  if (parts.length === 0) {
    throw new LandingAiOperationError('Invalid prop path');
  }
  return setAtParts(root, parts, value);
}

function setAtParts(current: unknown, parts: string[], value: unknown): unknown {
  const [head, ...rest] = parts;
  if (head === undefined) {
    return value;
  }

  const index = /^\d+$/.test(head) ? Number(head) : null;
  if (index === null) {
    assertSafePropKey(head);
  }
  if (index !== null) {
    const list = Array.isArray(current) ? [...current] : [];
    while (list.length <= index) {
      list.push(undefined);
    }
    list[index] = rest.length === 0 ? value : setAtParts(list[index], rest, value);
    return list;
  }

  const object = isPlainObject(current) ? {...current} : {};
  object[head] = rest.length === 0 ? value : setAtParts(object[head], rest, value);
  return object;
}

export function updateBlockProp(
  data: Data,
  id: string,
  path: string,
  value: unknown,
  catalog: LandingAiComponentCatalog[],
): Data {
  const found = findBlock(data, id, catalog);
  if (!found) {
    throw new LandingAiOperationError(`Block not found: ${id}`);
  }
  if (path === 'id' || path.startsWith('id.')) {
    throw new LandingAiOperationError('Cannot change block id');
  }

  const nextProps = setPathValue({...found.block.props}, path, value);
  if (!isPlainObject(nextProps)) {
    throw new LandingAiOperationError('Prop path did not resolve to an object');
  }

  const props = {...nextProps};
  delete props.id;
  return updateBlock(data, id, props, catalog);
}

export function setBlockCss(data: Data, id: string, css: string, catalog: LandingAiComponentCatalog[]): Data {
  return updateBlock(data, id, {customCss: css}, catalog);
}

export function setElementStyle(
  data: Data,
  blockId: string,
  selector: string,
  declarations: Record<string, string>,
  catalog: LandingAiComponentCatalog[],
): Data {
  const found = findBlock(data, blockId, catalog);
  if (!found) {
    throw new LandingAiOperationError(`Block not found: ${blockId}`);
  }
  const current = typeof found.block.props.customCss === 'string' ? found.block.props.customCss : '';
  return setBlockCss(data, blockId, upsertCssRule(current, selector, declarations), catalog);
}

export function setPageStyle(data: Data, selector: string, declarations: Record<string, string>): Data {
  const currentRoot = isPlainObject(data.root) ? data.root : {};
  const currentProps = isPlainObject(currentRoot.props) ? (currentRoot.props as Record<string, unknown>) : {};
  const current = typeof currentProps.customCss === 'string' ? currentProps.customCss : '';
  return updatePage(data, {customCss: upsertCssRule(current, selector, declarations)});
}

export function updatePage(data: Data, rootProps: Record<string, unknown>): Data {
  const currentRoot = isPlainObject(data.root) ? data.root : {};
  const currentProps = isPlainObject(currentRoot.props) ? currentRoot.props : {};
  return {
    ...data,
    root: {
      ...currentRoot,
      props: deepMerge(currentProps, rootProps) as Record<string, unknown>,
    },
  };
}

export function replacePage(data: Data, content: unknown[], catalog: LandingAiComponentCatalog[]): Data {
  return withContent(
    data,
    content.map(item => normalizeBlock(item, catalog, true)),
  );
}
