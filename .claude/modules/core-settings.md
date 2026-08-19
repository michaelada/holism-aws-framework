# Settings — `packages/orgadmin-core/src/settings`

Where an organisation configures itself: its own details, how it takes payment, the emails it
sends, and its visual branding.

Part of `orgadmin-core`, always available. One route, `settings`, rendering `SettingsPage` — a
four-tab container.

## Tabs

| # | Tab | Component | Endpoint |
|---|---|---|---|
| 0 | Organisation Details | `OrganisationDetailsTab` | `PUT /api/orgadmin/organisation/:id` |
| 1 | Payment Settings | `PaymentSettingsTab` | `GET`/`PUT /api/orgadmin/organisation/payment-settings`, plus `GET /api/orgadmin/payment-methods` |
| 2 | Email Templates | `EmailTemplatesTab` | `GET`/`PUT /api/orgadmin/organisation/email-templates`, `DELETE .../email-templates/:name` |
| 3 | Branding | `BrandingTab` | `GET`/`PUT /api/orgadmin/organisation/branding-settings`, `POST /api/orgadmin/files/branding-logo` |

Everything under `/api/orgadmin/organisation/` is served by `orgadmin-organisation.routes`, which is
mounted **once, bare** — not organisation-scoped like the data routers. Two consequences worth
knowing before touching these tabs, both of which had already bitten:

- The path is listed in `UNSCOPED_ORGADMIN_PATHS` (`orgadmin-core/src/hooks/useApi.ts`). Remove it
  and `useApi` rewrites to `/api/orgadmin/organisations/<id>/organisation/…`, which matches nothing —
  every tab here 404s.
- The router picks the organisation from `X-Organisation-Id`, verified against the caller's own
  org-admin rows. It previously took an arbitrary one, so an administrator of two clubs edited the
  settings of a club they had not opened. See
  [OFFLINE_PAYMENTS_MENU_AND_AUDIT.md](../../docs/OFFLINE_PAYMENTS_MENU_AND_AUDIT.md).

## Storage: the `settings` JSONB column

Every tab persists into `organizations.settings`, a single JSONB column shared with the super-admin
app (which writes address and contact fields there too). The backend **merges** rather than
replaces:

```sql
settings = COALESCE(settings, '{}'::jsonb) || $n::jsonb
```

Replacing the column wholesale destroys the other tabs' configuration. This was a real bug: saving
organisation details wiped payment settings.

## Payment Settings tab

The most involved tab.

- **Stripe** — nothing on the form. Card payments are configured entirely by the Connect onboarding
  panel at the top of the tab (below). The old "Stripe Configuration" section — enable flag,
  publishable key, secret key, webhook secret — was the direct-charge model, was never read by any
  payment code path, and has been removed; see docs/REMOVE_PER_ORG_STRIPE_KEYS.md.
- **Helix-Pay** — enable flag plus a masked API key, required when enabled. The whole section is
  **capability-gated by data**: on load it fetches the organisation's enabled payment methods in
  parallel with the settings, and only renders if a method whose name contains "helix" has been
  enabled by the super admin.
- **Offline payments** — cheque/offline enable flag plus the instructions shown to payers.

Payment methods themselves are enabled per organisation in the super-admin app; this tab supplies
the credentials for methods already switched on. There is no currency or handling-fee configuration
here — that was removed as not being org-admin configurable.

## Branding tab

Colour configuration — primary, secondary, accent, background and text colours — plus logo upload
through `/api/orgadmin/files/branding-logo` (see below; **not** `/files/upload`). Each colour has two bound controls: a native colour swatch
(`<input type="color">`, accessible name from `settings.branding.fields.colourPicker`) and a text
field. Colours are validated server-side as `#rgb`/`#rrggbb`.

**Naming** — a *Bookings menu name* field appears only when the organisation has
`calendar-bookings`. It sets `branding.bookingsLabel`, what the member app calls the bookings area:
"Bookings" is what the software does, while a club's members know it as the court, the arena or the
pool. Empty is stored rather than the default word, so an untouched club keeps following the
translated default in every language; the custom label is not translated, being a name the club
chose. Capped at 40 characters, which is a nav rail's worth. Hidden without the capability, because
renaming a menu the club does not have is a setting that cannot be checked. See
`docs/BOOKINGS_NAMING_AND_CALENDAR_ICONS.md`.

## Email Templates tab

Loads every template type into a `Record<name, EmailTemplate>` and edits one at a time. The backend
returns the organisation's override where one exists and the platform default otherwise, so the tab
always has content to show. Template types: `welcome`, `event_confirmation`, `payment_receipt`,
`membership_confirmation`, `password_reset` — the list must stay in step with
`DEFAULT_EMAIL_TEMPLATES` in the backend service.

