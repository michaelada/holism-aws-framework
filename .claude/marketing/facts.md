# Citable facts, and the things nobody has written down

Figures anything published may quote, each with where it came from, and the list of what the
repository simply does not know.

**Every figure is stamped with the date it was measured.** Re-measure before quoting an old one:
the command is given so it takes seconds.

---

## 1. Measured from the repository — 2 September 2026

| Fact | Value | How to re-measure |
|---|---|---|
| Packages in the monorepo | 15 | `ls packages \| wc -l` |
| Capability modules a club can be given | 7 (events, memberships, merchandise, calendar bookings, registrations, ticketing, announcements) | `.claude/modules/architecture.md` |
| Capabilities seeded | ~30 | `.claude/modules/architecture.md`, capability list |
| Locales | 6 — `en-GB`, `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT` | `ls packages/orgadmin-shell/src/locales` |
| Translated strings, org-admin (per locale) | 2,652 | count the leaves of `packages/orgadmin-shell/src/locales/en-GB/translation.json` |
| Translated strings, member app (per locale) | 592 | same, `packages/account-shell` |
| Form-field datatypes | 15 (13 without the `document-management` capability, which gates `file` and `image`) | `orgadmin-core/src/forms/hooks/useFilteredFieldTypes.ts` |
| Database migrations | 69 | `ls packages/backend/migrations/*.js \| wc -l` |
| Backend route files / services | 37 / 73 | `ls packages/backend/src/routes/*.ts \| wc -l` |
| Feature documents | 238 | `ls docs/*.md \| wc -l` |
| Wireframe documents | 17 | `ls docs/*WIREFRAMES*.md \| wc -l` |
| Member-app wireframes in the main set | 51 | `docs/ACCOUNT_USER_APP_WIREFRAMES.md` |
| Module summaries | 21 | `ls .claude/modules/*.md \| wc -l` |
| Refund scopes | 4 — full, less the handling fee, chosen items, an amount | `.claude/modules/core-payments.md` |
| Ticket image placements / layouts | 4 / 3 | `docs/TICKET_DESIGN.md` |

### Test counts — 2 September 2026

Quotable as evidence of engineering discipline, **not** as a quality guarantee.

| Suite | Tests |
|---|---|
| Backend (Jest, with the test database up) | 3,277 across 173 suites — **from CLAUDE.md §3.3, not re-measured on this date**; a 87-suite subset ran green at 1,797 |
| `orgadmin-core` | 962 |
| `account-shell` | 757 |
| `orgadmin-shell` | 754 |
| `components` | 537 |
| `orgadmin-memberships` | 534 |
| `orgadmin-events` | 423 |
| `orgadmin-registrations` | 259 |
| `orgadmin-calendar` | 229 |
| `orgadmin-ticketing` | 151 |
| `orgadmin-merchandise` | 143 |
| `orgadmin-announcements` | 50 |

Re-measure with `npx vitest run --root packages/<name>` per package and
`npm run test:backend` with `docker compose up -d postgres` first.

## 2. Infrastructure facts

- **Authentication** is Keycloak (realm `aws-framework`), with four bespoke login themes.
- **Payments** are Stripe **Connect** with destination charges; the club connects its own account
  through an onboarding panel and the platform's key is never the club's.
- **Deployment** is Docker Compose with nginx, Postgres, Prometheus and Grafana; Terraform for
  staging and production on AWS.
- **The member app is a PWA** — `vite-plugin-pwa`, app shell precached, scoped to `/account/`.
- **Files** live in S3 with all public access blocked; URLs are signed on demand, typically for an
  hour.

## 3. Version 4's commercial model, as its help guide states it

Reproduced from [old-system.md](old-system.md) §3. **Confirm before quoting** — help text outlives
price changes.

- Free unless the club takes card payments. No setup fee, no ongoing fee.
- **Ireland**: 85c + 1.5% + VAT at 23%, of which 60c to ItsPlainSailing.
- **UK**: 75p + 1.5%, of which 55p to ItsPlainSailing.
- Non-European cards attract Stripe's full rate.
- Handling fee is included in or added on top of the price, the club's choice per item.
- No fee on cheque or offline payments.
- On a refund the original handling fee is not returned.

## 4. What nobody has written down

**Do not fill these in from imagination.** Each needs a person to decide it.

| Unknown | Notes |
|---|---|
| **Pricing and plans for the new product** | Nothing in the repository. Whether it inherits version 4's per-transaction model is a commercial decision, not a technical one |
| **Customer names, logos, testimonials, quotes** | None recorded |
| **Adoption figures** — clubs, members, transactions, money processed | None recorded |
| **Case studies** | None |
| **Launch date, and the version 4 sunset** | Not stated anywhere. Nothing may imply one |
| **The marketing site's URL and assets** | `docs/WARM_THEME_IMPLEMENTATION.md` cites its design as the source of the in-app theme, but the site itself is not in this repository |
| **Brand guidelines beyond the mark and the palette** | No typographic or colour specification of record outside `DESIGN.md` |
| **Accessibility target** | No agreed standard, no audit. WCAG AA is the working floor |
| **Support model, SLAs, onboarding offer** | Not recorded |
| **Which organisation types exist commercially** | The model fixes currency and fee rates per type; the actual list of types sold is not in the repository |
| **Whether memberships elapse automatically overnight** | Version 4 did it nightly. `elapsed` is a status the new code knows; no scheduled job was found. Verify before claiming |

## 5. Screenshots and imagery

There is **no approved screenshot library**. `dash.png` sits at the repository root and
`.playwright-mcp/` holds several hundred automated captures, but neither is curated, dated or
cleared for external use.

The demo seed is the honest source for anything visual: four fictional clubs — **Meath Hunt Pony
Club** (everything switched on), **Kildare Hunt** (the shop), **Laois Hunt** and **Ward Union** —
with events, tickets, bookings, members and payments. Nothing in it is a real club.

Before any screenshot ships: it must come from seeded demo data, show a plausible club, and contain
no real person's name, email or payment detail.
