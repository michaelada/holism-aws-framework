# Per-organisation Stripe Connect application fee

The platform's cut of a card payment becomes configurable **per organisation**, copied from the
organisation type when the organisation is created.

Wireframes: [ORGANISATION_APPLICATION_FEE_WIREFRAMES.md](ORGANISATION_APPLICATION_FEE_WIREFRAMES.md).
Background on what the application fee is and why it is not the handling fee:
[CONNECT_APPLICATION_FEE.md](CONNECT_APPLICATION_FEE.md), whose §6 listed "no per-organisation
override" as the gap this closes.

---

## 1. Requirements

### 1.1 What is being asked for

> Every organisation type specifies the Stripe application fee that applies, and this is inherited
> into each organisation within that type. I want to be able to edit the application fee for a
> specific organisation — so Org1 and Org2 in Organisation Type X can have different application
> fees — but by default a new organisation always inherits the value of its parent type.

### 1.2 Scope, stated precisely

**In scope — the Stripe Connect application fee only.** `application_fee_fixed` and
`application_fee_percentage`: the split between the platform and the club.

**Explicitly out of scope — the handling fee.** `fixed_fee`, `percentage_fee` and `tax_percentage`
remain configured **per organisation type and nowhere else**. Those three decide what the *member*
is charged; letting them vary per club is a different (and much larger) decision about member-facing
pricing, and it is not what was asked for. Nothing in this change adds a per-organisation handling
fee, and the org-level editor must never present one.

### 1.3 Inheritance model: copy-on-create

Confirmed decision. The type's value is a **template for new organisations**, not a live parent.

| Event | Effect |
|---|---|
| Organisation created | The type's application fee is **copied** onto the organisation, per payment method |
| Organisation's fee edited | Only that organisation changes |
| **Type's fee edited** | **Existing organisations are untouched.** Only organisations created afterwards get the new value |
| Existing organisations at migration time | Backfilled with a copy of their type's current value, so behaviour is identical the moment the migration runs |

The rejected alternative was live inheritance, where editing a type re-prices every non-overridden
organisation. It is more powerful and considerably more dangerous: one edit would move revenue on
every club of that type, and this is money that has already been quoted to clubs commercially.

### 1.4 Granularity

Per **organisation × payment method**, matching how the type's fees are already modelled. A club
with both Stripe and Helix-Pay enabled can carry a different platform share on each.

### 1.5 Behaviour that must not change

- **NULL still means "take the handling fee."** The pair remains nullable, both-or-neither. An
  organisation whose copied value is `NULL, NULL` behaves exactly as it does today.
- **The member's total is unaffected.** This moves the platform/club boundary only.
- **No retroactive re-pricing.** A completed order keeps the fee snapshot taken at checkout.
- **No backfilled revenue change.** Every existing organisation ends the migration with the
  arrangement it had a moment before.

---

## 2. Design

### 2.1 Data

New table, mirroring the shape and the constraints of `organization_type_payment_fees` but carrying
**only** the application-fee pair:

```
organization_payment_application_fees
  id                          uuid pk
  organization_id             uuid  -> organizations(id)    ON DELETE CASCADE
  payment_method_id           uuid  -> payment_methods(id)  ON DELETE CASCADE
  application_fee_fixed       decimal(10,2) NULL
  application_fee_percentage  decimal(5,2)  NULL
  created_at, updated_at
  UNIQUE (organization_id, payment_method_id)
  CHECK non-negative
  CHECK both-or-neither
```

A separate table rather than columns on `organizations` because the value is per payment method, and
rather than columns on `organization_payment_methods` because that table is about *availability*,
not commercial terms — and because its rows are managed by `initializeDefaultPaymentMethods` and
`syncOrgPaymentMethods`, which would then be co-owners of revenue configuration.

The two `CHECK` constraints are carried over deliberately. A half-filled pair reads as "0% plus a
fixed 50c" when what was meant was "I only filled in one box", and the difference is the platform's
revenue on every sale.

### 2.2 Resolution at checkout

`checkout.service.applicationFeeConfig` currently joins organisation → type. It becomes:

```
1. the organisation's row for the card method       -> use it
2. no row for that method: the type's row           -> use it
3. no row at either level                           -> null = take the handling fee
```

Step 2 is a fallback, not live inheritance. After the backfill every organisation has a row for
every method its type had, so step 2 is only reached when a payment method is added to a type after
organisations already exist. Falling back to the type there is the only defensible default: the
alternative is an organisation silently reverting to "take the whole handling fee" because a row
happened not to exist.

`feeConfigSnapshot` records the application fee **actually used**, alongside where it came from, so
a payment can be explained later without re-deriving it.

### 2.3 Copy-on-create

`organization.service.createOrganization` copies the type's application fees after the organisation
row is inserted and after payment methods are initialised.

It is deliberately **not** fatal: like `initializeDefaultPaymentMethods` above it, a failure is
logged and creation proceeds. A missing row falls back to the type (§2.2), which is the same
arrangement the copy would have produced, so the failure mode is benign.

### 2.4 API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/organizations/:id/application-fees` | The organisation's fees, each with its type's current default alongside for comparison |
| `PUT` | `/api/admin/organizations/:id/application-fees` | Replace the organisation's fees |

The `GET` returns, per payment method: the effective value, the type's current default, and a
`source` of `organisation` or `type-fallback`. The UI needs all three to say where a number came
from and whether it has drifted from the type.

### 2.5 UI

**Organisation type editor** — unchanged in function; its platform-share copy now says the value is
the default new organisations receive, and that existing organisations keep their own.

**Organisation editor** (`EditOrganizationPage`) — a new "Platform share" section per card payment
method, with the same worked example the type editor uses. It shows the type's default beneath each
field and offers "Copy the type's current default" per method, which is an explicit, per-organisation
action, not the automatic propagation §1.3 rules out.

The worked example is the reason this feature is safe to hand to an operator. Three abstract numbers
are hard to sanity-check; "the platform keeps €1.80 of that €62.00 charge" is not.

---

## 3. Task breakdown

| # | Task | Files |
|---|---|---|
| 1 | Migration: table, constraints, backfill from each organisation's type | `migrations/1709000000021_organisation-application-fees.js` |
| 2 | Service: read, validate, replace, and copy-from-type | `services/organization-application-fee.service.ts` |
| 3 | Copy on create | `services/organization.service.ts` |
| 4 | Checkout resolution + snapshot | `services/checkout.service.ts` |
| 5 | Routes `GET`/`PUT` | `routes/organization.routes.ts` |
| 6 | Admin API client | `admin/src/services/organizationApi.ts` |
| 7 | `ApplicationFeeEditor` component | `admin/src/components/ApplicationFeeEditor.tsx` |
| 8 | Wire into the organisation editor | `admin/src/pages/EditOrganizationPage.tsx` |
| 9 | Type-editor copy | `admin/src/components/PaymentFeeEditor.tsx` |
| 10 | Backend tests (Jest) | service, checkout resolution |
| 11 | Front-end tests (Vitest) | `ApplicationFeeEditor` |
| 12 | Docs | this file, `CONNECT_APPLICATION_FEE.md`, `.claude/modules/backend.md`, `.claude/modules/admin.md` |
