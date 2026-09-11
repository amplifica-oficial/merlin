import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TemplateType} from '@merlin/db';

import {factories, getPrismaClient} from '../../../../../test/helpers';
import {EmailService} from '../EmailService.js';
import {FormService} from '../FormService.js';

vi.mock('../EmailService.js', () => ({
  EmailService: {
    sendTemplateEmail: vi.fn().mockResolvedValue({id: 'email-1'}),
  },
}));

describe('FormService.submit double opt-in', () => {
  let projectId: string;
  const prisma = getPrismaClient();
  const sendTemplateEmailMock = vi.mocked(EmailService.sendTemplateEmail);

  beforeEach(async () => {
    sendTemplateEmailMock.mockClear();
    const {project} = await factories.createUserWithProject();
    projectId = project.id;
  });

  async function createForm(settings: Record<string, unknown>) {
    return FormService.create(projectId, {
      name: 'Newsletter',
      slug: `newsletter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fields: [],
      settings,
    });
  }

  it('creates an unsubscribed contact and sends a confirmation email', async () => {
    const template = await factories.createTemplate({
      projectId,
      type: TemplateType.TRANSACTIONAL,
    });
    const form = await createForm({
      doubleOptIn: true,
      confirmationTemplateId: template.id,
    });

    await FormService.submit(form.publicId, {email: 'new-doi@example.com'}, '127.0.0.1');

    const contact = await prisma.contact.findFirst({
      where: {projectId, email: 'new-doi@example.com'},
    });
    expect(contact?.subscribed).toBe(false);
    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      projectId,
      contact?.id,
      expect.objectContaining({id: template.id}),
    );
  });

  it('seeds the default template when confirmationTemplateId is omitted', async () => {
    const form = await createForm({doubleOptIn: true});

    await FormService.submit(form.publicId, {email: 'lazy-doi@example.com'}, '127.0.0.1');

    const defaults = await prisma.template.findMany({
      where: {projectId, name: 'Confirm your subscription'},
    });
    expect(defaults).toHaveLength(1);

    const contact = await prisma.contact.findFirst({
      where: {projectId, email: 'lazy-doi@example.com'},
    });
    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      projectId,
      contact?.id,
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
    const form = await createForm({
      doubleOptIn: true,
      confirmationTemplateId: template.id,
    });

    await FormService.submit(form.publicId, {email: existing.email}, '127.0.0.1');

    const contact = await prisma.contact.findFirst({
      where: {id: existing.id},
    });
    expect(contact?.subscribed).toBe(true);
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();
  });

  it('rejects a marketing confirmation template', async () => {
    const template = await factories.createTemplate({
      projectId,
      type: TemplateType.MARKETING,
    });
    const form = await createForm({
      doubleOptIn: true,
      confirmationTemplateId: template.id,
    });

    await expect(
      FormService.submit(form.publicId, {email: 'bad-template@example.com'}, '127.0.0.1'),
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
    const form = await createForm({doubleOptIn: false});

    await FormService.submit(form.publicId, {email: 'plain@example.com'}, '127.0.0.1');

    const contact = await prisma.contact.findFirst({
      where: {projectId, email: 'plain@example.com'},
    });
    expect(contact?.subscribed).toBe(true);
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();
  });
});
