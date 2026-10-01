import type {LandingAiPickedElement} from '@merlin/types';

export const PICK_LIMIT = 10;

export function samePick(left: LandingAiPickedElement, right: LandingAiPickedElement): boolean {
  return left.blockId === right.blockId && left.selector === right.selector;
}

export function applyPick(
  list: LandingAiPickedElement[],
  element: LandingAiPickedElement,
  options?: {replace?: boolean; limit?: number},
): {items: LandingAiPickedElement[]; dropped: boolean} {
  const limit = options?.limit ?? PICK_LIMIT;

  if (options?.replace) {
    return {items: [element].slice(-limit), dropped: false};
  }

  const existing = list.findIndex(item => samePick(item, element));
  if (existing >= 0) {
    return {items: list.filter((_, index) => index !== existing), dropped: false};
  }

  const next = [...list, element];
  if (next.length <= limit) {
    return {items: next, dropped: false};
  }

  return {items: next.slice(next.length - limit), dropped: true};
}
