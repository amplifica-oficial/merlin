
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  Input,
  Label,
} from '@merlin/ui';
import type {FormField, FormFieldType, FormSettings} from '@merlin/types';
import type {Segment} from '@merlin/db';
import {FormSchemas} from '@merlin/shared';
import {
  FORM_APPEARANCE_DEFAULTS,
  FORM_COLOR_THEMES,
  FORM_COLOR_THEME_LIST,
  FORM_COLOR_TOKEN_FIELDS,
  FORM_COLOR_TOKEN_KEYS,
} from '../lib/formColorThemes';
import {network} from '../lib/network';
import {ConfirmationTemplatePicker, useConfirmationTemplate} from './ConfirmationTemplatePicker';
import {
  BRAZILIAN_STATES,
  FORM_EMAIL_FIELD_KEY,
  FORM_FIELD_TYPE_OPTIONS,
  FORM_SELECT_OPTIONS_MAX,
  FormPreview,
  applyFormColorTheme,
  createEditorClientId,
  getActiveFormColorThemeId,
  hydrateEditorFieldOrder,
  insertPastedOptions,
  parseFormButtonHexColor,
  parsePastedOptions,
  reorderFieldsFromOrder,
  sortOptionsAlphabetically,
  toEditorFields,
  toPersistedFieldOrder,
  toPersistedFields,
  type EditorFormField,
} from './FormPreview';
import {FormPreviewEditor} from './FormPreviewEditor';
import {ArrowDownAZ, ChevronDown, ChevronUp, GripVertical, Plus, Save, Trash2, X} from 'lucide-react';
import {useRouter} from 'next/router';
import {useEffect, useState, type ClipboardEvent, type DragEvent, type ReactNode} from 'react';
import {toast} from 'sonner';
import useSWR from 'swr';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function toColorInputValue(hex: string | undefined, fallback: string): string {
  const parsed = parseFormButtonHexColor(hex) ?? fallback;
  if (/^#[0-9a-fA-F]{3}$/.test(parsed)) {
    return `#${parsed[1]}${parsed[1]}${parsed[2]}${parsed[2]}${parsed[3]}${parsed[3]}`;
  }
  return parsed;
}

