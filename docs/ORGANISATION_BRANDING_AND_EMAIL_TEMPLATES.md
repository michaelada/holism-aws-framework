# Organisation Branding and Email Templates

Implements the two Settings tabs that previously called endpoints which did not exist.

Before this change, `BrandingTab` and `EmailTemplatesTab` in `packages/orgadmin-core` issued
requests to `/api/orgadmin/organisation/branding-settings` and
`/api/orgadmin/organisation/email-templates`. Neither path was served by any router, so both tabs
failed to load and could not save.

## Storage

Both features store into the existing `organizations.settings` JSONB column, following the
precedent set by payment settings. **No migration is required.**

```jsonc
{
  "paymentSettings": { /* … */ },
  "branding": {
    "logoUrl": "https://…/logo.png",
    "primaryColor": "#1976d2",
    "secondaryColor": "#dc004e",
    "accentColor": "#ff9800",
    "backgroundColor": "#ffffff",
    "textColor": "#000000"
  },
  "emailTemplates": {
    "welcome": { "id": "<uuid>", "subject": "…", "body": "…", "updatedAt": "2026-08-05T…" }
    // only customised templates are stored
  }
}
```

Writes use `jsonb_set` on the individual key, so saving branding cannot disturb payment settings,
email templates, or the address fields the super-admin app writes to the same column.

## Endpoints

All are mounted under `/api/orgadmin/organisation` and resolve the caller's organisation from their
Keycloak user id — no organisation id is accepted from the client.

| Method | Path | Purpose |
|---|---|---|
| GET | `/branding-settings` | Branding, merged onto the platform defaults |
| PUT | `/branding-settings` | Replace branding (validated) |
| GET | `/email-templates` | Every template type: the organisation's override, or the default |
| PUT | `/email-templates` | Create or replace one template |
| DELETE | `/email-templates/:name` | Reset one template to the platform default |

Responses are `401` when unauthenticated, `403` when the caller is not an active org admin, `400`
on validation failure, and `500` otherwise.

### Branding

`GET` always returns a fully-populated object, defaults filled in:

```json
{
  "logoUrl": "",
  "primaryColor": "#1976d2",
  "secondaryColor": "#dc004e",
  "accentColor": "#ff9800",
  "backgroundColor": "#ffffff",
  "textColor": "#000000"
}
```

Validation on `PUT`:

- Colours must be `#rgb` or `#rrggbb` (case-insensitive); they are stored lower-cased.
- An empty or omitted colour means "leave at the default" rather than being an error.
- `logoUrl` must be a string of at most 2048 characters.
- Unknown keys are discarded rather than persisted, so the payload cannot be used as arbitrary
  client-controlled storage.

### Email templates

`GET` returns an array of `{ id, name, subject, body }` covering all five template types.
Templates the organisation has never customised are returned with the platform default content and
a deterministic `default:<name>` id, so a caller can tell an override from a default.

Template types (must stay in step with `TEMPLATE_TYPES` in `EmailTemplatesTab`):

`welcome`, `event_confirmation`, `payment_receipt`, `membership_confirmation`, `password_reset`

Validation on `PUT`:

- `name` must be one of the known template types — unknown names are rejected.
- `subject` and `body` are required and non-blank; max 500 and 20,000 characters respectively.
- Re-saving an existing override keeps its id; the first save allocates a UUID.

`OrganizationEmailTemplatesService.getEmailTemplate(organizationId, name)` resolves a single
template with the same default fallback, and is the intended entry point for `email.service` when
sending.

## Files

| File | Change |
|---|---|
| `packages/backend/src/services/organization-branding.service.ts` | New |
| `packages/backend/src/services/organization-email-templates.service.ts` | New |
| `packages/backend/src/routes/orgadmin-organisation.routes.ts` | Five new routes; auth/error boilerplate factored into a `withOrganisation` wrapper that maps `AppError` to its status code |
| `packages/backend/src/services/__tests__/organization-branding.service.test.ts` | New — 20 tests |
| `packages/backend/src/services/__tests__/organization-email-templates.service.test.ts` | New — 23 tests |
| `packages/orgadmin-core/src/settings/components/BrandingTab.tsx` | Colour swatch inputs given accessible names |

No change was needed to `docker-compose*.yml`, `terraform/`, or `infrastructure/`: the feature adds
no environment variable, secret, port or service, and no migration.

## Front-end notes

`BrandingTab` renders each colour twice — a native colour swatch and a text field. The swatches
previously had no accessible name, so assistive technology announced them only as "colour". They
now carry `aria-label` built from `settings.branding.fields.colourPicker` (a new key, added to all
six locales) interpolated with the colour's own label, e.g. "Primary Colour picker".
