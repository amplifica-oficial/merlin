import {Button} from '@merlin/ui';
import {SquareDashedMousePointer} from 'lucide-react';

import {useLandingAi} from './LandingAiProvider';

interface InspectorToggleProps {
  compact?: boolean;
}

export function InspectorToggle({compact = false}: InspectorToggleProps) {
  const {inspectorActive, toggleInspector, pickedElements} = useLandingAi();

  return (
    <Button
      type="button"
      variant={inspectorActive ? 'default' : 'outline'}
      size="sm"
      aria-pressed={inspectorActive}
      title="Inspetor de elementos (⌘⇧C)"
      onClick={toggleInspector}
    >
      <SquareDashedMousePointer className="h-3.5 w-3.5" />
      {compact ? <span className="sr-only">Inspetor</span> : 'Inspetor'}
      {pickedElements.length > 0 ? (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] text-white">
          {pickedElements.length}
        </span>
      ) : null}
    </Button>
  );
}
