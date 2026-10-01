import {createOpenAI} from '@ai-sdk/openai';
import {LANDING_AI_TOOL_NAMES, LandingPageAiSchemas} from '@merlin/shared';
import type {LandingAiComponentCatalog, LandingAiOutline, LandingAiPickedElement} from '@merlin/types';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import type {Response} from 'express';
import type {z} from 'zod';

import {LANDING_AI_ENABLED, OPENAI_API_KEY, OPENAI_MODEL} from '../app/constants.js';

export const LANDING_AI_MAX_OUTPUT_TOKENS = 8000;
export const LANDING_AI_MAX_STEPS = 12;
export const LANDING_AI_MAX_OUTLINE_CHARS = 40_000;
export const LANDING_AI_MAX_CATALOG_CHARS = 40_000;
export const LANDING_AI_MAX_BODY_CHARS = 300_000;

export type LandingPageAiChatPayload = z.infer<typeof LandingPageAiSchemas.chat>;

export function isLandingAiEnabled(): boolean {
  return LANDING_AI_ENABLED;
}

export function truncateJson<T>(value: T, maxChars: number): T | {truncated: true; preview: string} {
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxChars) {
    return value;
  }

  if (Array.isArray(value)) {
    const next = [...value];
    while (next.length > 0 && JSON.stringify(next).length > maxChars) {
      next.pop();
    }
    return next as T;
  }

  return {truncated: true, preview: serialized.slice(0, maxChars)};
}

export function truncateOutline(outline: LandingAiOutline, maxChars: number): LandingAiOutline {
  if (JSON.stringify(outline).length <= maxChars) {
    return outline;
  }

  const content = [...outline.content];
  let omittedBlocks = 0;
  while (content.length > 0) {
    const candidate: LandingAiOutline = {
      ...outline,
      content,
      truncated: true,
      omittedBlocks: omittedBlocks + 1,
    };
    if (JSON.stringify(candidate).length <= maxChars) {
      return candidate;
    }
    content.pop();
    omittedBlocks += 1;
  }

  return {
    ...outline,
    content: [],
    truncated: true,
    omittedBlocks: outline.content.length,
  };
}

function formatPickedElements(elements: LandingAiPickedElement[] | undefined): string {
  if (!elements || elements.length === 0) {
    return 'No elements were picked with the inspector.';
  }

  const numbered = elements.map((element, index) => ({'#': index + 1, ...element}));

  return [
    'Elementos escolhidos pelo usuário (inspector):',
    '- If the request refers to "these"/"all"/"esses"/"todos", apply it to every picked element. The user may cite #n.',
    '- When the same style applies to several elements, call set_element_style once per element using the exact selector. Do not invent broader selectors.',
    '- Prefer update_block_prop when propMatches is present (that path is the editable prop).',
    '- Otherwise use set_element_style(blockId, selector, declarations) for the given selector.',
    '- Use set_page_style when blockId is null (page-level / outside a block).',
    '- Text baked into component markup (no matching prop) can only be styled, not rewritten.',
    JSON.stringify(numbered),
  ].join('\n');
}

export function buildSystemPrompt(input: {
  catalog: unknown;
  outline: unknown;
  selectedId?: string | null;
  pickedElements?: LandingAiPickedElement[];
}): string {
  const selected = input.selectedId
    ? `The user currently has this block selected: ${input.selectedId}. Prefer editing it when the request is about "this" block/section.`
    : 'No block is selected.';

  const outline = input.outline as LandingAiOutline | {truncated?: boolean};
  const truncatedNote =
    outline && typeof outline === 'object' && 'truncated' in outline && outline.truncated
      ? 'The outline was truncated. Call get_page for the full tree, or get_block for a specific id.'
      : '';

  return [
    'You are the landing page editor assistant inside Merlin.',
    'You edit a Puck visual page: content, props, scoped custom CSS, and the block tree.',
    'Match the user language (Portuguese or English).',
    '',
    'Rules:',
    '- Only use component types from the catalog. Never invent types.',
    '- Only reference block ids that appear in the outline, except when inserting new blocks (the client assigns ids).',
    '- For new blocks, omit id. Merge with defaultProps via insert_block.',
    '- Prefer small, targeted tools over replace_page. Use replace_page only to rebuild the page from scratch.',
    '- The catalog in this prompt is a summary (type, label, category, description, slots). Call get_component_schema for fields and defaultProps.',
    '- customCss is scoped to the block wrapper. Write normal CSS (e.g. "h1 { color: #111 }"). Do not include </style>, @import, or javascript: URLs.',
    '- Use update_page.rootProps.customCss or set_page_style for page-wide CSS.',
    '- Use list_forms before filling FormBlock.formPublicId.',
    '- Use update_block_prop(id, path, value) for a single nested field (e.g. testimonials.2.text).',
    '- After mutations, tool results are lean ({ok, changed}). Call get_page if you need the full outline again.',
    '- After mutations, briefly say what changed. If a tool returns ok:false, fix the error and retry.',
    '- Call get_component_schema before inserting an unfamiliar type. Call get_block when you need full props.',
    '',
    selected,
    truncatedNote,
    '',
    formatPickedElements(input.pickedElements),
    '',
    'Component catalog (summary):',
    JSON.stringify(input.catalog),
    '',
    'Current page outline:',
    JSON.stringify(input.outline),
  ]
    .filter(line => line !== '')
    .join('\n');
}

