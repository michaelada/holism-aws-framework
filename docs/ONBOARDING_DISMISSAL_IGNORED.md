# "Don't show this again" was ignored

**Two independent faults, either of which was enough on its own.** The first
discarded dismissals for four modules; the second made *every* dismissal, for
every module, fail with a 500. Fixing the first left the symptom untouched,
because the second was underneath it.

1. [The backend's module allow-list had gone stale](#fault-1--four-modules-were-not-on-the-list) → `400`
2. [The preferences table was keyed on the wrong identity](#fault-2--the-table-was-keyed-on-the-wrong-user-id) → `500`

## The symptom

An org-admin user opens a page, gets the module's introduction dialog, ticks **Don't show this
again** and presses **Got it**. The dialog closes. On their next visit to that module — after a
reload or a new login — the same dialog is back. Ticking the box again changes nothing. It looks
like the front end is ignoring the choice.

It was not ignoring it. It was being told "no" by the server, and not saying so.

## Fault 1 — four modules were not on the list

The dismissal is stored per user by `PUT /api/user-preferences/onboarding`, which validates
`modulesVisited` against its own list of module ids. That list was written when the app had seven
modules:

```
dashboard  users  forms  events  memberships  calendar  payments
```

The front end has eleven. **`merchandise`, `registrations`, `ticketing` and `settings`** were added
later, in `ModuleId` and in every locale's `onboarding.json` — so those modules had a proper
introduction dialog, with real content, whose dismissal the server refused:

1. The user ticks the box; `OnboardingProvider.dismissModuleIntro` closes the dialog and
   optimistically adds the module to `preferences.modulesVisited`.
2. The `PUT` is rejected — `400 INVALID_REQUEST`, "Invalid module IDs: settings".
3. The provider catches the error, logs to the console, and **reverts** the optimistic update.
4. Nothing appears on screen. The dialog has already closed, and `modulesShownThisSessionRef` keeps
   it from returning during this session — so the failure only becomes visible on the *next* login,
   by which time it does not look connected to the click at all.

Every side of this was internally consistent, which is why no test caught it: the front end sent
what it believed in, the backend validated against what *it* believed in, and each was tested
against its own belief.

### The fix

One list per side, and a test that they are the same set.

| Where | What |
|---|---|
| `packages/orgadmin-shell/src/context/OnboardingContext.tsx` | `MODULE_IDS` — a `const` array; `ModuleId` is now derived from it, so the type cannot drift from the value |
| `packages/backend/src/utils/onboarding-modules.ts` | `ONBOARDING_MODULE_IDS` + `isOnboardingModuleId`, used by the route |
| `packages/orgadmin-shell/src/__tests__/context/OnboardingProvider.module-parity.test.ts` | Reads the backend source and asserts the two sets match |

The backend keeps a copy rather than importing one: it does not depend on a front-end package, and
a cross-package import for eleven strings would be a worse coupling than a test that reads a file.
The parity test is what makes the copy safe — remove a module from either side and it fails by name.

**Adding a module now means adding it in both places.** The parity test will tell you if you forget,
which is the whole point: the previous failure mode was silence.

## Fault 2 — the table was keyed on the wrong user id

With the list fixed, the request got past validation and hit this:

```
error: insert or update on table "user_onboarding_preferences" violates foreign key constraint
       "user_onboarding_preferences_user_id_fkey"
detail: Key (user_id)=(18dda575-…) is not present in table "organization_users".
```

`user_onboarding_preferences.user_id` was declared `uuid REFERENCES organization_users(id)`. Every
writer passes `req.user.userId` — **the Keycloak subject from the JWT**. Those are two different
identifiers of two different things (`organization_users` even stores the Keycloak id separately, in
`keycloak_user_id varchar(255)`), so no write could ever satisfy the constraint. Every save had been
returning 500 since the feature shipped.

It stayed invisible because the read path fails soft: `getOnboardingPreferences` returns defaults
when it finds no row, which is indistinguishable from "this user has dismissed nothing". The feature
appeared to work and quietly forgot everything.

### Why the Keycloak id is also the right key

An onboarding preference is about a **person** — "I have read the events introduction" — not about
one of their memberships. Someone who administers two organisations has two `organization_users`
rows and should not be introduced to the same module twice.

There is no foreign key to replace it, on purpose: identity lives in Keycloak, not in this database.
`organization_users.keycloak_user_id` is a bare `varchar` with no table behind it, and the `users`
table is written only by the super-admin user service — org-admin and account users never appear
there, so pointing at it would reproduce the same failure through a different constraint.

### The fix

`1709000000019_onboarding-preferences-keycloak-user-id.js` drops the constraint, retypes `user_id`
to `varchar(255)`, and translates any row that did get stored (via `organization_users.id` →
`keycloak_user_id`), folding duplicates — one person, several memberships — into a single row whose
dismissals are the union. Dismissals are additive, so the union is the answer that respects every
click the user made.

**This is a schema change: run `npm run migrate:up --workspace=packages/backend`.** Until it is
applied, the endpoint keeps returning 500 no matter what the front end sends.

## Tests

- `packages/backend/src/routes/__tests__/user-preferences.routes.test.ts` — the `PUT` accepts a
  dismissal for **every** module id individually (a loop, not a sample — a sample is exactly what
  missed this), all of them at once, and still refuses ids that are not modules.
- `packages/orgadmin-shell/src/__tests__/context/OnboardingProvider.module-parity.test.ts` — the two
  lists are the same set, name the four modules the drift actually cost, and neither has duplicates.
- `packages/backend/src/__tests__/migrations/onboarding-preferences-keycloak-user-id.test.ts` — runs
  the migration's **own SQL** against the test database: the resulting shape, a dismissal stored for
  a Keycloak user with no `organization_users` row (the write that produced the 500), the
  translation and merge of pre-existing rows, a round trip through `userPreferencesService`, and the
  rollback.

The suite that existed before all this — `onboarding-preferences-migration.test.ts` — asserted the
foreign key was present, against DDL it wrote itself. That is why it passed throughout: it tested a
paraphrase of the schema, never the real table, and never stored a Keycloak id. Its header now says
so. **A migration test that does not execute the migration is not a migration test.**

## Worth knowing

A failed save is still silent to the user: `OnboardingProvider` logs to the console and reverts. That
is defensible — the preference genuinely was not stored — but it means any future failure of this
endpoint (a 500, an expired token, an offline moment) will look exactly like this bug did. If it
recurs, check the browser console for `Failed to save module intro preference` before looking at the
dialog logic.
