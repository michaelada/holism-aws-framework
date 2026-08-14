# Per-organisation application fee — wireframes

Screens for [ORGANISATION_APPLICATION_FEE.md](ORGANISATION_APPLICATION_FEE.md). Super-admin surface
(`packages/admin`), Operate mode.

---

## K1 — Organisation type editor, Money section (revised copy)

Unchanged in function. The platform-share block now states what inheritance actually does, because
the previous copy read as though the value governed every organisation of the type for all time.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Money                                                                        │
│  Currency is fixed for every organisation of this type, and the fixed         │
│  element of each handling fee is a cash amount in it.                         │
│                                                                               │
│  Currency  [ EUR                          ] (locked — 14 organisations)       │
│                                            [ Change currency ]                │
│                                                                               │
│  ┌─ Card handling fees ──────────────────────────────────────────────────┐    │
│  │  Every organisation of this type charges these on card payments.      │    │
│  │  ⚠ Changing these fees affects 14 organisations. They will charge     │    │
│  │    the new fees as soon as you save. Payments already taken are       │    │
│  │    unaffected.                                                         │    │
│  │                                                                        │    │
│  │  Pay By Card (Stripe)                                                  │    │
│  │  Fixed fee      Percentage fee    Tax on fee                           │    │
│  │  [€ 0.25    ]   [ 1.5      % ]    [ 23      % ]                        │    │
│  │                                                                        │    │
│  │  Example: a €62.00 card charge attracts €0.25 + €0.93 = €1.18,        │    │
│  │  plus 23% tax €0.27 = €1.45                                            │    │
│  │                                                                        │    │
│  │  ── Platform share (Stripe Connect application fee) ──────────────    │    │
│  │  Taken out of each card payment. This does not change what the        │    │
│  │  member pays.                                                          │    │
│  │                                                                        │    │
│  │  ⓘ This is the default new organisations of this type start with.     │    │
│  │    Changing it here does not affect the 14 organisations that         │    │
│  │    already exist — each carries its own value, editable on the        │    │
│  │    organisation.                          [ View those organisations ] │    │
│  │                                                                        │    │
│  │  Application fee (fixed)   Application fee (%)                         │    │
│  │  [€ 0.50            ]      [ 2.00           % ]                        │    │
│  │                                                                        │    │
│  │  The platform keeps €1.74 of that €62.00 charge; the organisation      │    │
│  │  receives the rest.                                                    │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────┘
```

The callout is `info`, not `warning`: nothing is at risk here. The warning above it stays
`warning`, because that block *does* re-price 14 clubs.

---

## K2 — Organisation editor, new Platform share section

Sits below the existing capability and payment-method sections in `EditOrganizationPage`. One block
per card payment method the organisation has enabled.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Platform share                                                               │
│  What Its Plain Sailing keeps from each card payment this organisation        │
│  takes. It does not change what the member pays — the handling fee does       │
│  that, and it is set on the Sailing Club organisation type.                   │
│                                                                               │
│  ┌─ Pay By Card (Stripe) ────────────────────────────────────────────────┐    │
│  │                                                                        │    │
│  │  Application fee (fixed)     Application fee (%)                        │    │
│  │  [€ 0.25             ]       [ 1.00            % ]                      │    │
│  │  Type default: € 0.50        Type default: 2.00 %                       │    │
│  │                                                                        │    │
│  │  ● Differs from the Sailing Club default                               │    │
│  │                                    [ Copy the type's current default ]  │    │
│  │                                                                        │    │
│  │  The platform keeps €0.87 of a €62.00 charge; Killarney Sailing Club   │    │
│  │  receives the rest.                                                    │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─ Pay By Card (Helix-Pay) ─────────────────────────────────────────────┐    │
│  │  Application fee (fixed)     Application fee (%)                        │    │
│  │  [                   ]       [                 % ]                      │    │
│  │  Type default: not set       Type default: not set                      │    │
│  │                                                                        │    │
│  │  ○ Same as the Sailing Club default                                    │    │
│  │                                                                        │    │
│  │  Not set — the platform keeps the handling fee €1.45, as it does       │    │
│  │  today.                                                                │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### States per method

| State | Marker | Worked example reads |
|---|---|---|
| Same as type default | `○ Same as the <Type> default` | normal |
| Edited away from the default | `● Differs from the <Type> default` + copy-back action | normal |
| Both fields blank | either of the above | "Not set — the platform keeps the handling fee €1.45, as it does today." |
| One field blank | inline error on the empty one | example suppressed |

The both-or-neither rule is enforced in the UI as well as the database, because the failure it
prevents is silent: "0% plus a fixed 50c" is a plausible-looking configuration that nobody meant.

```
  Application fee (fixed)     Application fee (%)
  [€ 0.25             ]       [                 % ]
                              └ Set both, or clear both. A half-set pair
                                would take a fixed fee and no percentage.
```

---

## K3 — Organisation editor, empty case

An organisation with no card payment method enabled has no platform share to configure.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Platform share                                                               │
│                                                                               │
│  ⓘ This organisation has no card payment method enabled, so there is no       │
│    platform share to configure. Enable one above and save to set it.          │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## K4 — Organisation detail page, read-only summary

`OrganizationDetailsPage`, Overview tab. Read-only; editing happens in K2.

```
┌──────────────────────────────────┐
│  Platform share                  │
│                                  │
│  Stripe      € 0.25 + 1.00 %     │
│              ● differs from type │
│  Helix-Pay   not set             │
│              ○ same as type      │
└──────────────────────────────────┘
```

---

## Accessibility notes

- Every field carries an `aria-label` naming its method and role, e.g. *"Pay By Card (Stripe)
  application fee, fixed amount"*. Two methods on one page means "Application fee (fixed)" alone is
  ambiguous.
- The differs/same marker is **text**, not a coloured dot alone.
- The worked example is a live region (`aria-live="polite"`), so a screen-reader user typing a rate
  hears the consequence change. It is the whole reason the example exists.
- "Copy the type's current default" is a button, not an icon, and names what it copies.