function FormColorField({
  id,
  label,
  value,
  fallback,
  onChange,
}: {
  id: string;
  label: string;
  value?: string;
  fallback: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={toColorInputValue(value, fallback)}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-neutral-200 bg-white p-1"
        />
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value || undefined)}
          placeholder={fallback}
          className="font-mono"
          aria-label={`${label} hex`}
        />
        {value ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const DEFAULT_SUCCESS_MESSAGE = 'Thanks for signing up!';
const DEFAULT_FORM_TAGS: Array<{key: string; value: string}> = [{key: 'source', value: 'form'}];

function isDefaultFormTags(tags: Array<{key: string; value: string}>): boolean {
  return tags.length === 1 && tags[0]?.key === 'source' && tags[0]?.value === 'form';
}

function appearanceHint(settings: FormSettings): string | undefined {
  const themeId = getActiveFormColorThemeId(settings);
  if (themeId === 'default') return undefined;
  if (!themeId) return 'Custom';
  return FORM_COLOR_THEMES[themeId].label;
}

function afterSubmitHint(settings: FormSettings): string | undefined {
  if (settings.redirectUrl) return 'Redirect';
  if (settings.successMessage && settings.successMessage !== DEFAULT_SUCCESS_MESSAGE) return 'Custom message';
  return undefined;
}

function destinationHint(
  tab: 'static' | 'dynamic',
  tags: Array<{key: string; value: string}>,
): string | undefined {
  if (tab === 'static') return 'Static segment';
  if (!isDefaultFormTags(tags)) return 'Custom tags';
  return undefined;
}

function optionsHint(settings: FormSettings): string | undefined {
  if (settings.doubleOptIn) return 'Double opt-in';
  if (settings.verifyEmail) return 'Validate email';
  return undefined;
}

function shouldOpenAppearance(settings: FormSettings): boolean {
  return getActiveFormColorThemeId(settings) !== 'default';
}

function shouldOpenAfterSubmit(settings: FormSettings): boolean {
  return Boolean(settings.redirectUrl) || Boolean(settings.successMessage && settings.successMessage !== DEFAULT_SUCCESS_MESSAGE);
}

function FormEditorCollapsibleCard({
  title,
  description,
  hint,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  hint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CardHeader className="p-0">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 p-6 text-left hover:bg-neutral-50/80"
            >
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="font-semibold leading-none tracking-tight">{title}</span>
                <span className="text-sm text-neutral-500">{description}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 pt-0.5">
                {!open && hint ? <span className="text-xs font-medium text-neutral-500">{hint}</span> : null}
                <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', open && 'rotate-180')} />
              </span>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface FormEditorProps {
  mode: 'create' | 'edit';
  formId?: string;
}

export function FormEditor({mode, formId}: FormEditorProps) {
  const router = useRouter();
  const {data: existingForm, isLoading: loadingForm} = useSWR(
    mode === 'edit' && formId ? `/forms/${formId}` : null,
  );
  const {data: segments} = useSWR<Segment[]>('/segments');

  const staticSegments = segments?.filter(s => s.type === 'STATIC') ?? [];

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [fields, setFields] = useState<EditorFormField[]>([]);
  const [fieldOrder, setFieldOrder] = useState<string[]>([FORM_EMAIL_FIELD_KEY]);
  const [destinationTab, setDestinationTab] = useState<'static' | 'dynamic'>('dynamic');
  const [segmentId, setSegmentId] = useState<string>('');
  const [createSegment, setCreateSegment] = useState(false);
  const [tags, setTags] = useState<Array<{key: string; value: string}>>(DEFAULT_FORM_TAGS);
  const [settings, setSettings] = useState<FormSettings>({
    title: '',
    description: '',
    successMessage: DEFAULT_SUCCESS_MESSAGE,
    doubleOptIn: false,
    verifyEmail: false,
  });
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [afterSubmitOpen, setAfterSubmitOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const confirmation = useConfirmationTemplate(settings.doubleOptIn ?? false);

  useEffect(() => {
    if (existingForm && mode === 'edit') {
      const form = existingForm as {
        name: string;
        slug: string;
        fields: FormField[];
        settings: FormSettings;
        segmentId: string | null;
        enabled: boolean;
      };
      setName(form.name);
      setSlug(form.slug);
      setSlugTouched(true);
      const loadedFields = toEditorFields(Array.isArray(form.fields) ? form.fields : []);
      setFields(loadedFields);
      setFieldOrder(hydrateEditorFieldOrder(form.settings?.fieldOrder, loadedFields));
      const loadedSettings = typeof form.settings === 'object' && form.settings ? form.settings : {};
      setSettings(loadedSettings);
      setSegmentId(form.segmentId ?? '');
      setCreateSegment(false);
      const nextTab = form.segmentId ? 'static' : 'dynamic';
      setDestinationTab(nextTab);
      const formTags = form.settings?.tags;
      const loadedTags =
        formTags && typeof formTags === 'object'
          ? Object.entries(formTags).map(([key, value]) => ({key, value: String(value)}))
          : DEFAULT_FORM_TAGS;
      setTags(loadedTags);
      setEnabled(form.enabled);
      setAppearanceOpen(shouldOpenAppearance(loadedSettings));
      setAfterSubmitOpen(shouldOpenAfterSubmit(loadedSettings));
      setDestinationOpen(nextTab === 'static' || !isDefaultFormTags(loadedTags));
      setOptionsOpen(Boolean(loadedSettings.doubleOptIn || loadedSettings.verifyEmail));
    }
  }, [existingForm, mode]);

  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    if (!settings.doubleOptIn || settings.confirmationTemplateId || !confirmation.templateId) {
      return;
    }
    setSettings(s => (s.confirmationTemplateId ? s : {...s, confirmationTemplateId: confirmation.templateId}));
  }, [settings.doubleOptIn, settings.confirmationTemplateId, confirmation.templateId]);

  const addField = () => {
    const clientId = createEditorClientId();
    const newKey = `field_${fields.length + 1}`;
    setFields(prev => [
      ...prev,
      {
        clientId,
        key: newKey,
        label: 'Custom field',
        type: 'text',
        required: false,
        placeholder: '',
      },
    ]);
    setFieldOrder(prev => [...prev, clientId]);
  };

  const updateField = (index: number, patch: Partial<FormField>) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = {...f, ...patch};
        if (patch.type === 'select' && !updated.options?.length) {
          updated.options = ['Option 1'];
        }
        if (patch.type && patch.type !== 'select') {
          updated.options = undefined;
        }
        return updated;
      }),
    );
  };

  const updateFieldByClientId = (clientId: string, patch: Partial<FormField>) => {
    const index = fields.findIndex(f => f.clientId === clientId);
    if (index >= 0) updateField(index, patch);
  };

  const updateFieldOption = (fieldIndex: number, optionIndex: number, value: string) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const options = [...(f.options ?? [])];
        options[optionIndex] = value;
        return {...f, options};
      }),
    );
  };

  const addFieldOption = (fieldIndex: number) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const options = [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`];
        return {...f, options};
      }),
    );
  };

  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const options = (f.options ?? []).filter((_, oi) => oi !== optionIndex);
        return {...f, options};
      }),
    );
  };

  const moveFieldOption = (fieldIndex: number, fromIndex: number, toIndex: number) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const options = [...(f.options ?? [])];
        if (fromIndex === toIndex || toIndex < 0 || toIndex >= options.length) return f;
        const [item] = options.splice(fromIndex, 1);
        if (item === undefined) return f;
        options.splice(toIndex, 0, item);
        return {...f, options};
      }),
    );
  };

  const handleOptionPaste = (fieldIndex: number, optionIndex: number, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\r')) return;

    event.preventDefault();
    const pasted = parsePastedOptions(text);
    if (pasted.length === 0) return;

    const current = fields[fieldIndex]?.options ?? [];
    const {options, truncated} = insertPastedOptions(current, optionIndex, pasted);
    setFields(prev => prev.map((f, i) => (i === fieldIndex ? {...f, options} : f)));
    if (truncated) {
      toast.error(`Select fields support up to ${FORM_SELECT_OPTIONS_MAX} options`);
    }
  };

  const sortFieldOptions = (fieldIndex: number) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        return {...f, options: sortOptionsAlphabetically(f.options ?? [])};
      }),
    );
  };

  const applyBrazilianStatesPreset = (fieldIndex: number) => {
    setFields(prev => prev.map((f, i) => (i === fieldIndex ? {...f, options: [...BRAZILIAN_STATES]} : f)));
  };

  const removeField = (clientId: string) => {
    setFields(prev => prev.filter(f => f.clientId !== clientId));
    setFieldOrder(prev => prev.filter(k => k !== clientId));
  };

  const moveFieldOrderItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= fieldOrder.length) return;
    setFieldOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      if (item === undefined) return prev;
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const handleFieldDragStart = (index: number) => {
    setDraggedFieldIndex(index);
  };

  const handleFieldDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedFieldIndex === null || draggedFieldIndex === index) return;
    setDragOverFieldIndex(index);
  };

  const handleFieldDrop = (index: number) => {
    if (draggedFieldIndex !== null) {
      moveFieldOrderItem(draggedFieldIndex, index);
    }
    setDraggedFieldIndex(null);
    setDragOverFieldIndex(null);
  };

  const handleFieldDragEnd = () => {
    setDraggedFieldIndex(null);
    setDragOverFieldIndex(null);
  };

  const addTag = () => setTags(prev => [...prev, {key: '', value: ''}]);
  const updateTag = (index: number, patch: Partial<{key: string; value: string}>) => {
    setTags(prev => prev.map((t, i) => (i === index ? {...t, ...patch} : t)));
  };
  const removeTag = (index: number) => setTags(prev => prev.filter((_, i) => i !== index));

  const buildPayload = () => {
    const tagsRecord: Record<string, string> = {};
    for (const tag of tags) {
      if (tag.key.trim()) tagsRecord[tag.key.trim()] = tag.value;
    }

    const persistedFieldOrder = toPersistedFieldOrder(fieldOrder, fields);
    const colorFields = Object.fromEntries(
      FORM_COLOR_TOKEN_KEYS.map(key => [key, parseFormButtonHexColor(settings[key])]),
    ) as Pick<FormSettings, (typeof FORM_COLOR_TOKEN_KEYS)[number]>;
    const themeId = getActiveFormColorThemeId({...settings, ...colorFields});
    const settingsPayload: FormSettings = {
      ...settings,
      buttonLabel: settings.buttonLabel?.trim() || undefined,
      ...colorFields,
      fieldOrder: persistedFieldOrder,
      tags: Object.keys(tagsRecord).length > 0 ? tagsRecord : undefined,
      themeId,
    };
    if (!themeId) {
      delete settingsPayload.themeId;
    }

    return {
      name,
      slug,
      fields: reorderFieldsFromOrder(toPersistedFields(fields), persistedFieldOrder),
      settings: settingsPayload,
      enabled,
      ...(destinationTab === 'static'
        ? {
            segmentId: createSegment ? undefined : segmentId || undefined,
            createSegment: createSegment || undefined,
          }
        : mode === 'edit'
          ? {segmentId: null}
          : {}),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (destinationTab === 'static' && !createSegment && !segmentId) {
      toast.error('Select a static segment or choose to create one');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        const parsed = FormSchemas.create.parse(payload);
        const form = await network.fetch<{id: string}, typeof FormSchemas.create>('POST', '/forms', parsed);
        toast.success('Form created');
        void router.push(`/forms/${form.id}`);
      } else if (formId) {
        const parsed = FormSchemas.update.parse(payload);
        await network.fetch<void, typeof FormSchemas.update>('PATCH', `/forms/${formId}`, parsed);
        toast.success('Form saved');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save form');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'edit' && loadingForm) {
    return <div className="flex justify-center py-24">Loading...</div>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <form onSubmit={e => void handleSubmit(e)} className="space-y-6 min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
          <CardDescription>Name and URL slug for this form</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Newsletter signup" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={e => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
              placeholder="newsletter-signup"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            />
            <p className="text-xs text-neutral-500">
              Writes tag <code className="bg-neutral-100 px-1 rounded">form:{slug || 'slug'}</code> on each contact
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            Enabled (accepts submissions on landing pages)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Page content</CardTitle>
          <CardDescription>What visitors see on the form block in landing pages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={settings.title ?? ''}
              onChange={e => setSettings(s => ({...s, title: e.target.value}))}
              placeholder={name || 'Subscribe'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={settings.description ?? ''}
              onChange={e => setSettings(s => ({...s, description: e.target.value}))}
              placeholder="Get updates delivered to your inbox"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buttonLabel">Button text</Label>
            <Input
              id="buttonLabel"
              value={settings.buttonLabel ?? ''}
              onChange={e => setSettings(s => ({...s, buttonLabel: e.target.value || undefined}))}
              placeholder="Subscribe"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>Email is always collected. Add optional custom fields stored on the contact.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldOrder.map((orderKey, index) => {
            const reorderControls = (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => moveFieldOrderItem(index, index - 1)}
                  aria-label="Move field up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === fieldOrder.length - 1}
                  onClick={() => moveFieldOrderItem(index, index + 1)}
                  aria-label="Move field down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            );

            if (orderKey === FORM_EMAIL_FIELD_KEY) {
              return (
                <div
                  key={orderKey}
                  onDragOver={e => handleFieldDragOver(e, index)}
                  onDrop={() => handleFieldDrop(index)}
                  className={`p-4 border rounded-lg space-y-3 bg-neutral-50/50 transition-colors ${
                    draggedFieldIndex === index ? 'opacity-50' : ''
                  } ${dragOverFieldIndex === index ? 'border-neutral-400 bg-neutral-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      draggable
                      onDragStart={() => handleFieldDragStart(index)}
                      onDragEnd={handleFieldDragEnd}
                      className="flex items-center gap-2 text-sm cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4 text-neutral-500" />
                      <Badge>email</Badge>
                      <span className="font-medium">Email</span>
                      <span className="text-neutral-500">Required</span>
                    </div>
                    {reorderControls}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Placeholder</Label>
                    <Input
                      id="emailPlaceholder"
                      value={settings.emailPlaceholder ?? ''}
                      onChange={e => setSettings(s => ({...s, emailPlaceholder: e.target.value || undefined}))}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              );
            }

            const fieldIndex = fields.findIndex(f => f.clientId === orderKey);
            if (fieldIndex === -1) return null;
            const field = fields[fieldIndex];
            if (!field) return null;

            return (
              <div
                key={orderKey}
                onDragOver={e => handleFieldDragOver(e, index)}
                onDrop={() => handleFieldDrop(index)}
                className={`p-4 border rounded-lg space-y-3 transition-colors ${
                  draggedFieldIndex === index ? 'opacity-50' : ''
                } ${dragOverFieldIndex === index ? 'border-neutral-400 bg-neutral-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    draggable
                    onDragStart={() => handleFieldDragStart(index)}
                    onDragEnd={handleFieldDragEnd}
                    className="flex items-center gap-2 text-sm text-neutral-500 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                    <span>{field.label || field.key}</span>
                  </div>
                  {reorderControls}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Key</Label>
                    <Input
                      value={field.key}
                      onChange={e => updateField(fieldIndex, {key: e.target.value})}
                      placeholder="field_key"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Label</Label>
                    <Input
                      value={field.label}
                      onChange={e => updateField(fieldIndex, {label: e.target.value})}
                      placeholder="Label"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Type</Label>
                    <select
                      value={field.type}
                      onChange={e => updateField(fieldIndex, {type: e.target.value as FormFieldType})}
                      className="w-full border rounded-md px-3 py-2 text-sm h-10"
                    >
                      {FORM_FIELD_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Placeholder</Label>
                    <Input
                      value={field.placeholder ?? ''}
                      onChange={e => updateField(fieldIndex, {placeholder: e.target.value || undefined})}
                      placeholder="Optional placeholder"
                      disabled={field.type === 'checkbox'}
                    />
                  </div>
                </div>

                {field.type === 'select' && (
                  <div className="space-y-2 pl-1">
                    <Label className="text-xs text-neutral-500">Options</Label>
                    <p className="text-xs text-neutral-400">Paste a list to add many options at once (one per line)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={(field.options?.length ?? 0) < 2}
                        onClick={() => sortFieldOptions(fieldIndex)}
                      >
                        <ArrowDownAZ className="h-4 w-4 mr-1" />
                        Sort A–Z
                      </Button>
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value === 'br-states') {
                            applyBrazilianStatesPreset(fieldIndex);
                          }
                          e.target.value = '';
                        }}
                        className="border rounded-md px-3 py-2 text-sm h-9"
                        aria-label="Insert option preset"
                      >
                        <option value="" disabled>
                          Insert preset...
                        </option>
                        <option value="br-states">Brazilian states</option>
                      </select>
                    </div>
                    {(field.options ?? []).map((option, optionIndex) => (
                      <div key={optionIndex} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={e => updateFieldOption(fieldIndex, optionIndex, e.target.value)}
                          onPaste={e => handleOptionPaste(fieldIndex, optionIndex, e)}
                          placeholder={`Option ${optionIndex + 1}`}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={optionIndex === 0}
                          onClick={() => moveFieldOption(fieldIndex, optionIndex, optionIndex - 1)}
                          aria-label="Move option up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={optionIndex === (field.options?.length ?? 0) - 1}
                          onClick={() => moveFieldOption(fieldIndex, optionIndex, optionIndex + 1)}
                          aria-label="Move option down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => removeFieldOption(fieldIndex, optionIndex)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addFieldOption(fieldIndex)}>
                      <Plus className="h-4 w-4 mr-1" /> Add option
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={e => updateField(fieldIndex, {required: e.target.checked})}
                      className="rounded"
                    />
                    Required
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeField(field.clientId)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="h-4 w-4 mr-1" /> Add field
          </Button>
        </CardContent>
      </Card>

      <FormEditorCollapsibleCard
        title="Appearance"
        description="Palettes fill every color; you can override a token after."
        hint={appearanceHint(settings)}
        open={appearanceOpen}
        onOpenChange={setAppearanceOpen}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORM_COLOR_THEME_LIST.map(theme => {
            const active = getActiveFormColorThemeId(settings) === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSettings(s => ({...s, ...applyFormColorTheme(theme.id)}))}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-md border p-2 text-xs font-medium transition-colors',
                  active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-neutral-200 hover:border-neutral-300',
                )}
              >
                <span className="flex h-8 w-full overflow-hidden rounded border border-neutral-200">
                  <span className="flex-1" style={{backgroundColor: theme.formBackgroundColor}} />
                  <span className="flex-1" style={{backgroundColor: theme.buttonColor}} />
                  <span className="flex-1" style={{backgroundColor: theme.titleColor}} />
                </span>
                {theme.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FORM_COLOR_TOKEN_FIELDS.map(field => (
            <FormColorField
              key={field.key}
              id={field.key}
              label={field.label}
              value={settings[field.key]}
              fallback={FORM_APPEARANCE_DEFAULTS[field.key]}
              onChange={value => setSettings(s => ({...s, [field.key]: value}))}
            />
          ))}
        </div>
      </FormEditorCollapsibleCard>

      <FormEditorCollapsibleCard
        title="After submit"
        description="Message and optional redirect after a successful signup"
        hint={afterSubmitHint(settings)}
        open={afterSubmitOpen}
        onOpenChange={setAfterSubmitOpen}
      >
        <div className="space-y-2">
          <Label htmlFor="successMessage">Success message</Label>
          <Input
            id="successMessage"
            value={settings.successMessage ?? ''}
            onChange={e => setSettings(s => ({...s, successMessage: e.target.value}))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="redirectUrl">Redirect URL (optional)</Label>
          <Input
            id="redirectUrl"
            type="url"
            value={settings.redirectUrl ?? ''}
            onChange={e => setSettings(s => ({...s, redirectUrl: e.target.value || undefined}))}
            placeholder="https://yoursite.com/thanks"
          />
        </div>
      </FormEditorCollapsibleCard>

      <FormEditorCollapsibleCard
        title="Destination"
        description="Where signups go after submit"
        hint={destinationHint(destinationTab, tags)}
        open={destinationOpen}
        onOpenChange={setDestinationOpen}
      >
          <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setDestinationTab('dynamic')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                destinationTab === 'dynamic' ? 'bg-white shadow text-neutral-900' : 'text-neutral-600'
              }`}
            >
              Dynamic (tags)
            </button>
            <button
              type="button"
              onClick={() => setDestinationTab('static')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                destinationTab === 'static' ? 'bg-white shadow text-neutral-900' : 'text-neutral-600'
              }`}
            >
              Static segment
            </button>
          </div>

          {destinationTab === 'dynamic' ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Tags are written to <code className="bg-neutral-100 px-1 rounded">contact.data</code> on every submit.
                Create a dynamic segment filtering on these tags — e.g.{' '}
                <code className="bg-neutral-100 px-1 rounded">data.form:{slug || 'slug'} equals true</code> or{' '}
                <code className="bg-neutral-100 px-1 rounded">data.source equals newsletter</code>.
              </p>
              <p className="text-sm text-neutral-500">
                Event <code className="bg-neutral-100 px-1 rounded">form.submitted</code> is tracked for workflows.
              </p>
              {tags.map((tag, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={tag.key}
                    onChange={e => updateTag(index, {key: e.target.value})}
                    placeholder="key"
                    className="sm:w-40"
                  />
                  <Input
                    value={tag.value}
                    onChange={e => updateTag(index, {value: e.target.value})}
                    placeholder="value"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => removeTag(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                <Plus className="h-4 w-4 mr-1" /> Add tag
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createSegment}
                  onChange={e => setCreateSegment(e.target.checked)}
                  className="rounded"
                />
                Create new static segment automatically
              </label>
              {!createSegment && (
                <div className="space-y-2">
                  <Label>Link to existing static segment</Label>
                  <select
                    value={segmentId}
                    onChange={e => setSegmentId(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select segment...</option>
                    {staticSegments.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-sm text-neutral-500">
                Static membership is added directly on submit. Tags and events are still written for workflows.
              </p>
            </div>
          )}
      </FormEditorCollapsibleCard>

      <FormEditorCollapsibleCard
        title="Options"
        description="Confirmation email and address checks"
        hint={optionsHint(settings)}
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
      >
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.doubleOptIn ?? false}
              onChange={e => setSettings(s => ({...s, doubleOptIn: e.target.checked}))}
              className="rounded mt-0.5"
            />
            <span>
              <span className="font-medium">Send confirmation email (double opt-in)</span>
              <span className="block text-neutral-500">
                Creates the contact as unsubscribed and sends a transactional confirmation with{' '}
                <code className="bg-neutral-100 px-1 rounded">{'{{subscribeUrl}}'}</code>.
              </span>
            </span>
          </label>
          {settings.doubleOptIn ? (
            <ConfirmationTemplatePicker
              templateId={settings.confirmationTemplateId ?? confirmation.templateId}
              onTemplateIdChange={id => setSettings(s => ({...s, confirmationTemplateId: id}))}
              templates={confirmation.templates}
              selected={
                confirmation.templates.find(
                  template => template.id === (settings.confirmationTemplateId ?? confirmation.templateId),
                ) ?? confirmation.selected
              }
              isLoading={confirmation.isLoading}
            />
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.verifyEmail ?? false}
              onChange={e => setSettings(s => ({...s, verifyEmail: e.target.checked}))}
              className="rounded mt-0.5"
            />
            <span>
              <span className="font-medium">Validate email</span>
              <span className="block text-neutral-500">Reject disposable addresses and invalid domains</span>
            </span>
          </label>
      </FormEditorCollapsibleCard>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          <Save className="h-4 w-4 mr-2" />
          {mode === 'create' ? 'Create form' : 'Save changes'}
        </Button>
      </div>
      </form>

      <aside className="hidden lg:block sticky top-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-700">Form preview</p>
            <div className="flex gap-1 p-0.5 bg-neutral-100 rounded-md">
              <button
                type="button"
                onClick={() => setPreviewMode('edit')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  previewMode === 'edit' ? 'bg-white shadow text-neutral-900' : 'text-neutral-600'
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('preview')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  previewMode === 'preview' ? 'bg-white shadow text-neutral-900' : 'text-neutral-600'
                }`}
              >
                Preview
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4 border">
            {previewMode === 'edit' ? (
              <FormPreviewEditor
                name={name}
                settings={{...settings, fieldOrder: toPersistedFieldOrder(fieldOrder, fields)}}
                fields={fields}
                fieldOrder={fieldOrder}
                onSettingsChange={patch => setSettings(s => ({...s, ...patch}))}
                onFieldUpdate={updateFieldByClientId}
                onFieldOrderChange={setFieldOrder}
                onAddField={addField}
                onRemoveField={removeField}
              />
            ) : (
              <FormPreview
                name={name}
                settings={{...settings, fieldOrder: toPersistedFieldOrder(fieldOrder, fields)}}
                fields={toPersistedFields(fields)}
                disabled
                compact
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
