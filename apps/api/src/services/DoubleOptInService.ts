import type {Contact} from '@merlin/db';
import signale from 'signale';

import {ContactService} from './ContactService.js';
import {EmailService} from './EmailService.js';
import {TemplateService} from './TemplateService.js';

export class DoubleOptInService {
  /**
   * Create or update a contact for double opt-in without downgrading
   * an existing subscription. Sends a confirmation email only for new contacts.
   */
  public static async apply(
    projectId: string,
    input: {
      email: string;
      data?: Record<string, unknown>;
      confirmationTemplateId?: string;
    },
  ): Promise<{contact: Contact; isUpdate: boolean; confirmationSent: boolean}> {
    const {email, data, confirmationTemplateId} = input;

    const template = await TemplateService.resolveConfirmationTemplate(projectId, confirmationTemplateId);

    const existingContact = await ContactService.findByEmail(projectId, email);
    const isUpdate = !!existingContact;
    const contact = await ContactService.upsert(projectId, email, data, undefined, false);

    if (isUpdate) {
      return {contact, isUpdate, confirmationSent: false};
    }

    try {
      await EmailService.sendTemplateEmail(projectId, contact.id, template);
      return {contact, isUpdate, confirmationSent: true};
    } catch (error) {
      signale.error(`[DOI] Failed to send confirmation email to ${contact.email}:`, error);
      return {contact, isUpdate, confirmationSent: false};
    }
  }
}
