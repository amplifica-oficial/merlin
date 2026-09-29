import {AnimatePresence, motion} from 'framer-motion';
import React, {useEffect, useState} from 'react';

import {
  FORM_EMAIL_FIELD_KEY,
  FormPreviewCustomField,
  FormPreviewEmailField,
  FormPreviewHeader,
  FormPreviewShell,
  FormPreviewSubmitButton,
} from './formPreviewParts';
import type {FormFieldValues} from './formPreviewShared';
import {FORM_REDIRECT_COUNTDOWN_SECONDS, resolveFieldOrder, tickRedirectCountdown} from './formPreviewShared';
import type {FormField, FormSettings} from '@merlin/types';

export type {FormFieldValues};
export {
  BRAZILIAN_STATES,
  FORM_EMAIL_FIELD_KEY,
  FORM_FIELD_TYPE_OPTIONS,
  FORM_SELECT_OPTIONS_MAX,
  createEditorClientId,
  hydrateEditorFieldOrder,
  insertPastedOptions,
  parseFormButtonHexColor,
  parsePastedOptions,
  reorderFieldsFromOrder,
  sortOptionsAlphabetically,
  resolveEditorFieldOrder,
  resolveFieldOrder,
  toEditorFields,
  toPersistedFieldOrder,
  toPersistedFields,
} from './formPreviewShared';
export type {EditorFormField} from './formPreviewShared';

export interface FormPreviewProps {
  name: string;
  settings: FormSettings;
  fields: FormField[];
  email?: string;
  fieldValues?: FormFieldValues;
  onEmailChange?: (email: string) => void;
  onFieldChange?: (key: string, value: string | number | boolean) => void;
  onSubmit?: (e: React.FormEvent) => void;
  submitting?: boolean;
  error?: string | null;
  success?: boolean;
  disabled?: boolean;
  showHoneypot?: boolean;
  hp?: string;
  onHpChange?: (hp: string) => void;
  compact?: boolean;
  redirectUrl?: string;
}

export function FormPreview({
  name,
  settings,
  fields,
  email = '',
  fieldValues = {},
  onEmailChange,
  onFieldChange,
  onSubmit,
  submitting = false,
  error = null,
  success = false,
  disabled = false,
  showHoneypot = false,
  hp = '',
  onHpChange,
  compact = false,
  redirectUrl,
}: FormPreviewProps) {
  const successMessage = settings.successMessage || 'Thanks for signing up!';
  const isInteractive = !disabled && !!onSubmit;
  const fieldDisabled = disabled || !onFieldChange;
  const orderedKeys = resolveFieldOrder(settings.fieldOrder, fields);
  const fieldsByKey = new Map(fields.map(f => [f.key, f]));
  const [redirectSeconds, setRedirectSeconds] = useState(FORM_REDIRECT_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!success || !redirectUrl) {
      return;
    }

    setRedirectSeconds(FORM_REDIRECT_COUNTDOWN_SECONDS);
    const interval = window.setInterval(() => {
      setRedirectSeconds(prev => {
        const next = tickRedirectCountdown(prev);
        if (next.shouldRedirect) {
          window.clearInterval(interval);
          window.location.href = redirectUrl;
        }
        return next.seconds;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [success, redirectUrl]);

  if (success) {
    return (
      <div className={compact ? '' : 'min-h-[200px] flex items-center justify-center'}>
        <FormPreviewShell>
          <div className="text-center">
            <motion.div
              initial={{scale: 0}}
              animate={{scale: 1}}
              className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"
            >
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <h2 className="text-xl font-bold text-neutral-900">{successMessage}</h2>
            {redirectUrl ? (
              <p className="mt-3 text-sm text-neutral-500">
                {redirectSeconds > 0 ? `Redirecting in ${redirectSeconds}...` : 'Redirecting...'}
              </p>
            ) : null}
          </div>
        </FormPreviewShell>
      </div>
    );
  }

  const body = (
    <>
      <FormPreviewHeader name={name} settings={settings} compact={compact} />

      {showHoneypot && (
        <input
          type="text"
          name="hp"
          value={hp}
          onChange={e => onHpChange?.(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute opacity-0 pointer-events-none h-0 w-0"
          aria-hidden
        />
      )}

      {orderedKeys.map(orderKey => {
        if (orderKey === FORM_EMAIL_FIELD_KEY) {
          return (
            <FormPreviewEmailField
              key={orderKey}
              settings={settings}
              email={email}
              onEmailChange={onEmailChange}
              disabled={fieldDisabled}
            />
          );
        }

        const field = fieldsByKey.get(orderKey);
        if (!field) return null;

        return (
          <FormPreviewCustomField
            key={field.key}
            field={field}
            value={fieldValues[field.key]}
            onChange={onFieldChange}
            disabled={fieldDisabled}
          />
        );
      })}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{opacity: 0, y: -10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -10}}
            className="text-sm font-medium text-red-500 text-center"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <FormPreviewSubmitButton
        interactive={isInteractive}
        submitting={submitting}
        disabled={disabled}
        settings={settings}
      />
    </>
  );

  if (isInteractive) {
    return (
      <FormPreviewShell>
        <form onSubmit={e => onSubmit?.(e)} className="space-y-6 relative">
          {body}
        </form>
      </FormPreviewShell>
    );
  }

  return <FormPreviewShell>{body}</FormPreviewShell>;
}