## Storage layout

Everything the four tabs write lives under `organizations.settings`:

```
settings
├── paymentSettings   { helixPay*, cheque* }   // no Stripe keys, no method list
├── stripeConnect     { accountId, chargesEnabled, … }   // written by onboarding, NOT paymentSettings
├── branding          { logoS3Key, logoUrl, primaryColor, … }   // logoUrl signed on read
├── emailTemplates    { <name>: { id, subject, body, updatedAt } }   // overrides only
└── address/contact fields (written by the super-admin app)
```

Each is written with `jsonb_set` on its own key, so tabs cannot overwrite each other.

## Where to look for what

| Question | Start at |
|---|---|
| "Where is the Helix-Pay API key entered?" | `components/PaymentSettingsTab.tsx` |
| "Where are the org's Stripe keys entered?" | Nowhere — the platform's are in the environment, the org has only a connected account id |
| "Why is the Helix-Pay section missing?" | The org's enabled payment methods (set in the super-admin app) |
| "Why did saving one tab wipe another?" | The JSONB merge in backend `organization.service.ts` |
| "Where is the org's address stored?" | `organizations.settings`, written by the super-admin app |
| "Where do the tab labels come from?" | Each tab's own `title` key, mapped in `SettingsPage.tsx` |
| "How do I add a template type?" | `DEFAULT_EMAIL_TEMPLATES` in the backend service plus `TEMPLATE_TYPES` in the tab |

## Registration (tab 5)

`RegistrationSettingsTab.tsx` — `GET`/`PUT /api/orgadmin/organisation/registration-settings`,
returning `{ autoRegistration, notificationEmails }`. Auto-registration OFF means an administrator
must approve each member before they can sign in; the queue is
[core-users.md](core-users.md)'s Registrations page.

The tab warns when **approval is required and nobody is notified** — the pair that leaves requests
sitting in an unwatched queue and members locked out with no explanation.

Note the shape of the load callback: errors are held as **i18n keys and translated at render**, so
`load` does not depend on `t`. Depending on `t` re-runs the mount effect on every render and the tab
spins forever instead of failing visibly (§3.4). Worth copying into any new tab.

Full record: [docs/REGISTRATION_APPROVAL_ORGADMIN.md](../../docs/REGISTRATION_APPROVAL_ORGADMIN.md).

## Stripe Connect (Payment Settings)

`StripeConnectPanel.tsx`, first on the Payment Settings tab — nothing else there matters until a
club has connected, because checkout refuses an organisation with no connected account.

State lives in `settings.stripeConnect`, **deliberately not in `settings.paymentSettings`**:
`updatePaymentSettings` rebuilds that object from its own defaults on every save, so anything its
sanitiser does not know about is wiped — the connected account id would be destroyed by an unrelated
settings change, severing the club's ability to take money.

The panel distinguishes **"details submitted" from "chargesEnabled"**; a club that stops at Stripe's
last screen would otherwise believe it had finished. Stripe's `currently_due` requirements are shown
verbatim so they can be matched against Stripe's own screens.

Full record: [docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md](../../docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md) §2a.

## Branding: the logo is an S3 key, not a URL

Uploads go to **`POST /api/orgadmin/files/branding-logo`**, not `/files/upload` — the latter is for
form-field files and requires a `formId` and `fieldId`, which a logo has neither of. Sending a logo
there fails with *"Missing required fields: organizationId, formId, fieldId"*.

The bucket blocks all public access, so there is no permanent URL to store. `settings.branding`
persists **`logoS3Key`**, and readers sign it on demand:

- `organization-branding.service.getBrandingSettings` (org-admin)
- `account-organisation.service` — all three public paths: directory, gateway and the switcher

`logoUrl` remains settable for a logo hosted elsewhere, and is what the signed URL is returned *as*,
so consumers are unchanged. `resolveLogoUrl` never throws: a logo that cannot be signed must not
take down the branding endpoint and with it the organisation shell.

The stored key is validated against `organisations/<uuid>/branding/` — the client echoes it back on
save, so without that check an organisation could name any object in the bucket and have the server
sign a URL for it.

## Branding preview

`BrandingPreview.tsx` builds a real MUI theme from the chosen colours via `createTheme` and renders
the sample inside a nested `ThemeProvider`. The previous version hand-tinted three buttons with
`sx`, so every other control kept the org-admin's own palette and the colours looked ignored.

It shows the **member-facing** app — an app bar carrying the logo, forms, controls, a table and a
list — because branding applies to the account app, not to the screen the administrator is on.
Contrast text on brand colours is computed by relative luminance so a pale primary does not preview
as unreadable white-on-cream.
