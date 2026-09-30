import {Button, Input, Slider} from '@merlin/ui';
import type {CustomField} from '@puckeditor/core';

import {parseLandingImageWidthPercent} from './landingImageLayout';

const PRESETS = ['25', '50', '75', '100'] as const;

function PuckImageWidthInput({value, onChange}: {value: string; onChange: (next: string) => void}) {
  const percent = parseLandingImageWidthPercent(value);
  const draft = value?.trim().replace(/%$/, '') ?? String(percent);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map(preset => (
          <Button
            key={preset}
            type="button"
            variant={percent === Number(preset) ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(preset)}
          >
            {preset}%
          </Button>
        ))}
      </div>
      <Slider
        min={1}
        max={100}
        step={1}
        value={[percent]}
        aria-label="Width"
        onValueChange={([next]) => {
          if (next != null) {
            onChange(String(next));
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={100}
          step={1}
          value={draft}
          onChange={e => onChange(e.target.value)}
        />
        <span className="text-sm text-neutral-500">%</span>
      </div>
    </div>
  );
}

export function puckImageWidthField(label = 'Width'): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({value, onChange}) => <PuckImageWidthInput value={value ?? ''} onChange={onChange} />,
  };
}
