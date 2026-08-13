# Removing the per-organisation Stripe keys from Payment Settings

The org-admin Payment Settings tab had a **Stripe Configuration** section: an "Enable Stripe
Payments" switch and, behind it, three fields — publishable key, secret key and webhook secret. It
has been removed, along with the fields behind it, in the front end, the API contract and the stored
data.

## Why

The section belonged to the **direct-charge** model, where every club has its own Stripe account and
its own credentials. The platform moved to **Connect destination charges** in phase 8 (see
[ACCOUNT_USER_APP_PHASE8_CHECKOUT.md](ACCOUNT_USER_APP_PHASE8_CHECKOUT.md) §1), which inverts the
credential model:

| | Direct charges (what the form stored) | Connect destination charges (what runs) |
|---|---|---|
| Secret key | per organisation | one, the platform's, from `STRIPE_SECRET_KEY` |
| Webhook secret | per organisation | one, the platform's, from `STRIPE_WEBHOOK_SECRET` |
| Publishable key | per organisation | one, the platform's, from `VITE_STRIPE_PUBLISHABLE_KEY` |
| Per organisation | keys | `settings.stripeConnect.accountId` (`acct_…`) |

The fields were left in place at the time, deliberately: removing inputs that a recently-built UI
saves is a change worth making on purpose rather than in passing. This is that change.

**Nothing read them.** `payment-providers/stripe.provider.ts` builds its client from the environment;
`account-shell/src/pages/CheckoutPage.tsx` loads Stripe.js from `VITE_STRIPE_PUBLISHABLE_KEY`. The
settings tab was the only writer. `stripeEnabled` gated nothing beyond whether the three key fields
rendered in the same form.

**Leaving them was the harmful option.** The form invited an administrator to paste a live `sk_…`
into a JSONB column that nothing validates, rotates or audits — a credential at rest with no owner —
and marked two of the fields `required` for a switch that changed no behaviour. An organisation that
filled the section in would reasonably believe it had configured card payments, when in fact nothing
would work until Connect onboarding was completed in the panel directly above it.

## What replaces it

`StripeConnectPanel`, already first on the same tab. It is the organisation's entire Stripe
configuration surface: an onboarding link, the connected account's status, and the outstanding
requirements Stripe reports.

No `stripeEnabled` replacement was added. The Connect account's `chargesEnabled` already answers
"can this organisation take card payments?", is authoritative, and cannot drift out of sync with
Stripe the way a hand-set flag can.

## Changes

**Front end** — `packages/orgadmin-core/src/settings/components/PaymentSettingsTab.tsx`

- Stripe Configuration section, the four fields, their form state, the two show/hide toggles and the
  `stripeKeysRequired` validation removed. The tab now covers Helix-Pay and offline payments only.

**Backend** — `packages/backend/src/services/organization-payment-settings.service.ts`

- `stripeEnabled`, `stripePublishableKey`, `stripeSecretKey` and `stripeWebhookSecret` removed from
  the `PaymentSettings` interface, the defaults and `sanitizePaymentSettings`. The sanitiser is a
  whitelist, so a client that still sends them now has them dropped.

**Migration** — `packages/backend/migrations/1709000000014_drop-per-org-stripe-keys.js`

- Deletes the four keys from `organizations.settings.paymentSettings`. Required, not cosmetic:
  `getPaymentSettings` spreads stored values over the defaults, so without it a stale secret would
  keep being served back to the client until someone happened to press Save. Irreversible by design
  — the values were secrets, and the point of the migration is that they stop existing.

**Translations** — the 12 keys (`sections.stripeConfig`, the 11 `fields.stripe*` entries and
`validation.stripeKeysRequired`) removed from all six locales.

## Also removed, found by auditing for the same pattern

**`acceptedPaymentMethods`** — a `string[]` on the same contract, hard-defaulted to `['card']`,
carried through the form's state and posted on every save. It had no UI and no reader anywhere in
the repository. Which methods an organisation may offer is settled by the `payment_methods` rows the
super admin enables for it and the fees on its organisation type, which is what
`checkout.service.ts` joins against. A second, self-declared list answered the same question with no
authority behind it. Unlike the Stripe keys it is not a credential, and `updatePaymentSettings`
rebuilds `paymentSettings` from the defaults on every save, so it needs no migration — the first
save clears it.

**Six orphaned translation keys** — `sections.paymentConfig`, `fields.defaultCurrency`,
`fields.handlingFeePercentage(+Helper)`, `fields.handlingFeeFixed(+Helper)`, in all six locales.
These outlived the earlier removal of currency and handling-fee configuration from this tab (those
are organisation-type settings, not org-admin ones). No component referenced any of them.

**Two stale path references** — `migrations/1709000000010`'s comment and this repository's
`.claude/modules/backend.md` both located the connected account id under the payment settings. It is
at `settings.stripeConnect.accountId`, deliberately outside `paymentSettings` precisely because
`updatePaymentSettings` rebuilds that object wholesale.

**Documentation** — `ACCOUNT_USER_APP_PHASE8_CHECKOUT.md` §1, `TROUBLESHOOTING.md` ("Payment Not
Processing" now points at Connect onboarding rather than at nonexistent per-org API keys),
`.claude/modules/core-settings.md`, `.claude/modules/backend.md`, and the header comment on
`stripe.provider.ts`.

## Tests

- `PaymentSettingsTab.test.tsx` — the Stripe describe block is replaced by two regression guards: an
  organisation whose stored settings still contain legacy keys must neither render them nor write
  them back on save. Sentinel assertions that keyed off `pk_test_123` now key off the cheque
  instructions, and the secret-visibility test covers the Helix-Pay API key.
- `organization-payment-settings.service.test.ts` — new. Covers the get/update contract and, in
  particular, that client-supplied Stripe keys are not persisted and that any save rebuilds
  `paymentSettings` without them.
- `core-modules-i18n.test.tsx` — the Payment Settings field list no longer asserts on removed keys.

## Migrating

```bash
npm run migrate:up --workspace=packages/backend
```

Organisations lose no working configuration: the deleted keys were not used to take a payment. Any
organisation that had filled the section in was already relying on Connect onboarding for its card
payments, or was not taking card payments at all.
