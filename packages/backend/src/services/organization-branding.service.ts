import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError } from '../middleware/errors';
import { fileUploadService } from './file-upload.service';
import { audit, diff, type AuditActor } from './audit';

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
  /**
   * Where the logo being shown came from. Read-only: derived on every read from
   * the organisation's own logo and its type's, never stored.
   */
  logoSource?: LogoSource;
  /**
   * Whether this organisation may set a logo of its own. Read-only, and false
   * only where its type has a shared mark it forbids replacing.
   */
  canOverrideLogo?: boolean;
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

/*
 * The literal keys, not `keyof BrandingSettings`. The wider type let the
 * assignment below claim to write a string into any branding field, which was
 * harmless while every field was a string and stopped compiling the moment one
 * was not — a boolean would have been assigned a trimmed, lower-cased colour.
 */
const COLOUR_FIELDS = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'backgroundColor',
  'textColor',
] as const;

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
 * What an organisation's type says about logos.
 *
 * Read from `organization_types`; null where a caller has not joined to it, in
 * which case the organisation's own logo is used and nothing is inherited.
 */
export interface TypeLogoPolicy {
  /** The shared mark, or null where the type has not set one. */
  logoS3Key: string | null;
  /** Whether a club may replace the shared mark with its own. */
  allowOverride: boolean;
}

/**
 * Read the type's logo policy off a joined row.
 *
 * Its own function because three queries join to `organization_types` for this
 * and the column names are the sort of thing that gets mistyped once and then
 * silently returns "no shared logo" forever.
 */
export function typeLogoPolicyFromRow(row: any): TypeLogoPolicy | null {
  if (!row) return null;
  return {
    logoS3Key: row.type_logo_s3_key ?? null,
    // Absent means "no type joined", which must not read as "locked".
    allowOverride: row.type_allow_logo_override !== false,
  };
}

/** Where the logo an organisation actually shows came from. */
export type LogoSource = 'organisation' | 'organisation-type' | 'none';

export interface EffectiveLogo {
  /** The key to sign, if the winning logo lives in our bucket. */
  s3Key: string;
  /** An externally-hosted URL, where that is what won. */
  url: string;
  source: LogoSource;
  /**
   * Whether this organisation may set a logo of its own at all. False only
   * where its type has a shared mark and forbids replacing it — which is what
   * removes the upload control from the branding screen.
   */
  canOverride: boolean;
}

/**
 * Which logo an organisation actually shows, and whether it may change it.
 *
 * One function, used by every reader, because the alternative is each screen
 * working it out again and one of them getting it wrong — and "wrong" here
 * means a club showing another club's mark, or a federation's rebrand not
 * reaching half its branches.
 *
 * The order is the whole rule:
 *
 * 1. A **locked** type logo wins outright. That is what "may not be overridden"
 *    means, and it has to beat an organisation's own logo rather than merely
 *    hiding the upload — a club that set a logo before the type was locked
 *    would otherwise keep showing it.
 * 2. Otherwise the organisation's own logo, if it has one.
 * 3. Otherwise the type's logo, inherited as a default.
 * 4. Otherwise nothing, and the shell renders the organisation's initial.
 *
 * **The flag only bites when the type actually has a logo.** With no shared
 * mark there is nothing to protect, and honouring `allowOverride: false`
 * literally would leave every club in that type unable to have any logo at all
 * — a dead configuration a super admin could reach by ticking one box.
 */
