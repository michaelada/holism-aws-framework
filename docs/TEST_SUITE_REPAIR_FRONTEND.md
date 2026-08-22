# Front-end test suite repair

Every suite in the repository now passes: 12 front-end packages, the backend
Jest suite, and the root project-structure suite. This records what was broken,
why, and the few places where the *source* was wrong rather than the test.

## Where it started

A full run reported **201 failing tests across nine areas**, plus two packages
exiting non-zero on unhandled promise rejections. None of the failures were
caused by work in progress — they had accumulated as pages changed and the
tests describing them did not.

| Area | Before | After |
|---|---|---|
| `orgadmin-events` | 112 failing | 206 passing |
| `orgadmin-registrations` | 42 failing | 239 passing |
| `orgadmin-ticketing` | 15 failing | 34 passing |
| `admin` | 11 failing | 308 passing |
| `components` | 10 failing | 410 passing |
| `orgadmin-merchandise` | 5 failing | 40 passing |
| `account-shell` | 3 failing | 673 passing |
| `orgadmin-calendar` | 2 failing | 35 passing |
| root Jest | 1 failing | 47 passing |

The backend's 280 failures were environmental: Docker was not running, so every
suite that talks to Postgres failed with `ECONNREFUSED`. With the database up it
passes 3212 tests unchanged.

## The single biggest cause: partial mocks of the shell

Roughly 490 of the failures came from one shape of mistake. Each suite wrote its
own `vi.mock('@aws-web-framework/orgadmin-shell', () => ({ ... }))` listing only
the hooks its page happened to call when the test was written. When
`usePageHelp`, `useOnboarding`, `useLocale` and `useCapabilities` were later
added to pages, every one of those mocks became incomplete at once and Vitest
failed the render with *"No `usePageHelp` export is defined on the mock"* — a
test for the Add Member button breaking because of an unrelated help hook.

### The fix

[`packages/orgadmin-core/src/test/shellMock.ts`](../packages/orgadmin-core/src/test/shellMock.ts)
provides `createShellMock()`, a stand-in covering the shell's whole export
surface. A suite starts from it and overrides only what it cares about:

```ts
vi.mock('@aws-web-framework/orgadmin-shell', async () => ({
  ...(await import('@aws-web-framework/orgadmin-core/test/shellMock')).createShellMock(),
  useCapabilities: () => ({ hasCapability: () => false, capabilities: [] }),
}));
```

By default `t` resolves the **real en-GB catalogue**, so assertions read as the
text an administrator sees rather than as key paths; a package whose suites
assert on keys passes `{ t: translateToKey }`.
[`__tests__/shellMock.test.ts`](../packages/orgadmin-core/src/test/__tests__/shellMock.test.ts)
reads `orgadmin-shell/index.ts` and fails if the mock has fallen behind, so the
next export added to the shell cannot silently reintroduce the same breakage.

`orgadmin-events` mocks the shell once for the whole package in
`src/test/setup.ts`; that file now starts from the shared mock too, and mocks
`orgadmin-core` with `importOriginal()` rather than a hand-written list — which
is why `AuthTokenContext` was missing and every page using `useDiscountService`
died on `useContext(undefined)`.

## Source defects the tests were right about

Nine failures were the tests reporting real problems:

- **`FieldDatatype.PHONE` did not exist.** `applicationField.ts` mapped the form
  builder's `phone` fields to `FieldDatatype.PHONE`, which evaluated to
  `undefined`, so every phone field fell through to plain text and accepted a
  sentence. The validator had known how to check a phone number all along; the
  datatype was simply never named. Added to `metadata.types.ts`.
- **`MultiSelectRenderer` had no checkbox mode.** The builder's `checkbox` field
  maps to a multi-select and asks for its choices laid out, but the renderer only
  ever drew a dropdown — so a checkbox list and a dropdown were the same control.
  It now renders a labelled `FormGroup` of checkboxes when
  `datatypeProperties.displayMode === 'checkbox'`, which also fixed the
  account-shell entry-form failures.
- **A hyphen could not be typed into an organisation type's name.** The admin
  create page stripped leading *and trailing* hyphens on every keystroke, so
  "test-org" could only be entered as "testorg". Trailing hyphens are now trimmed
  on submit instead.
- **`EventsListPage`'s status filter had no accessible name.** Its `InputLabel`
  carried no `id` and the `Select` no `labelId`, so the filter was an unlabelled
  combobox to a screen reader. Both added.
- **`EventDetailsPage` showed a bare spinner.** It now says what is loading, as
  the other detail pages do — new key `events.loadingEvent` in all six locales.
- **`EventActivityForm` crashed on a non-array response.** `setApplicationForms(response || [])`
  stored an error body and the render died on `.map`; it now checks
  `Array.isArray`.

## Tests that described a UI that no longer exists

