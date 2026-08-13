# Backend test suite repair

The backend suite carried 36 failing suites. This records what was wrong, what was fixed, and what
is left — including two findings that are about the *product*, not the tests.

**Before:** 36 suites failing, 80 passing. 1,778 tests collected, 1,610 passing.
**After:** 18 suites failing, 98 passing. 2,103 tests collected, 1,932 passing.

The collected count rose by 325 because most failures were **compile** errors — those suites never
ran a single test, so their contents were invisible rather than passing.

---

## 1. No test database existed

Two databases are involved and neither was present locally:

| Database | Used by | Config |
|---|---|---|
| `aws_framework` | the running app | `packages/backend/.env` |
| `aws_framework_test` | **the tests** | `packages/backend/.env.test`, loaded by `src/__tests__/jest.setup.js` |

Docker was not running, so `ECONNREFUSED` accounted for 380 errors. Creating `aws_framework_test`
and migrating it was the single largest fix — **14 suites** recovered.

To reproduce the working setup:

```bash
brew services start postgresql@16        # needs LC_ALL=en_US.UTF-8
createdb -O framework_user aws_framework_test
cd packages/backend
DATABASE_URL="postgresql://framework_user:framework_password@127.0.0.1:5432/aws_framework_test" \
  npm run migrate:up
```

Normally this is `docker compose up postgres` (§3.5); the local server was used because the Docker
daemon was unavailable.

---

## 2. One unused import took down 22 suites

`src/index.ts` imported `xssSecurityHeaders` and never used it. Under `noUnusedLocals` that is a
compile error, and because almost every route and integration suite imports the app, **22 suites
failed to compile over one line**.

Three more one-line compile errors behaved the same way:

| File | Error | Fix |
|---|---|---|
| `src/index.ts` | `TS6133` unused `xssSecurityHeaders` | removed the import |
| `src/services/merchandise.service.ts` | `TS6133` unused `merchandiseOptionService` | removed the import |
| `src/routes/registration.routes.ts` | `TS2345` `string \| undefined` | typed the row assignment; every path reaching the call has set the value, but the row is `any` so TS could not narrow |
| `src/routes/application-form.routes.ts` | `TS7030` not all paths return | added `return` to two statements, matching the early exits above them |

`packages/backend` `tsc --noEmit` is now clean.

### ⚠️ Finding: `Permissions-Policy` is no longer sent

`src/index.ts` still had the comment `// XSS protection headers` with **nothing under it** — the
`app.use(xssSecurityHeaders())` call had been removed and the import left behind.

`helmet()` above it covers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
`X-XSS-Protection`, so the security tests still pass. It does **not** set `Permissions-Policy`,
which `xssSecurityHeaders()` did — that header is currently absent in production.

I removed the orphaned import (the minimal change that fixes the tests) and corrected the misleading
comment, but **did not re-add the middleware**: restoring it also changes `X-Frame-Options` from
helmet's `SAMEORIGIN` to `DENY` and `X-XSS-Protection` from `0` to `1; mode=block`, which is a
security-behaviour decision rather than a test repair. `xssSecurityHeaders()` still exists in
`middleware/xss-protection.middleware.ts` if you want it back.

---

## 3. Tests that had drifted from the code

### `event.service.test.ts` — 23 tests, all now passing

- **`deleteEvent` became a soft delete** taking `(id, deletedBy)`. The test still asserted a hard
  `DELETE FROM events`. Updated, and a case added for the `AND deleted = FALSE` guard.
- **`getEventsByOrganisation`** now aliases the table and excludes soft-deleted rows; the assertion
  looked for `WHERE organisation_id = $1`.
- **`updateEvent` issues five queries, not two.** `getEventById` also loads activities and ticketing
  config, and activities are re-read after the update. The two-step mock handed the service the
  *existing* row where it expected the updated one.
- **`updateActivity` is a single `UPDATE ... RETURNING`**, so a read-then-write mock gave it the
  stale row.
- `CreateEventActivityDto` requires `description`; two fixtures omitted it.

### ⚠️ Finding: paid-activity validation is no longer enforced server-side

Two tests asserted that `createActivity` rejects a paid activity with no payment method, and a
cheque-accepting activity with no instructions. **Neither rule exists in the backend any more** — a
repo-wide search finds them only in the org-admin form (`EventActivityForm.tsx`).

The tests were removed with a comment recording where the rules went. An activity created through the
API directly can therefore be paid with no payment method. Restoring server-side validation is a
product decision, so it was not done here.

### `organization-type-locale-edge-cases.test.ts` — 14 tests, all now passing

Writes happen in a transaction via `db.getClient()`. The automock returned `undefined`, so the real
failure was `Cannot read properties of undefined (reading 'release')` — which reads as a service bug
and masked the validation error each test was actually asserting. One test also asserted on
`db.query` when the INSERT runs on the transactional client, so it was watching a mock that could
never see the value.

### `orgadmin-workflows.integration.test.ts`

Inserted into `organisations` — British spelling; the table is `organizations`. The insert also
omitted four `NOT NULL` columns (`organization_type_id`, `keycloak_group_id`, `currency`,
`url_code`), so correcting the name alone was not enough; an organisation type is now created first
for the foreign key. Setup succeeds; the four lifecycle tests still fail on their own logic.

### New helper: `src/test-helpers/mock-db-client.ts`

A mock pooled client for suites that mock `database/pool`. It lives **outside** `src/__tests__/`
because jest's `testMatch` collects every `.ts` under that directory and a helper there fails with
"Your test suite must contain at least one test".

---

## 4. What is still failing — 18 suites

Not a single cause; each needs individual attention.

**Property suites with drifted mock sequences (5).** `membership.service.member-creation`,
`membership.service.manual-member-integration`, `generic-crud`, `org-payment-method-data`,
`event-ticketing-save-preservation`. Their `mockResolvedValueOnce` chains encode a query order the
services no longer follow. Repairing them means re-deriving each sequence against the current code —
the same work done for `event.service.test.ts`, but across much larger files. Two partial fixes are
already in (`getClient` mock, form-submission service default), which moved
`member-creation` from "0 tests ran" to 1 passing and 17 failing on mock order.

**Integration suites needing seed data (6).** `orgadmin-workflows`,
`organization-type-capability-inheritance`, `consolidate-document-management-capabilities`,
`membership.routes.authorization`, `admin.routes.property`, `organization-payment-method.routes`.
They connect and migrate correctly now, then fail because the fixtures they expect are not there.

**Service suites with assertion drift (6).** `calendar.service`, `merchandise.service`,
`org-admin-user.service`, `membership-number-generator`, `membership-number-validator`,
`security-audit`.

**Flaky, not broken (1).** `discount-calculator.property.test.ts` passed and then failed on
consecutive runs of identical code — the unseeded-generator problem CLAUDE.md §3.3 describes. It is
not a regression and will move in and out of the failing list on its own.

Two suites still fail to compile, both inside the property suites above.