export function effectiveLogo(
  branding: Pick<BrandingSettings, 'logoS3Key' | 'logoUrl'>,
  type: TypeLogoPolicy | null
): EffectiveLogo {
  const typeLogo = type?.logoS3Key || '';
  const locked = Boolean(typeLogo) && type?.allowOverride === false;

  if (locked) {
    return { s3Key: typeLogo, url: '', source: 'organisation-type', canOverride: false };
  }

  if (branding.logoS3Key || branding.logoUrl) {
    return {
      s3Key: branding.logoS3Key || '',
      url: branding.logoUrl || '',
      source: 'organisation',
      canOverride: true,
    };
  }

  if (typeLogo) {
    return { s3Key: typeLogo, url: '', source: 'organisation-type', canOverride: true };
  }

  return { s3Key: '', url: '', source: 'none', canOverride: true };
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
 *
 * `type` is optional so the many existing callers that have no type to hand
 * keep working unchanged: without it, an organisation simply shows its own.
 */
export async function resolveLogoUrl(
  branding: Pick<BrandingSettings, 'logoS3Key' | 'logoUrl'>,
  type: TypeLogoPolicy | null = null
): Promise<string> {
  const effective = effectiveLogo(branding, type);

  if (!effective.s3Key) {
    return effective.url || '';
  }

  try {
    return await fileUploadService.getFileUrl(effective.s3Key, LOGO_URL_TTL_SECONDS);
  } catch (error) {
    logger.warn('Could not sign a URL for the branding logo', {
      s3Key: effective.s3Key,
      source: effective.source,
      error: error instanceof Error ? error.message : String(error),
    });
    return effective.url || '';
  }
}

export class OrganizationBrandingService {
  /** What this organisation's type says about logos, or null if it has no type. */
  async typeLogoPolicy(organizationId: string): Promise<TypeLogoPolicy | null> {
    const result = await db.query(
      `SELECT ot.logo_s3_key         AS type_logo_s3_key,
              ot.allow_logo_override AS type_allow_logo_override
         FROM organizations o
         JOIN organization_types ot ON ot.id = o.organization_type_id
        WHERE o.id = $1`,
      [organizationId]
    );
    return result.rows.length ? typeLogoPolicyFromRow(result.rows[0]) : null;
  }

  /**
   * Get the branding settings for an organisation, merged onto the defaults so
   * callers always receive a fully-populated object.
   */
  async getBrandingSettings(organizationId: string): Promise<BrandingSettings> {
    /*
     * Joined to the type, because the logo an organisation shows may not be its
     * own. `LEFT JOIN` — an organisation with no type still has branding.
     */
    const result = await db.query(
      `SELECT o.settings,
              ot.logo_s3_key         AS type_logo_s3_key,
              ot.allow_logo_override AS type_allow_logo_override
         FROM organizations o
         LEFT JOIN organization_types ot ON ot.id = o.organization_type_id
        WHERE o.id = $1`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const row = result.rows[0];
    const settings = row.settings || {};
    const branding = { ...DEFAULT_BRANDING_SETTINGS, ...(settings.branding || {}) };
    const policy = typeLogoPolicyFromRow(row);
    const effective = effectiveLogo(branding, policy);

    return {
      ...branding,
      logoUrl: await resolveLogoUrl(branding, policy),
      /*
       * Told to the caller rather than left to be inferred. The branding screen
       * has to say *why* there is no upload control, and "your organisation
       * type sets the logo" is a different sentence from "you have not uploaded
       * one yet".
       */
      logoSource: effective.source,
      canOverrideLogo: effective.canOverride,
    };
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
    data: Partial<BrandingSettings>,
    /**
     * Who is making the change, for the audit trail.
     *
     * Optional so existing callers compile, but the route passes it — an
     * unattributed settings change is the thing the old audit log was full of.
     */
    actor?: AuditActor
  ): Promise<BrandingSettings> {
    // Read before writing: the audit record needs the values as they were, and
    // after the UPDATE they are gone.
    const before = await this.getBrandingSettings(organizationId).catch(() => null);

    const merged: BrandingSettings = {
      ...DEFAULT_BRANDING_SETTINGS,
      ...sanitizeBrandingSettings(data),
    };

    /*
     * The lock is enforced here, not only by hiding the upload.
     *
     * The branding screen removes the control when a club may not override its
     * type's mark, but a screen is not a rule: the endpoint is reachable by
     * anyone who can open a console, and a club that had a logo before the type
     * was locked will still be posting it back with every colour change.
     *
     * Colours and the bookings label are untouched by this — the lock is about
     * the logo, so the rest of the screen keeps working. The stored logo is
     * cleared rather than refused, because a stored value that is never shown
     * is a trap for whoever reads the row next.
     */
    const policy = await this.typeLogoPolicy(organizationId);
    if (policy?.logoS3Key && policy.allowOverride === false) {
      merged.logoS3Key = '';
      merged.logoUrl = '';
    }

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

    if (actor) {
      /*
       * `logoSource` and `canOverrideLogo` are derived per read, not stored, so
       * they would show up as spurious changes on every save.
       */
      audit.record({
        actor,
        category: 'settings',
        action: 'settings.branding-updated',
        organisationId: organizationId,
        entityType: 'branding-settings',
        entityLabel: 'Branding',
        changes: diff(before as any, merged as any, {
          ignore: new Set(['logoSource', 'canOverrideLogo', 'logoUrl']),
        }),
      });
    }

    /*
     * Derived from the policy already fetched above, rather than re-reading the
     * row. The caller still learns that its logo was refused — which it must,
     * or the screen shows a logo the server just discarded — without a second
     * round trip on every colour change.
     */
    const effective = effectiveLogo(merged, policy);
    return {
      ...merged,
      logoUrl: await resolveLogoUrl(merged, policy),
      logoSource: effective.source,
      canOverrideLogo: effective.canOverride,
    };
  }
}

export const organizationBrandingService = new OrganizationBrandingService();