The rest were assertions left behind by the pages they cover:

- **Discount API shape.** `CreateEventPage` and `DiscountsListPage` tests
  resolved a bare array where the endpoint answers `{ discounts, total }`, so the
  selector and the table were always empty.
- **Discounts are a multi-select, not a checkbox.** Tests clicked a checkbox that
  gated the picker years ago; they now open the `DiscountSelector` combobox.
- **Editing a discount is not a wizard.** An existing discount opens as one form
  with a sticky save bar; the tests still clicked *Next* four times looking for
  an *Update* button.
- **Call-order mocks.** Several `mockResolvedValueOnce` chains were consumed by
  requests the page makes first (membership types, user groups, application
  forms). They now answer by URL.
- **`useApi.execute` never throws.** It resolves to `null` and reports through
  `error`; tests that rejected the spy were exercising a path that cannot happen.
- **The role form asks for two fields, not three.** The role's identifier is
  derived from the display name.
- **The README test pinned a product name** the project no longer uses.

## Property tests that never ran

`fc.assert(fc.asyncProperty(...))` was not awaited in six files. Those tests
passed without ever running to completion, and their rejections surfaced after
the suite had finished — which is what made `components` and
`orgadmin-memberships` exit non-zero while reporting every test as passing.
Adding `await` uncovered four genuine problems:

- `MuiStep-completed` is not a MUI class (it is the global `Mui-completed`), so a
  completed-step count was always zero.
- `input.blur()` dispatches nothing when the element was never focused, so
  `FieldRenderer`'s blur validation never ran under test.
- A generated rule's own `message` — often `" "` — is what the validator shows,
  so asserting on default wording was wrong; the property now asserts the field
  is reported invalid.
- Generators produced fields with two `max_value` rules, which the schema
  resolves last-wins; the generator now yields one rule per type.

Two properties that mount a whole page were also asked to do far too much work
for a five-second timeout — 100 full mounts, and per-character typing — and have
been given run counts and timeouts that match what they do.

One more intermittent, in `orgadmin-registrations`: a property compared the
**UTC** day of a generated date against output `formatDate` renders in the
reader's timezone, so it failed only for the instants that straddle local
midnight — 23:00Z on a British Summer Time evening is already tomorrow here.

## The 25 skipped tests

Every `it.skip` / `describe.skip` in the repository has been repaired and
re-enabled. None of them were skipped for a reason that survived a look.

### "Validation timing issue in test environment" — 8 in `admin`

`PasswordResetDialog` and `UserForm` both submitted an empty form and waited for
messages like *"Password is required"*. Those messages never appeared, and the
comment blamed the test environment. The environment was right: every field is
`required`, so the browser refuses to submit while any is blank and the
component's own `validateForm` never runs at all.

Filling a field with **spaces** satisfies the browser and still fails `trim()`,
which is the path that reaches the component's message — and is a real thing a
user can do. Where a browser check shadows an app check entirely, the test now
says so: `type="email"` rejects whitespace outright, so the email-format test
uses `user@localhost`, which the browser accepts and the form's stricter regex
does not. Two tests were added covering the browser's own refusal.

### "Dialog rendering issue" — 1 in `admin`

`UsersPage` looked for `/^new password$/i`. MUI renders a required field's label
as "New Password **\***", so the anchored pattern matched nothing. The dialog had
been rendering correctly all along.

### "Whitespace handling in testing-library" — 2 in `admin`

The library was behaving correctly: it normalises whitespace on both the query
and the DOM, so a generated display name of `" !"` is looked up as `"!"` and
cannot be told apart from its neighbours. The generator now produces text shaped
like something a person would actually type.

### 500 instead of 400 on a foreign-key violation — 2 in `backend`

A real API defect, not a test problem. `POST /organizations/:orgId/payment-methods`
decided whether an id was bad by testing `error.message.includes('foreign key')`,
but the service had already translated Postgres's `23503` into `"Organization not
found"` / `"Payment method not found"` — neither of which contains that phrase.
A request naming a non-existent organisation got a 500 it could have been told
how to fix. The route now matches on what the service actually throws.

### The migration rollback suite — 12 in `backend`

`payment-methods-migration-rollback.test.ts` proves a down migration works by
building the tables and dropping them. In `public` that deletes the tables every
later suite depends on — the backend tests share one database in a single jest
worker — so the whole suite was `describe.skip`.

It now runs entirely in a `migration_test` schema: the pool's `search_path`
points at it, every catalogue query is scoped to it (`information_schema` and
`pg_indexes` both take a schema), and it is dropped when the suite finishes.
Verified afterwards that `public.payment_methods` and
`public.org_payment_method_data` are still there and that no scratch schema is
left behind.

## Running it

```bash
docker compose up -d postgres   # the backend suite needs a live database
npm test                        # root Jest, then every workspace
```
