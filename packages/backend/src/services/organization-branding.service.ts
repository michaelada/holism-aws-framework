import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError } from '../middleware/errors';
import { fileUploadService } from './file-upload.service';

/**
 * Branding settings for an organisation.
 *
 * Stored inside the organisations.settings JSONB column under the `branding`
 * key, alongside the organisation's other settings (address, contact details,
 * paymentSettings, emailTemplates). This keeps branding with the rest of the
 * organisation record without requiring a dedicated table.
 */
export interface BrandingSettings {
  /**
   * A URL for the logo.
   *
   * When the logo was uploaded through the branding screen this is **derived**:
   * `logoS3Key` is what is stored, and readers sign it on demand. The bucket
   * blocks public access, so there is no permanent URL to persist, and a signed
   * one would expire within the hour if it were written down.
   *
   * It remains directly settable so an organisation can point at a logo hosted
   * elsewhere.
   */
  logoUrl: string;
  /** Set when the logo lives in our own bucket; `logoUrl` is signed from it. */
  logoS3Key?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  /**
   * What the member-facing app calls the bookings area.
   *
   * "Bookings" says what the software does; a club's members know it as the
   * court, the arena or the pool. Empty means the default, so a club that never
   * touches this is not carrying a copy of the word it would have got anyway.
   *
   * Only meaningful with the `calendar-bookings` capability — the settings
   * screen hides the field otherwise — but stored unconditionally, so switching
   * the capability off and on again does not lose what a club chose.
   */
  bookingsLabel?: string;
}

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  logoUrl: '',
  logoS3Key: '',
  bookingsLabel: '',
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  accentColor: '#ff9800',
  backgroundColor: '#ffffff',
  textColor: '#000000',
};

const COLOUR_FIELDS: Array<keyof BrandingSettings> = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'backgroundColor',
  'textColor',
];

/** #rgb or #rrggbb, case-insensitive. */
const HEX_COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const MAX_LOGO_URL_LENGTH = 2048;

/**
 * Long enough for "Cross-country schooling", short enough to sit in a
 * navigation rail and a section heading without wrapping.
 */
const MAX_BOOKINGS_LABEL_LENGTH = 40;

/**
 * 12 hours. Long enough that a member keeps the same URL for a session and a
 * browser can cache it; short enough that it is still a bounded credential.
 */
const LOGO_URL_TTL_SECONDS = 12 * 60 * 60;

/**
 * Whitelist incoming data to the known branding fields so arbitrary
 * client-supplied keys are never persisted into the settings JSONB, and
 * reject values that are not usable as colours or URLs.
 */
function sanitizeBrandingSettings(data: any): Partial<BrandingSettings> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Branding settings must be an object');
  }

  const out: Partial<BrandingSettings> = {};

  for (const field of COLOUR_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (typeof value !== 'string' || !HEX_COLOUR.test(value.trim())) {
      throw new ValidationError(`${field} must be a hex colour such as #1976d2`, [
        { field, message: 'Invalid hex colour' },
      ]);
    }
    out[field] = value.trim().toLowerCase();
  }

  if (data.logoUrl !== undefined && data.logoUrl !== null) {
    if (typeof data.logoUrl !== 'string') {
      throw new ValidationError('logoUrl must be a string', [
        { field: 'logoUrl', message: 'Invalid logo URL' },
      ]);
    }
    const logoUrl = data.logoUrl.trim();
    if (logoUrl.length > MAX_LOGO_URL_LENGTH) {
      throw new ValidationError('logoUrl is too long', [
        { field: 'logoUrl', message: `Must be at most ${MAX_LOGO_URL_LENGTH} characters` },
      ]);
    }
    out.logoUrl = logoUrl;
  }

  if (data.bookingsLabel !== undefined && data.bookingsLabel !== null) {
    if (typeof data.bookingsLabel !== 'string') {
      throw new ValidationError('bookingsLabel must be a string', [
        { field: 'bookingsLabel', message: 'Invalid label' },
      ]);
    }
    const label = data.bookingsLabel.trim();
    if (label.length > MAX_BOOKINGS_LABEL_LENGTH) {
      throw new ValidationError('bookingsLabel is too long', [
        {
          field: 'bookingsLabel',
          message: `Must be at most ${MAX_BOOKINGS_LABEL_LENGTH} characters`,
        },
      ]);
    }
    // Stored trimmed; empty means "use the default" rather than a blank menu.
    out.bookingsLabel = label;
  }

  if (data.logoS3Key !== undefined && data.logoS3Key !== null) {
    if (typeof data.logoS3Key !== 'string') {
      throw new ValidationError('logoS3Key must be a string', [
        { field: 'logoS3Key', message: 'Invalid logo key' },
      ]);
    }
    const key = data.logoS3Key.trim();
    /*
     * Confined to this organisation's own branding prefix. The key is echoed
     * back by the client, so without this an organisation could name any object
     * in the bucket and have the server sign a URL for it.
     */
    if (key && !/^organisations\/[0-9a-f-]{36}\/branding\//i.test(key)) {
      throw new ValidationError('logoS3Key is not a branding logo key', [
        { field: 'logoS3Key', message: 'Invalid logo key' },
      ]);
    }
    out.logoS3Key = key;
  }

  return out;
}

