import {
  OrganizationBrandingService,
  DEFAULT_BRANDING_SETTINGS,
  effectiveLogo,
  typeLogoPolicyFromRow,
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

  /**
   * The UPDATE, found by what it is rather than by where it sits.
   *
   * `mock.calls[0]` was fine while the update was the only statement, and broke
   * the moment a policy lookup ran before it — a failure that says nothing about
   * the behaviour under test.
   */
  const updateCall = () =>
    (mockDb.query as jest.Mock).mock.calls.find(([sql]: [string]) => sql.includes('jsonb_set'))!;

  const ORG_ID = 'org-1';

  beforeEach(() => {
    service = new OrganizationBrandingService();
    jest.clearAllMocks();
  });

  describe('getBrandingSettings', () => {
    it('returns the defaults when the organisation has no settings at all', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ settings: null }] });

      const result = await service.getBrandingSettings(ORG_ID);

      /*
       * The defaults, plus the two fields derived per read. They are not in
       * `DEFAULT_BRANDING_SETTINGS` because they are never stored: they say
       * where the logo came from and whether this club may change it, which
       * are facts about the organisation type rather than about the branding.
       */
      expect(result).toEqual({
        ...DEFAULT_BRANDING_SETTINGS,
        logoSource: 'none',
        canOverrideLogo: true,
      });
    });

    it('returns the defaults when the organisation has settings but no branding', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValue({ rows: [{ settings: { paymentSettings: { stripeEnabled: true } } }] });

      const result = await service.getBrandingSettings(ORG_ID);

      expect(result).toEqual({
        ...DEFAULT_BRANDING_SETTINGS,
        logoSource: 'none',
        canOverrideLogo: true,
      });
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

      const [sql, params] = updateCall();
      expect(sql).toContain('jsonb_set');
      expect(sql).toContain("'{branding}'");

      /*
       * What is stored is deliberately *not* what is returned: `logoSource` and
       * `canOverrideLogo` are derived on every read, and persisting them would
       * leave a row claiming a club may override its logo long after its type
       * stopped permitting it.
       */
      const stored = JSON.parse(params[0]);
      expect(stored).not.toHaveProperty('logoSource');
      expect(stored).not.toHaveProperty('canOverrideLogo');
      expect(stored).toEqual({
        ...result,
        logoSource: undefined,
        canOverrideLogo: undefined,
      });
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

      const [sql] = updateCall();
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

      const [, params] = updateCall();
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

/**
 * Which logo an organisation actually shows.
 *
 * A federation has one mark and every branch was uploading its own copy of it.
 * Set once at the organisation type, it is inherited — and may be locked, so a
 * branch cannot replace it.
 *
 * The order is the whole feature, and the case worth reading twice is the third
 * one: a locked type logo has to beat a logo the club had already uploaded,
 * because otherwise locking the type changes nothing for exactly the clubs it
 * was meant to bring into line.
 *
 * See docs/ORGANISATION_TYPE_LOGO.md.
 */
describe('the logo an organisation inherits', () => {
  const orgLogo = { logoS3Key: 'organisations/abc/branding/own.png', logoUrl: '' };
  const noLogo = { logoS3Key: '', logoUrl: '' };
  const sharedMark = { logoS3Key: 'organisation-types/xyz/logo.png', allowOverride: true };

  it('uses the type’s logo where the organisation has none', () => {
    const result = effectiveLogo(noLogo, sharedMark);

    expect(result.source).toBe('organisation-type');
    expect(result.s3Key).toBe('organisation-types/xyz/logo.png');
  });

  it('prefers the organisation’s own where overriding is allowed', () => {
    const result = effectiveLogo(orgLogo, sharedMark);

    expect(result.source).toBe('organisation');
    expect(result.s3Key).toBe('organisations/abc/branding/own.png');
  });

  it('lets a locked type logo beat a logo the club already had', () => {
    /*
     * The one that matters. A club that uploaded a logo before its type was
     * locked would otherwise keep showing it, so locking would bring into line
     * only the clubs that were already conforming.
     */
    const result = effectiveLogo(orgLogo, { ...sharedMark, allowOverride: false });

    expect(result.source).toBe('organisation-type');
    expect(result.canOverride).toBe(false);
  });

  it('leaves a club in control where its type has no shared mark', () => {
    /*
     * `allowOverride: false` with no logo to inherit is a dead configuration a
     * super admin can reach by ticking one box: honouring it literally would
     * leave every club in the type unable to have any logo at all.
     */
    const result = effectiveLogo(orgLogo, { logoS3Key: null, allowOverride: false });

    expect(result.source).toBe('organisation');
    expect(result.canOverride).toBe(true);
  });

  it('falls back to nothing, which renders as the organisation’s initial', () => {
    const result = effectiveLogo(noLogo, null);

    expect(result.source).toBe('none');
    expect(result.s3Key).toBe('');
  });

  it('inherits for an organisation with no type at all', () => {
    // `null` means "not joined to a type", which must never read as locked.
    expect(effectiveLogo(orgLogo, null).source).toBe('organisation');
    expect(effectiveLogo(noLogo, null).canOverride).toBe(true);
  });

  it('honours an externally-hosted logo as the organisation’s own', () => {
    // A club may point at a logo it hosts elsewhere; that is still its own.
    const result = effectiveLogo({ logoS3Key: '', logoUrl: 'https://club.example/logo.png' }, sharedMark);

    expect(result.source).toBe('organisation');
    expect(result.url).toBe('https://club.example/logo.png');
  });
});

describe('reading the type policy off a joined row', () => {
  it('treats a missing flag as permitted, never as locked', () => {
    /*
     * A LEFT JOIN that matched nothing gives nulls. Reading that as "locked"
     * would take the upload away from every organisation with no type.
     */
    expect(typeLogoPolicyFromRow({ type_logo_s3_key: null, type_allow_logo_override: null }))
      .toEqual({ logoS3Key: null, allowOverride: true });
  });

  it('reads a real lock', () => {
    expect(typeLogoPolicyFromRow({ type_logo_s3_key: 'k', type_allow_logo_override: false }))
      .toEqual({ logoS3Key: 'k', allowOverride: false });
  });

  it('is null where no row was joined at all', () => {
    expect(typeLogoPolicyFromRow(null)).toBeNull();
  });
});
