import {Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@merlin/ui';
import type {Template} from '@merlin/db';
import {DEFAULT_CONFIRMATION_TEMPLATE_NAME} from '@merlin/shared';
import type {PaginatedResponse} from '@merlin/types';
import {useEffect, useMemo} from 'react';
import useSWR from 'swr';

import {usePersistentState} from '../lib/hooks/usePersistentState';

export const CONFIRMATION_TEMPLATE_STORAGE_KEY = 'merlin:contacts:confirmationTemplateId';

function isStoredTemplateId(value: string): value is string {
  return value.length > 0;
}

export function useConfirmationTemplate(enabled = true) {
  const [storedId, setStoredId] = usePersistentState(CONFIRMATION_TEMPLATE_STORAGE_KEY, '', isStoredTemplateId);
  const {data, isLoading} = useSWR<PaginatedResponse<Template>>(
    enabled ? '/templates?page=1&pageSize=100&type=TRANSACTIONAL' : null,
    {revalidateOnFocus: false},
  );
  const templates = useMemo(() => data?.data ?? [], [data?.data]);

  const resolvedId = useMemo(() => {
    if (templates.some(template => template.id === storedId)) {
      return storedId;
    }

    const fallback =
      templates.find(template => template.name === DEFAULT_CONFIRMATION_TEMPLATE_NAME) ?? templates[0];
    return fallback?.id ?? '';
  }, [storedId, templates]);

  useEffect(() => {
    if (resolvedId && resolvedId !== storedId) {
      setStoredId(resolvedId);
    }
  }, [resolvedId, setStoredId, storedId]);

  const selected = templates.find(template => template.id === resolvedId);

  return {
    templateId: resolvedId,
    setTemplateId: setStoredId,
    templates,
    selected,
    isLoading,
  };
}

interface ConfirmationTemplatePickerProps {
  templateId: string;
  onTemplateIdChange: (id: string) => void;
  templates: Template[];
  selected?: Template;
  isLoading: boolean;
}

export function ConfirmationTemplatePicker({
  templateId,
  onTemplateIdChange,
  templates,
  selected,
  isLoading,
}: ConfirmationTemplatePickerProps) {
  const senderLabel = selected
    ? selected.fromName
      ? `${selected.fromName} <${selected.from}>`
      : selected.from
    : null;

  return (
    <div className="space-y-1.5 pl-6">
      <Label htmlFor="confirmation-template">Confirmation template</Label>
      <Select
        value={templateId || undefined}
        onValueChange={onTemplateIdChange}
        disabled={isLoading || templates.length === 0}
      >
        <SelectTrigger id="confirmation-template">
          <SelectValue
            placeholder={isLoading ? 'Loading templates...' : 'Default confirmation template'}
          />
        </SelectTrigger>
        <SelectContent>
          {templates.map(template => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {senderLabel ? (
        <p className="text-xs text-neutral-500">Sends from {senderLabel}</p>
      ) : null}
      {!isLoading && templates.length === 0 ? (
        <p className="text-xs text-neutral-500">
          A default confirmation template will be created for this project. Edit it later in{' '}
          <a href="/templates" className="underline underline-offset-2">
            Templates
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
