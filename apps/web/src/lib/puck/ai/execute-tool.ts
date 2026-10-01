import type {Data} from '@puckeditor/core';
import type {LandingAiComponentCatalog, LandingAiFormSummary, LandingAiToolResult} from '@merlin/types';

import {network} from '../../network';
import {puckConfig} from '../config';
import {getComponentSchema} from './catalog';
import {buildOutline} from './outline';
import {
  duplicateBlock,
  findBlock,
  insertBlock,
  LandingAiOperationError,
  moveBlock,
  removeBlock,
  replacePage,
  setBlockCss,
  setElementStyle,
  setPageStyle,
  updateBlock,
  updateBlockProp,
  updatePage,
} from './operations';

export const MUTATING_AI_TOOLS = new Set([
  'update_block',
  'update_block_prop',
  'insert_block',
  'move_block',
  'remove_block',
  'duplicate_block',
  'set_block_css',
  'set_element_style',
  'set_page_style',
  'update_page',
  'replace_page',
]);

export async function executeLandingAiTool(
  name: string,
  input: Record<string, unknown>,
  data: Data,
  catalog: LandingAiComponentCatalog[],
): Promise<{data?: Data; result: LandingAiToolResult}> {
  try {
    switch (name) {
      case 'get_block': {
        const found = findBlock(data, String(input.id ?? ''), catalog);
        if (!found) {
          return {
            result: {
              ok: false,
              error: `Block not found: ${String(input.id ?? '')}`,
              outline: buildOutline(data, catalog),
            },
          };
        }
        return {
          result: {
            ok: true,
            id: found.block.props.id,
            props: found.block.props,
          },
        };
      }
      case 'get_component_schema': {
        const schema = getComponentSchema(puckConfig, String(input.type ?? ''));
        if (!schema) {
          return {result: {ok: false, error: `Unknown type: ${String(input.type ?? '')}`}};
        }
        return {result: {ok: true, schema}};
      }
      case 'get_page': {
        return {result: {ok: true, outline: buildOutline(data, catalog)}};
      }
      case 'list_forms': {
        const forms = await network.fetch<Array<{name: string; slug: string; publicId: string; enabled?: boolean}>>(
          'GET',
          '/forms',
        );
        const summaries: LandingAiFormSummary[] = (Array.isArray(forms) ? forms : []).map(form => ({
          name: form.name,
          publicId: form.publicId,
          slug: form.slug,
          enabled: form.enabled,
        }));
        return {result: {ok: true, forms: summaries}};
      }
      case 'update_block': {
        const next = updateBlock(data, String(input.id ?? ''), asRecord(input.props), catalog);
        return {data: next, result: changedResult(next, String(input.id ?? ''), catalog)};
      }
      case 'update_block_prop': {
        const next = updateBlockProp(
          data,
          String(input.id ?? ''),
          String(input.path ?? ''),
          input.value,
          catalog,
        );
        return {data: next, result: changedResult(next, String(input.id ?? ''), catalog)};
      }
      case 'insert_block': {
        const inserted = insertBlock(
          data,
          {
            type: String(input.type ?? ''),
            props: input.props ? asRecord(input.props) : undefined,
            parentId: optionalString(input.parentId),
            slot: optionalString(input.slot),
            index: optionalNumber(input.index),
          },
          catalog,
        );
        return {
          data: inserted.data,
          result: changedResult(inserted.data, inserted.id, catalog),
        };
      }
      case 'move_block': {
        const next = moveBlock(
          data,
          {
            id: String(input.id ?? ''),
            parentId: optionalString(input.parentId),
            slot: optionalString(input.slot),
            index: optionalNumber(input.index),
          },
          catalog,
        );
        return {data: next, result: changedResult(next, String(input.id ?? ''), catalog)};
      }
      case 'remove_block': {
        const next = removeBlock(data, String(input.id ?? ''), catalog);
        return {data: next, result: {ok: true, id: String(input.id ?? ''), changed: {id: String(input.id ?? ''), type: 'removed'}}};
      }
      case 'duplicate_block': {
        const duplicated = duplicateBlock(data, String(input.id ?? ''), catalog);
        return {
          data: duplicated.data,
          result: changedResult(duplicated.data, duplicated.id, catalog),
        };
      }
      case 'set_block_css': {
        const next = setBlockCss(data, String(input.id ?? ''), String(input.css ?? ''), catalog);
        return {data: next, result: changedResult(next, String(input.id ?? ''), catalog)};
      }
      case 'set_element_style': {
        const next = setElementStyle(
          data,
          String(input.blockId ?? ''),
          String(input.selector ?? ''),
          asStringRecord(input.declarations),
          catalog,
        );
        return {data: next, result: changedResult(next, String(input.blockId ?? ''), catalog)};
      }
      case 'set_page_style': {
        const next = setPageStyle(data, String(input.selector ?? ''), asStringRecord(input.declarations));
        return {data: next, result: {ok: true, changed: {id: 'root', type: 'Page'}}};
      }
      case 'update_page': {
        const next = updatePage(data, asRecord(input.rootProps));
        return {data: next, result: {ok: true, changed: {id: 'root', type: 'Page'}}};
      }
      case 'replace_page': {
        const content = Array.isArray(input.content) ? input.content : [];
        const next = replacePage(data, content, catalog);
        return {data: next, result: {ok: true, changed: {id: 'root', type: 'Page'}}};
      }
      default:
        return {result: {ok: false, error: `Unknown tool: ${name}`, outline: buildOutline(data, catalog)}};
    }
  } catch (error) {
    const message = error instanceof LandingAiOperationError || error instanceof Error ? error.message : 'Tool failed';
    return {result: {ok: false, error: message, outline: buildOutline(data, catalog)}};
  }
}

function changedResult(data: Data, id: string, catalog: LandingAiComponentCatalog[]): LandingAiToolResult {
  const found = findBlock(data, id, catalog);
  return {
    ok: true,
    id,
    changed: found ? {id, type: found.block.type} : {id, type: 'unknown'},
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
