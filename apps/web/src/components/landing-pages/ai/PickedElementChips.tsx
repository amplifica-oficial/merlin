import {X} from 'lucide-react';

import {LANDING_AI_MAX_PICKED, useLandingAi} from './LandingAiProvider';

export function PickedElementChips() {
  const {pickedElements, removePickedElement, clearPickedElements, setHoveredPickId, pickNotice} = useLandingAi();

  if (pickedElements.length === 0 && !pickNotice) {
    return null;
  }

  return (
    <div className="px-2 pb-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
        <span>
          {pickedElements.length}/{LANDING_AI_MAX_PICKED}
        </span>
        {pickedElements.length >= 2 ? (
          <button type="button" className="hover:text-neutral-800" onClick={clearPickedElements}>
            Limpar
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {pickedElements.map((element, index) => (
          <span
            key={element.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-700"
            onMouseEnter={() => setHoveredPickId(element.id)}
            onMouseLeave={() => setHoveredPickId(null)}
          >
            <span className="truncate">
              {index + 1} {element.tag}
              {element.blockType ? ` · ${element.blockType}` : ''}
            </span>
            <button
              type="button"
              aria-label="Remover elemento"
              className="rounded-full p-0.5 hover:bg-neutral-200"
              onClick={() => removePickedElement(element.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {pickNotice ? <p className="mt-1 text-[10px] text-amber-700">{pickNotice}</p> : null}
    </div>
  );
}
