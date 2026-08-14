import {
  OrganizationBrandingService,
  DEFAULT_BRANDING_SETTINGS,
} from '../organization-branding.service';
import { ValidationError } from '../../middleware/errors';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
/*
 * Signing is AWS SDK crypto over real credentials, which a unit test has none
 * of. Stubbed so the test can assert that the key is *signed* rather than
 * returned raw — `resolveLogoUrl` deliberately swallows signing failures and
 * returns '', so without this the assertion would pass vacuously on the
 * fallback path.
 */
jest.mock('../file-upload.service', () => ({
  fileUploadService: {
    getFileUrl: jest.fn(async (key: string) => `https://signed.test/${key}?X-Amz-Signature=abc`),
  },
}));
jest.mock('../../config/logger');

describe('OrganizationBrandingService', () => {
  let service: OrganizationBrandingService;
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG_ID = 'org-1';

  beforeEach(() => {
    service = new OrganizationBrandingService();
    jest.clearAllMocks();
  });

  describe('getBrandingSettings', () => {
    it('returns the defaults when the organisation has no settings at all', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ settings: null }] });

      const result = await service.getBrandingSettings(ORG_ID);

      expect(result).toEqual(DEFAULT_BRANDING_SETTINGS);
    });

    it('returns the defaults when the organisation has settings but no branding', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValue({ rows: [{ settings: { paymentSettings: { stripeEnabled: true } } }] });

      const result = await service.getBrandingSettings(ORG_ID);

      expect(result).toEqual(DEFAULT_BRANDING_SETTINGS);
    });

    it('merges stored branding over the defaults', async () => {
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [{ settings: { branding: { primaryColor: '#123456', logoUrl: 'https://x/logo.png' } } }],
      });

      const result = await service.getBrandingSettings(ORG_ID);

      expect(result.primaryColor).toBe('#123456');
      expect(result.logoUrl).toBe('https://x/logo.png');
      // Untouched fields still come from the defaults
      expect(result.secondaryColor).toBe(DEFAULT_BRANDING_SETTINGS.secondaryColor);
      expect(result.textColor).toBe(DEFAULT_BRANDING_SETTINGS.textColor);
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(service.getBrandingSettings('missing')).rejects.toThrow('Organization not found');
    });
  });

  describe('updateBrandingSettings', () => {
    beforeEach(() => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ id: ORG_ID }] });
    });

    it('persists the merged settings and returns them', async () => {
      const result = await service.updateBrandingSettings(ORG_ID, {
        primaryColor: '#ABCDEF',
        logoUrl: 'https://cdn/logo.png',
      });

      expect(result.primaryColor).toBe('#abcdef');
      expect(result.logoUrl).toBe('https://cdn/logo.png');
      expect(result.accentColor).toBe(DEFAULT_BRANDING_SETTINGS.accentColor);

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('jsonb_set');
      expect(sql).toContain("'{branding}'");
      expect(JSON.parse(params[0])).toEqual(result);
    });

    it('stores a club’s own word for its bookings area', async () => {
      const result = await service.updateBrandingSettings(ORG_ID, {
        bookingsLabel: '  Court Booking  ',
      });

      // Trimmed, because it is rendered straight into a menu.
      expect(result.bookingsLabel).toBe('Court Booking');
    });

    it('treats a cleared label as unset rather than as a blank menu', async () => {
      const result = await service.updateBrandingSettings(ORG_ID, { bookingsLabel: '   ' });

      expect(result.bookingsLabel).toBe('');
    });

    it('refuses a label too long for a navigation rail', async () => {
      await expect(
        service.updateBrandingSettings(ORG_ID, { bookingsLabel: 'x'.repeat(41) })
      ).rejects.toThrow(/too long/i);
    });

    it('refuses a label that is not a string', async () => {
      await expect(
        service.updateBrandingSettings(ORG_ID, { bookingsLabel: 42 } as any)
      ).rejects.toThrow(/must be a string/i);
    });

    it('writes only the branding key so other settings survive', async () => {
      await service.updateBrandingSettings(ORG_ID, { primaryColor: '#000000' });

      const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
      // jsonb_set on a single key, rather than replacing the whole column
      expect(sql).toContain("COALESCE(settings, '{}'::jsonb)");
      expect(sql).not.toMatch(/SET settings = \$1/);
    });

    it('ignores unknown keys rather than persisting them', async () => {
      await service.updateBrandingSettings(ORG_ID, {
        primaryColor: '#111111',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ evil: 'value', paymentSettings: { stripeSecretKey: 'leak' } } as any),
      });

      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      const persisted = JSON.parse(params[0]);
      expect(persisted).not.toHaveProperty('evil');
      expect(persisted).not.toHaveProperty('paymentSettings');
      expect(Object.keys(persisted).sort()).toEqual(Object.keys(DEFAULT_BRANDING_SETTINGS).sort());
    });

    it('accepts three-digit hex colours', async () => {
      const result = await service.updateBrandingSettings(ORG_ID, { primaryColor: '#ABC' });

      expect(result.primaryColor).toBe('#abc');
    });

    it('treats an empty colour as "leave at default"', async () => {
      const result = await service.updateBrandingSettings(ORG_ID, { primaryColor: '' });

      expect(result.primaryColor).toBe(DEFAULT_BRANDING_SETTINGS.primaryColor);
    });

    it.each([
      ['not-a-colour'],
      ['#12345'],
      ['rgb(1,2,3)'],
      ['#GGGGGG'],
      ['1976d2'],
    ])('rejects the invalid colour %s', async (colour) => {
      await expect(
        service.updateBrandingSettings(ORG_ID, { primaryColor: colour })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a non-string logo URL', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service.updateBrandingSettings(ORG_ID, { logoUrl: 42 } as any)
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects an over-long logo URL', async () => {
      await expect(
        service.updateBrandingSettings(ORG_ID, { logoUrl: `https://x/${'a'.repeat(2100)}` })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a non-object payload', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(service.updateBrandingSettings(ORG_ID, 'nope' as any)).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(
        service.updateBrandingSettings('missing', { primaryColor: '#123456' })
      ).rejects.toThrow('Organization not found');
    });
  });
});

