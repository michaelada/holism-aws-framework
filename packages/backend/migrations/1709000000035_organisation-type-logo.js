/* eslint-disable camelcase */

/**
 * A shared logo, set once for an organisation type and inherited by its clubs.
 *
 * A federation — the pony clubs, a county board — has one mark, and every
 * branch was uploading its own copy of it. That is the same file stored twenty
 * times, twenty chances for somebody to upload last year's version, and no way
 * to change it centrally when the federation rebrands.
 *
 * ## `logo_s3_key`, matching how an organisation's own logo is stored
 *
 * The key, not a URL. The bucket blocks public access, so the only readable
 * form is a signed URL and a signed URL expires — persisting one would give
 * every club a logo that worked for an hour. Readers sign the key on demand,
 * exactly as `organizations.settings->branding->logoS3Key` is signed today.
 *
 * ## `allow_logo_override`
 *
 * Whether a club may replace the shared mark with its own. Defaults to **true**
 * — which is today's behaviour, where every club sets its own logo and no type
 * has one — so this migration changes nothing for anybody until a super admin
 * uploads a type logo.
 *
 * The flag is only meaningful once the type *has* a logo. With no shared mark
 * there is nothing to protect, and locking the field would leave every club in
 * the type unable to have any logo at all; the resolution treats it that way
 * rather than trusting the two columns to be set consistently.
 */

exports.up = (pgm) => {
  pgm.addColumns('organization_types', {
    logo_s3_key: { type: 'varchar(500)' },
    logo_mime: { type: 'varchar(100)' },
    allow_logo_override: { type: 'boolean', notNull: true, default: true },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('organization_types', ['logo_s3_key', 'logo_mime', 'allow_logo_override']);
};
