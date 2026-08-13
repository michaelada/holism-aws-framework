# Account User Application — Profile & settings (P1, P2)

`/profile` has been in the account app's navigation since the shell was built, and it went nowhere:
no route matched, so the catch-all bounced the member back to the home page. This adds the screen
behind it.

Specified by [P1 and P2](ACCOUNT_USER_APP_WIREFRAMES.md#p-profile).

## 1. One identity, many clubs — the rule everything here follows

A member has **one** Keycloak account and one `organization_users` row per club they belong to.
Their name, phone and language belong to the identity; only the membership belongs to the club.

So an edit is written to Keycloak **and to every one of that identity's `organization_users` rows**,
not just the club whose URL the request arrived on. Updating one row is the obvious implementation
and it is wrong: the copies drift, and a member who corrects the spelling of their name at the
tennis club stays misspelled on the pony club's start list.

The screen says so out loud — but only when there is something to say. With one club there is
nothing to warn about; with several, an info banner names the count, because a member changing their
mobile for one club needs to know it changes for all of them.

The count is taken by `keycloak_user_id`, not by email. The identity is what is actually shared; an
email is only its current label, and matching on it would silently regroup people if one were ever
reused.

## 2. Email and password are deliberately not edited here

Both are identity credentials whose change flows are only safe with verification. An unverified
email change moves the address a member signs in with — a typo locks them out permanently, and no
amount of client-side validation prevents a valid address that is not theirs.

Keycloak's account console already implements both flows correctly, including the verification mail.
This screen shows the email **read-only** and hands off there (P2) rather than reimplementing
verification against the admin API. The route uses `keycloak.createAccountUrl({ redirectUri })`
rather than a hand-built path, so the console receives the referrer parameters that give it its own
"back to application" link.

An interstitial explains the handoff first. Leaving the app for a different site mid-task is
disorienting without warning, and the member needs to know they will be brought back.

## 3. Language preference, stored twice on purpose

`organizations.language` decides what a club's members see. A member who reads French in an Irish
club has had no way to say otherwise. P1 adds that, and the value is written to **two** places for
two different readers:

| Where | Read by | Why not the other one |
|---|---|---|
| `organization_users.preferred_language` (migration `1709000000016`) | The app, on every organisation resolve | A Keycloak admin round trip on every page load, with a failure mode that blanks the language when Keycloak is briefly unavailable |
| The Keycloak user's `locale` attribute | Keycloak's **own login page** | No column of ours can affect the sign-in screen |

The column is duplicated per club exactly as `first_name` and `phone` already are, and kept
consistent the same way — every row for the identity is written, never just one.

`null` means "follow the organisation". That is the default and what nearly every member does, so it
is a real value rather than a gap.

**Where it takes effect:** `OrganisationRoute` already chose the locale from the organisation once it
resolved. It now prefers the member's own — the club sets what its members generally read, and a
member who has said otherwise has given the more specific instruction. `GET /me` carries
`user.preferredLanguage` so this costs no extra request.

After saving, the page applies the language immediately rather than waiting for the next load. A
member who has just chosen French and is still looking at English has no way to tell whether the
setting took.

## 4. Keycloak first, and fatally

`updateProfile` writes Keycloak **before** the database, and a Keycloak failure aborts the whole
update rather than being logged and stepped over.

This is the opposite call from `account-user.service.ts`, where an administrator editing someone
else logs a Keycloak failure and continues — and the difference is deliberate. There, the
administrator's local edit is still worth keeping. Here the member is editing their own identity,
and a database row that disagrees with Keycloak is exactly the drift this service exists to prevent:
a profile screen showing a name the login does not know about.

## 5. Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/account/:orgCode/profile` | No capability gate — every member has an identity to maintain, whatever the club has enabled |
| PUT | `/api/account/:orgCode/profile` | Accepts `firstName`, `lastName`, `phone`, `preferredLanguage` only |

The PUT body is **whitelisted in the route**, not passed through. `email` or `status` reaching the
service from a request body would be a privilege escalation.

The `UPDATE` is scoped to `user_type = 'account-user'`, so a member editing their own details can
never reach an org-admin record that happens to share the Keycloak id.

## 6. Not in this phase

- **A profile photo.** Not in P1, and it needs upload plumbing and a storage decision.
- **Notification preferences.** Not specified anywhere yet.
- **Deleting the account.** No requirement, and it needs a decision about what happens to a member's
  entries, memberships and payment history first.
- **Offline.** The wireframes mark Profile "⚠ View only" offline; there is still no service worker
  in `account-shell`, so this is unaffected either way.

## 7. Tests

| Suite | Covers |
|---|---|
| `account-profile.service.test.ts` (15) | Detail shape; organisation count by identity not email; unsupported stored language ignored; every identity row updated; org-admin rows untouched; Keycloak written including `locale`; database not written when Keycloak refuses; language validation; partial updates; clearing a phone |
| `ProfilePage.test.tsx` (11) | Load, display, read-only email, save, empty phone as null, immediate locale switch, the shared-details warning appearing only above one organisation, the P2 interstitial and its return URL, load failure |

Translations added to all six account-shell locales.
