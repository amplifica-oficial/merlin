import type {Template} from '@merlin/db';

/**
 * Stable name used to find-or-create the per-project confirmation template.
 * Keep in sync with UI fallback selection in the contacts dialogs.
 */
export const DEFAULT_CONFIRMATION_TEMPLATE_NAME = 'Confirm your subscription';

export const DEFAULT_CONFIRMATION_TEMPLATE = {
  name: DEFAULT_CONFIRMATION_TEMPLATE_NAME,
  description: 'Sent when a contact must confirm their email (double opt-in).',
  subject: 'Please confirm your subscription',
  body: `<div style="font-family: sans-serif; line-height: 1.5; color: #171717;">
  <p>Thanks for signing up. Please confirm your email address to start receiving updates.</p>
  <p><a href="{{subscribeUrl}}" style="display: inline-block; padding: 10px 16px; background: #171717; color: #ffffff; text-decoration: none; border-radius: 6px;">Confirm my email</a></p>
  <p style="color: #737373; font-size: 14px;">If you didn't request this, you can ignore this message.</p>
</div>`,
  from: 'noreply@yourdomain.com',
  type: 'TRANSACTIONAL' as Template['type'],
} as const;

/**
 * Extensible list of templates seeded on project creation.
 * Lookup is by `name` so re-running the seed is idempotent.
 */
export const DEFAULT_PROJECT_TEMPLATES = [DEFAULT_CONFIRMATION_TEMPLATE] as const;
