import { randomUUID } from 'crypto';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError } from '../middleware/errors';

/**
 * Email templates for an organisation.
 *
 * Stored inside the organisations.settings JSONB column under the
 * `emailTemplates` key as a map of template name to its override, alongside the
 * organisation's other settings (address, contact details, paymentSettings,
 * branding). Only customised templates are stored; anything not overridden
 * falls back to the platform default, so a new template type becomes available
 * to every organisation without a data migration.
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface StoredEmailTemplate {
  id: string;
  subject: string;
  body: string;
  updatedAt?: string;
}

/**
 * The template types an organisation can customise. Must stay in step with
 * TEMPLATE_TYPES in the org admin's EmailTemplatesTab, and with whatever
 * email.service sends.
 */
export const DEFAULT_EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: 'Welcome to {{organisation_name}}',
    body: 'Dear {{user_name}},\n\nWelcome to {{organisation_name}}!\n\nBest regards,\nThe Team',
  },
  event_confirmation: {
    subject: 'Event Entry Confirmation - {{event_name}}',
    body:
      'Dear {{user_name}},\n\nYour entry for {{event_name}} has been confirmed.\n\n' +
      'Event Details:\n- Date: {{event_date}}\n- Activity: {{activity_name}}\n\n' +
      'Best regards,\n{{organisation_name}}',
  },
  payment_receipt: {
    subject: 'Payment Receipt - {{organisation_name}}',
    body:
      'Dear {{user_name}},\n\nThank you for your payment.\n\n' +
      'Amount: {{amount}}\nReference: {{reference}}\n\n' +
      'Best regards,\n{{organisation_name}}',
  },
  membership_confirmation: {
    subject: 'Membership Confirmation - {{organisation_name}}',
    body:
      'Dear {{user_name}},\n\nYour membership has been confirmed.\n\n' +
      'Membership Type: {{membership_type}}\nValid Until: {{expiry_date}}\n\n' +
      'Best regards,\n{{organisation_name}}',
  },
  password_reset: {
    subject: 'Password Reset Request',
    body:
      'Dear {{user_name}},\n\nYou have requested to reset your password.\n\n' +
      'Click here to reset: {{reset_link}}\n\nBest regards,\n{{organisation_name}}',
  },
};

export const EMAIL_TEMPLATE_NAMES = Object.keys(DEFAULT_EMAIL_TEMPLATES);

const MAX_SUBJECT_LENGTH = 500;
const MAX_BODY_LENGTH = 20000;

export interface EmailTemplateUpdate {
  name: string;
  subject: string;
  body: string;
}

/**
 * Validate an incoming template update. Unknown template names are rejected so
 * the settings JSONB cannot be used as arbitrary client-controlled storage.
 */
function sanitizeEmailTemplate(data: any): EmailTemplateUpdate {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Email template must be an object');
  }

  const { name, subject, body } = data;

  if (typeof name !== 'string' || !EMAIL_TEMPLATE_NAMES.includes(name)) {
    throw new ValidationError('Unknown email template name', [
      { field: 'name', message: `Must be one of: ${EMAIL_TEMPLATE_NAMES.join(', ')}` },
    ]);
  }

  if (typeof subject !== 'string' || subject.trim() === '') {
    throw new ValidationError('Email template subject is required', [
      { field: 'subject', message: 'Subject is required' },
    ]);
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new ValidationError('Email template subject is too long', [
      { field: 'subject', message: `Must be at most ${MAX_SUBJECT_LENGTH} characters` },
    ]);
  }

  if (typeof body !== 'string' || body.trim() === '') {
    throw new ValidationError('Email template body is required', [
      { field: 'body', message: 'Body is required' },
    ]);
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new ValidationError('Email template body is too long', [
      { field: 'body', message: `Must be at most ${MAX_BODY_LENGTH} characters` },
    ]);
  }

  return { name, subject, body };
}

export class OrganizationEmailTemplatesService {
  /**
   * Every template the organisation can use: its own overrides where present,
   * platform defaults otherwise. Templates that have never been customised are
   * returned with a deterministic `default:<name>` id so the caller can tell
   * the two apart.
   */
  async getEmailTemplates(organizationId: string): Promise<EmailTemplate[]> {
    const stored = await this.loadStoredTemplates(organizationId);

    return EMAIL_TEMPLATE_NAMES.map((name) => {
      const override = stored[name];
      if (override) {
        return {
          id: override.id || `default:${name}`,
          name,
          subject: override.subject,
          body: override.body,
        };
      }
      return {
        id: `default:${name}`,
        name,
        subject: DEFAULT_EMAIL_TEMPLATES[name].subject,
        body: DEFAULT_EMAIL_TEMPLATES[name].body,
      };
    });
  }

  /**
   * Resolve a single template, falling back to the platform default. Intended
   * for email.service when sending.
   */
  async getEmailTemplate(organizationId: string, name: string): Promise<EmailTemplate | null> {
    if (!EMAIL_TEMPLATE_NAMES.includes(name)) {
      return null;
    }
    const templates = await this.getEmailTemplates(organizationId);
    return templates.find((template) => template.name === name) || null;
  }

  /**
   * Create or replace one template override.
   *
   * Uses jsonb_set on the individual template key so saving one template
   * neither disturbs the others nor the rest of the organisation's settings.
   */
  async updateEmailTemplate(organizationId: string, data: EmailTemplateUpdate): Promise<EmailTemplate> {
    const { name, subject, body } = sanitizeEmailTemplate(data);

    const stored = await this.loadStoredTemplates(organizationId);
    const existingId = stored[name]?.id;
    const id = existingId && !existingId.startsWith('default:') ? existingId : randomUUID();

    const value: StoredEmailTemplate = {
      id,
      subject,
      body,
      updatedAt: new Date().toISOString(),
    };

    const result = await db.query(
      `UPDATE organizations
       SET settings = jsonb_set(
             jsonb_set(COALESCE(settings, '{}'::jsonb), '{emailTemplates}',
                       COALESCE(settings -> 'emailTemplates', '{}'::jsonb), true),
             ARRAY['emailTemplates', $1], $2::jsonb, true
           ),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [name, JSON.stringify(value), organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    logger.info(`Email template "${name}" updated for organization ${organizationId}`);
    return { id, name, subject, body };
  }

  /**
   * Remove an override so the template reverts to the platform default.
   */
  async resetEmailTemplate(organizationId: string, name: string): Promise<EmailTemplate> {
    if (!EMAIL_TEMPLATE_NAMES.includes(name)) {
      throw new ValidationError('Unknown email template name', [
        { field: 'name', message: `Must be one of: ${EMAIL_TEMPLATE_NAMES.join(', ')}` },
      ]);
    }

    const result = await db.query(
      `UPDATE organizations
       SET settings = COALESCE(settings, '{}'::jsonb) #- ARRAY['emailTemplates', $1],
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [name, organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    logger.info(`Email template "${name}" reset to default for organization ${organizationId}`);
    return {
      id: `default:${name}`,
      name,
      subject: DEFAULT_EMAIL_TEMPLATES[name].subject,
      body: DEFAULT_EMAIL_TEMPLATES[name].body,
    };
  }

  private async loadStoredTemplates(
    organizationId: string
  ): Promise<Record<string, StoredEmailTemplate>> {
    const result = await db.query('SELECT settings FROM organizations WHERE id = $1', [
      organizationId,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const settings = result.rows[0].settings || {};
    const stored = settings.emailTemplates;
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  }
}

export const organizationEmailTemplatesService = new OrganizationEmailTemplatesService();