/**
 * The logo is stored as an S3 key and signed on read.
 *
 * The bucket blocks public access, so there is no permanent URL to persist —
 * and a signed one would expire within the hour, giving every organisation a
 * logo that worked briefly and then broke.
 */
describe('logo resolution', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  it('signs the stored key rather than returning it raw', async () => {
    const service = new OrganizationBrandingService();
    mockDb.query = jest.fn().mockResolvedValue({
      rows: [
        {
          settings: {
            branding: { logoS3Key: 'organisations/org-1/branding/logo_1.png', primaryColor: '#123456' },
          },
        },
      ],
    });

    const branding = await service.getBrandingSettings('org-1');

    expect(branding.logoUrl).toContain('logo_1.png');
    expect(branding.logoUrl).not.toBe('organisations/org-1/branding/logo_1.png');
  });

  /** An externally hosted logo has no key and must pass through untouched. */
  it('leaves an externally hosted logoUrl alone', async () => {
    const service = new OrganizationBrandingService();
    mockDb.query = jest.fn().mockResolvedValue({
      rows: [{ settings: { branding: { logoUrl: 'https://example.test/logo.png' } } }],
    });

    const branding = await service.getBrandingSettings('org-1');

    expect(branding.logoUrl).toBe('https://example.test/logo.png');
  });

  /**
   * A key confined to the organisation's own branding prefix. The client echoes
   * this value back on save, so without the check an organisation could name
   * any object in the bucket and have the server sign a URL for it.
   */
  it('refuses a key outside the branding prefix', async () => {
    const service = new OrganizationBrandingService();
    mockDb.query = jest.fn().mockResolvedValue({ rows: [{ id: 'org-1' }] });

    await expect(
      service.updateBrandingSettings('org-1', {
        logoS3Key: 'organisations/other-org/private/secrets.pdf',
      } as any)
    ).rejects.toThrow(ValidationError);
  });
});
