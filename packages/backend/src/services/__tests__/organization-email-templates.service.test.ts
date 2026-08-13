import {
  OrganizationEmailTemplatesService,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_NAMES,
} from '../organization-email-templates.service';
import { ValidationError } from '../../middleware/errors';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('OrganizationEmailTemplatesService', () => {
  let service: OrganizationEmailTemplatesService;
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG_ID = 'org-1';

  beforeEach(() => {
    service = new OrganizationEmailTemplatesService();
    jest.clearAllMocks();
  });

  const withSettings = (settings: any) =>
    jest.fn().mockResolvedValue({ rows: [{ settings }] });

  describe('getEmailTemplates', () => {
    it('returns every known template when nothing has been customised', async () => {
      mockDb.query = withSettings(null);

      const result = await service.getEmailTemplates(ORG_ID);

      expect(result).toHaveLength(EMAIL_TEMPLATE_NAMES.length);
      expect(result.map((t) => t.name).sort()).toEqual([...EMAIL_TEMPLATE_NAMES].sort());
    });

    it('returns platform defaults with a default: id for uncustomised templates', async () => {
      mockDb.query = withSettings({});

      const result = await service.getEmailTemplates(ORG_ID);
      const welcome = result.find((t) => t.name === 'welcome')!;

      expect(welcome.id).toBe('default:welcome');
      expect(welcome.subject).toBe(DEFAULT_EMAIL_TEMPLATES.welcome.subject);
      expect(welcome.body).toBe(DEFAULT_EMAIL_TEMPLATES.welcome.body);
    });

    it('returns the organisation override where one exists', async () => {
      mockDb.query = withSettings({
        emailTemplates: {
          welcome: { id: 'uuid-1', subject: 'Custom subject', body: 'Custom body' },
        },
      });

      const result = await service.getEmailTemplates(ORG_ID);
      const welcome = result.find((t) => t.name === 'welcome')!;
      const other = result.find((t) => t.name === 'payment_receipt')!;

      expect(welcome).toEqual({
        id: 'uuid-1',
        name: 'welcome',
        subject: 'Custom subject',
        body: 'Custom body',
      });
      // Templates without an override still come back as defaults
      expect(other.id).toBe('default:payment_receipt');
    });

    it('ignores a malformed emailTemplates value instead of throwing', async () => {
      mockDb.query = withSettings({ emailTemplates: 'not-an-object' });

      const result = await service.getEmailTemplates(ORG_ID);

      expect(result).toHaveLength(EMAIL_TEMPLATE_NAMES.length);
      expect(result.every((t) => t.id.startsWith('default:'))).toBe(true);
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(service.getEmailTemplates('missing')).rejects.toThrow('Organization not found');
    });
  });

  describe('getEmailTemplate', () => {
    it('resolves a single template', async () => {
      mockDb.query = withSettings({
        emailTemplates: { welcome: { id: 'uuid-1', subject: 'S', body: 'B' } },
      });

      const result = await service.getEmailTemplate(ORG_ID, 'welcome');

      expect(result).toEqual({ id: 'uuid-1', name: 'welcome', subject: 'S', body: 'B' });
    });

    it('returns null for an unknown template name without querying', async () => {
      mockDb.query = jest.fn();

      const result = await service.getEmailTemplate(ORG_ID, 'nope');

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('updateEmailTemplate', () => {
    beforeEach(() => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ settings: {} }] }) // loadStoredTemplates
        .mockResolvedValueOnce({ rows: [{ id: ORG_ID }] }); // UPDATE
    });

    it('stores the override and returns the saved template', async () => {
      const result = await service.updateEmailTemplate(ORG_ID, {
        name: 'welcome',
        subject: 'Hello',
        body: 'Body text',
      });

      expect(result.name).toBe('welcome');
      expect(result.subject).toBe('Hello');
      expect(result.body).toBe('Body text');
      expect(result.id).not.toBe('default:welcome');

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[1];
      expect(sql).toContain("ARRAY['emailTemplates', $1]");
      expect(params[0]).toBe('welcome');
      const stored = JSON.parse(params[1]);
      expect(stored.subject).toBe('Hello');
      expect(stored.body).toBe('Body text');
      expect(stored.updatedAt).toEqual(expect.any(String));
    });

    it('writes only the one template key so sibling templates survive', async () => {
      await service.updateEmailTemplate(ORG_ID, { name: 'welcome', subject: 'S', body: 'B' });

      const [sql] = (mockDb.query as jest.Mock).mock.calls[1];
      expect(sql).toContain("COALESCE(settings, '{}'::jsonb)");
      expect(sql).toContain("COALESCE(settings -> 'emailTemplates', '{}'::jsonb)");
    });

    it('keeps the existing id when re-saving an already customised template', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { settings: { emailTemplates: { welcome: { id: 'uuid-existing', subject: 'a', body: 'b' } } } },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ id: ORG_ID }] });

      const result = await service.updateEmailTemplate(ORG_ID, {
        name: 'welcome',
        subject: 'New',
        body: 'New body',
      });

      expect(result.id).toBe('uuid-existing');
    });

    it('allocates a real id when the stored id is a default placeholder', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { settings: { emailTemplates: { welcome: { id: 'default:welcome', subject: 'a', body: 'b' } } } },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ id: ORG_ID }] });

      const result = await service.updateEmailTemplate(ORG_ID, {
        name: 'welcome',
        subject: 'New',
        body: 'New body',
      });

      expect(result.id).not.toBe('default:welcome');
    });

    it('rejects an unknown template name', async () => {
      await expect(
        service.updateEmailTemplate(ORG_ID, { name: 'arbitrary_key', subject: 'S', body: 'B' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it.each([
      ['empty subject', { name: 'welcome', subject: '', body: 'B' }],
      ['whitespace subject', { name: 'welcome', subject: '   ', body: 'B' }],
      ['empty body', { name: 'welcome', subject: 'S', body: '' }],
      ['whitespace body', { name: 'welcome', subject: 'S', body: '  ' }],
    ])('rejects %s', async (_label, payload) => {
      await expect(service.updateEmailTemplate(ORG_ID, payload as any)).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('rejects an over-long subject', async () => {
      await expect(
        service.updateEmailTemplate(ORG_ID, { name: 'welcome', subject: 'x'.repeat(501), body: 'B' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects an over-long body', async () => {
      await expect(
        service.updateEmailTemplate(ORG_ID, {
          name: 'welcome',
          subject: 'S',
          body: 'x'.repeat(20001),
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a non-object payload', async () => {
      await expect(service.updateEmailTemplate(ORG_ID, 'nope' as any)).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ settings: {} }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateEmailTemplate('missing', { name: 'welcome', subject: 'S', body: 'B' })
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('resetEmailTemplate', () => {
    it('removes the override and returns the platform default', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ id: ORG_ID }] });

      const result = await service.resetEmailTemplate(ORG_ID, 'welcome');

      expect(result).toEqual({
        id: 'default:welcome',
        name: 'welcome',
        subject: DEFAULT_EMAIL_TEMPLATES.welcome.subject,
        body: DEFAULT_EMAIL_TEMPLATES.welcome.body,
      });

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain("#- ARRAY['emailTemplates', $1]");
      expect(params[0]).toBe('welcome');
    });

    it('rejects an unknown template name', async () => {
      mockDb.query = jest.fn();

      await expect(service.resetEmailTemplate(ORG_ID, 'nope')).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(service.resetEmailTemplate('missing', 'welcome')).rejects.toThrow(
        'Organization not found'
      );
    });
  });

  describe('defaults', () => {
    it('covers exactly the template types the org admin UI offers', () => {
      expect([...EMAIL_TEMPLATE_NAMES].sort()).toEqual(
        [
          'event_confirmation',
          'membership_confirmation',
          'password_reset',
          'payment_receipt',
          'welcome',
        ].sort()
      );
    });

    it('gives every default a non-empty subject and body', () => {
      for (const name of EMAIL_TEMPLATE_NAMES) {
        expect(DEFAULT_EMAIL_TEMPLATES[name].subject.trim()).not.toBe('');
        expect(DEFAULT_EMAIL_TEMPLATES[name].body.trim()).not.toBe('');
      }
    });
  });
});