type LandingAiToolName = (typeof LANDING_AI_TOOL_NAMES)[number];

function bindLandingAiTools<T extends Record<LandingAiToolName, unknown>>(
  tools: T & Record<Exclude<keyof T, LandingAiToolName>, never>,
): T {
  return tools;
}

export function createLandingAiTools() {
  return bindLandingAiTools({
    get_block: tool({
      description: 'Read the full props of an existing block by id.',
      inputSchema: LandingPageAiSchemas.tools.getBlock,
    }),
    get_component_schema: tool({
      description: 'Get fields, slots, hints, and defaultProps for a catalog component type.',
      inputSchema: LandingPageAiSchemas.tools.getComponentSchema,
    }),
    get_page: tool({
      description: 'Read the full current page outline (use when the prompt outline was truncated).',
      inputSchema: LandingPageAiSchemas.tools.getPage,
    }),
    list_forms: tool({
      description: 'List project forms (name, publicId, slug) to fill FormBlock.formPublicId.',
      inputSchema: LandingPageAiSchemas.tools.listForms,
    }),
    update_block: tool({
      description: 'Deep-merge props on an existing block. Arrays replace the previous array.',
      inputSchema: LandingPageAiSchemas.tools.updateBlock,
    }),
    update_block_prop: tool({
      description: 'Set one nested prop by path, e.g. testimonials.2.text or items.0.src.',
      inputSchema: LandingPageAiSchemas.tools.updateBlockProp,
    }),
    insert_block: tool({
      description:
        'Insert a catalog component. Omit parentId to add at page root. Use slot for the parent slot name.',
      inputSchema: LandingPageAiSchemas.tools.insertBlock,
    }),
    move_block: tool({
      description: 'Move a block to another parent/slot/index. Omit parentId to move to the page root.',
      inputSchema: LandingPageAiSchemas.tools.moveBlock,
    }),
    remove_block: tool({
      description: 'Remove a block and its children.',
      inputSchema: LandingPageAiSchemas.tools.removeBlock,
    }),
    duplicate_block: tool({
      description: 'Duplicate a block (and nested slot children) next to the original. New ids are generated.',
      inputSchema: LandingPageAiSchemas.tools.duplicateBlock,
    }),
    set_block_css: tool({
      description: 'Replace the scoped customCss of a block.',
      inputSchema: LandingPageAiSchemas.tools.setBlockCss,
    }),
    set_element_style: tool({
      description:
        'Merge CSS declarations for a selector into the block customCss (replaces the same selector, keeps the rest).',
      inputSchema: LandingPageAiSchemas.tools.setElementStyle,
    }),
    set_page_style: tool({
      description: 'Merge CSS declarations for a selector into page-wide root customCss.',
      inputSchema: LandingPageAiSchemas.tools.setPageStyle,
    }),
    update_page: tool({
      description: 'Merge root page props (including page-wide customCss).',
      inputSchema: LandingPageAiSchemas.tools.updatePage,
    }),
    replace_page: tool({
      description: 'Replace the entire page content tree. Use only when rebuilding from scratch.',
      inputSchema: LandingPageAiSchemas.tools.replacePage,
    }),
  });
}

export class LandingPageAiService {
  public static async streamChat(res: Response, payload: LandingPageAiChatPayload): Promise<void> {
    const catalog = truncateJson(
      payload.catalog as LandingAiComponentCatalog[],
      LANDING_AI_MAX_CATALOG_CHARS,
    );
    const outline = truncateOutline(payload.outline as LandingAiOutline, LANDING_AI_MAX_OUTLINE_CHARS);
    const system = buildSystemPrompt({
      catalog,
      outline,
      selectedId: payload.selectedId,
      pickedElements: payload.pickedElements as LandingAiPickedElement[] | undefined,
    });

    const openai = createOpenAI({apiKey: OPENAI_API_KEY});
    const messages = convertToModelMessages(payload.messages as unknown as UIMessage[], {
      ignoreIncompleteToolCalls: true,
    });

    const abortController = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    res.on('close', onClose);

    try {
      const result = streamText({
        model: openai(OPENAI_MODEL),
        system,
        messages,
        tools: createLandingAiTools(),
        stopWhen: stepCountIs(LANDING_AI_MAX_STEPS),
        maxOutputTokens: LANDING_AI_MAX_OUTPUT_TOKENS,
        abortSignal: abortController.signal,
      });

      await result.pipeUIMessageStreamToResponse(res);
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      throw error;
    } finally {
      res.off('close', onClose);
    }
  }
}
