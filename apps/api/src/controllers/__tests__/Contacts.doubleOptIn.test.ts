import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TemplateType} from '@merlin/db';

import {factories, getPrismaClient} from '../../../../../test/helpers';
import {EmailService} from '../../services/EmailService.js';
import {EventService} from '../../services/EventService.js';
import {createOrUpdateContact, parseConfirmationTemplateId} from '../Contacts.js';

vi.mock('../../services/EventService.js', () => ({
  EventService: {
    trackEvent: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/EmailService.js', () => ({
  EmailService: {
    sendTemplateEmail: vi.fn().mockResolvedValue({id: 'email-1'}),
  },
}));

describe('parseConfirmationTemplateId', () => {
  it('returns undefined for empty values', () => {
    expect(parseConfirmationTemplateId(undefined)).toBeUndefined();
    expect(parseConfirmationTemplateId(null)).toBeUndefined();
    expect(parseConfirmationTemplateId('')).toBeUndefined();
    expect(parseConfirmationTemplateId('   ')).toBeUndefined();
  });

  it('returns a trimmed uuid', () => {
    expect(parseConfirmationTemplateId('  11111111-1111-4111-8111-111111111111  ')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('returns invalid for non-uuid strings and non-strings', () => {
    expect(parseConfirmationTemplateId('not-a-uuid')).toBe('invalid');
    expect(parseConfirmationTemplateId(['11111111-1111-4111-8111-111111111111'])).toBe('invalid');
  });
});

describe('createOrUpdateContact double opt-in', () => {
  let projectId: string;
  const prisma = getPrismaClient();
  const trackEventMock = vi.mocked(EventService.trackEvent);
  const sendTemplateEmailMock = vi.mocked(EmailService.sendTemplateEmail);

  beforeEach(async () => {
    trackEventMock.mockClear();
    sendTemplateEmailMock.mockClear();
    const {project} = await factories.createUserWithProject();
    projectId = project.id;
  });

  it('creates an unsubscribed contact and sends a confirmation email', async () => {
    const template = await factories.createTemplate({
      projectId,
      type: TemplateType.TRANSACTIONAL,
    });

    const result = await createOrUpdateContact(projectId, {
      email: 'new-doi@example.com',
      doubleOptIn: true,
      confirmationTemplateId: template.id,
    });

    expect(result.isUpdate).toBe(false);
    expect(result.confirmationSent).toBe(true);
    expect(result.contact.subscribed).toBe(false);
    expect(trackEventMock).toHaveBeenCalledWith(projectId, 'contact.created', result.contact.id, undefined, {
      source: 'manual',
    });
    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      projectId,
      result.contact.id,
      expect.objectContaining({id: template.id}),
    );
  });

  it('seeds the default template when confirmationTemplateId is omitted', async () => {
    const result = await createOrUpdateContact(projectId, {
      email: 'lazy-doi@example.com',
      doubleOptIn: true,
    });

    expect(result.confirmationSent).toBe(true);

    const defaults = await prisma.template.findMany({
      where: {projectId, name: 'Confirm your subscription'},
    });
    expect(defaults).toHaveLength(1);
    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      projectId,
      result.contact.id,
      expect.objectContaining({id: defaults[0]?.id}),
    );
  });

  it('does not downgrade or email an existing subscribed contact', async () => {
    const existing = await factories.createContact({
      projectId,
      email: 'existing-doi@example.com',
      subscribed: true,
    });
    const template = await factories.createTemplate({
      projectId,
      type: TemplateType.TRANSACTIONAL,
    });

    const result = await createOrUpdateContact(projectId, {
      email: existing.email,
      doubleOptIn: true,
      confirmationTemplateId: template.id,
    });

    expect(result.isUpdate).toBe(true);
    expect(result.confirmationSent).toBe(false);
    expect(result.contact.subscribed).toBe(true);
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();
  });

  it('rejects a marketing confirmation template', async () => {
    const template = await factories.createTemplate({
      projectId,
      type: TemplateType.MARKETING,
    });

    await expect(
      createOrUpdateContact(projectId, {
        email: 'bad-template@example.com',
        doubleOptIn: true,
        confirmationTemplateId: template.id,
      }),
    ).rejects.toMatchObject({
      code: 400,
      message: 'Confirmation template must be transactional',
    });

    const created = await prisma.contact.findFirst({
      where: {projectId, email: 'bad-template@example.com'},
    });
    expect(created).toBeNull();
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();
  });

  it('keeps default subscribed behavior when double opt-in is off', async () => {
    const result = await createOrUpdateContact(projectId, {
      email: 'plain@example.com',
      subscribed: true,
    });

    expect(result.contact.subscribed).toBe(true);
    expect(result.confirmationSent).toBe(false);
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();
  });
});
