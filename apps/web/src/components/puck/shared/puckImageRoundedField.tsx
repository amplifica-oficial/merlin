import {Button, Input} from '@merlin/ui';
import type {CustomField} from '@puckeditor/core';

import {landingImageRadiusPreset} from './landingImageLayout';

const PRESETS = [
  {label: 'None', value: 'none'},
  {label: 'SM', value: 'sm'},
  {label: 'MD', value: 'md'},
  {label: 'LG', value: 'lg'},
  {label: 'XL', value: 'xl'},
  {label: 'Full', value: 'full'},
] as const;

function radiusDraft(value: boolean | string | undefined): string {
  const preset = landingImageRadiusPreset(value);
  if (preset === 'none') {
    return '0';
  }
  if (preset !== 'custom') {
    return '';
  }
  return String(value).trim().replace(/px$/i, '');
}

function PuckImageRoundedInput({
  value,
  onChange,
}: {
  value: boolean | string;
  onChange: (next: string) => void;
}) {
  const preset = landingImageRadiusPreset(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map(option => (
          <Button
            key={option.value}
            type="button"
            variant={preset === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={1}
          value={radiusDraft(value)}
          onChange={e => onChange(e.target.value === '' || e.target.value === '0' ? 'none' : e.target.value)}
        />
        <span className="text-sm text-neutral-500">px</span>
      </div>
    </div>
  );
}

export function puckImageRoundedField(label = 'Rounded'): CustomField<boolean | string> {
  return {
    type: 'custom',
    label,
    render: ({value, onChange}) => (
      <PuckImageRoundedInput value={value ?? 'xl'} onChange={onChange} />
    ),
  };
}