/**
 * Turn a stored logo into something an <img> can load.
 *
 * An uploaded logo is stored as an S3 key, not a URL: the bucket blocks public
 * access, so the only readable form is a signed URL, and signed URLs expire —
 * persisting one would give every organisation a logo that worked for an hour
 * and then broke. Signing on read costs one call per branding fetch and is
 * always current.
 *
 * Never throws. A logo that cannot be signed — the object deleted from the
 * bucket, S3 briefly unavailable — must not take down the branding endpoint and
 * with it the entire organisation shell. An empty logo renders as the
 * organisation's initial, which is the same thing an organisation without a
 * logo shows.
 */
export async function resolveLogoUrl(branding: BrandingSettings): Promise<string> {
  if (!branding.logoS3Key) {
    return branding.logoUrl || '';
  }

  try {
    return await fileUploadService.getFileUrl(branding.logoS3Key, LOGO_URL_TTL_SECONDS);
  } catch (error) {
    logger.warn('Could not sign a URL for the branding logo', {
      s3Key: branding.logoS3Key,
      error: error instanceof Error ? error.message : String(error),
    });
    return branding.logoUrl || '';
  }
}

export class OrganizationBrandingService {
  /**
   * Get the branding settings for an organisation, merged onto the defaults so
   * callers always receive a fully-populated object.
   */
  async getBrandingSettings(organizationId: string): Promise<BrandingSettings> {
    const result = await db.query('SELECT settings FROM organizations WHERE id = $1', [
      organizationId,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const settings = result.rows[0].settings || {};
    const branding = { ...DEFAULT_BRANDING_SETTINGS, ...(settings.branding || {}) };

    return { ...branding, logoUrl: await resolveLogoUrl(branding) };
  }

  /**
   * Update the branding settings for an organisation.
   *
   * Uses jsonb_set so only the `branding` key is replaced — the rest of the
   * organisation's settings are left untouched. The frontend sends the full
   * branding object, so the stored value is replaced wholesale (merged onto
   * defaults).
   */
  async updateBrandingSettings(
    organizationId: string,
    data: Partial<BrandingSettings>
  ): Promise<BrandingSettings> {
    const merged: BrandingSettings = {
      ...DEFAULT_BRANDING_SETTINGS,
      ...sanitizeBrandingSettings(data),
    };

    const result = await db.query(
      `UPDATE organizations
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{branding}', $1::jsonb, true),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [JSON.stringify(merged), organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    logger.info(`Branding settings updated for organization ${organizationId}`);
    return merged;
  }
}

export const organizationBrandingService = new OrganizationBrandingService();
