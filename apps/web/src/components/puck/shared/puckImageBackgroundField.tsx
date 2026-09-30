import {Button, Input} from '@merlin/ui';
import type {CustomField} from '@puckeditor/core';

import {
  landingImageBackgroundIsTransparent,
  parseLandingImageBackground,
} from './landingImageLayout';

const COLOR_FALLBACK = '#ffffff';

function toColorInputValue(background?: string): string {
  const parsed = parseLandingImageBackground(background);
  if (parsed === 'transparent') {
    return COLOR_FALLBACK;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(parsed)) {
    return `#${parsed[1]}${parsed[1]}${parsed[2]}${parsed[2]}${parsed[3]}${parsed[3]}`;
  }
  return parsed;
}

function PuckImageBackgroundInput({value, onChange}: {value: string; onChange: (next: string) => void}) {
  const transparent = landingImageBackgroundIsTransparent(value);
  const hexDraft = transparent ? '' : parseLandingImageBackground(value);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={transparent ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('transparent')}
      >
        Transparent
      </Button>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Background color"
          value={toColorInputValue(value)}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-neutral-200 bg-white p-1"
        />
        <Input
          value={hexDraft}
          onChange={e => onChange(e.target.value || 'transparent')}
          placeholder="#ffffff"
          className="font-mono"
          aria-label="Background hex"
        />
      </div>
    </div>
  );
}

export function puckImageBackgroundField(label = 'Background'): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({value, onChange}) => (
      <PuckImageBackgroundInput value={value ?? 'transparent'} onChange={onChange} />
    ),
  };
}
