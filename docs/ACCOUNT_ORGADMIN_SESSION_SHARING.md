# Signing in to org-admin signs you in to the account app

## The report

> If I log into org-admin, and then try to go to accounts, it tries to log me into accounts using
> my org-admin credentials/token. Can I have one tab signed in as an administrator and another
> signed in as a member, without the users getting mixed up?

## What is actually shared

Not tokens. Neither shell puts a token in `localStorage` — keycloak-js keeps them in memory, per
tab — and the only thing either persists is `orgadmin.currentOrganisationId`.

What is shared is **Keycloak's SSO session**: one cookie on the Keycloak origin, scoped to the
realm, used by every client in it. Both front ends point at realm `aws-framework`:

| App | Client | `onLoad` |
|---|---|---|
| org-admin (`:5175`) | `orgadmin-client` | `login-required` — every screen is behind a login |
| account (`:5176`) | `account-app` | `check-sso` — A1 and A2 are public and must render anonymously |

`check-sso` is what produces the report. It asks Keycloak whether a session exists and adopts it
silently if one does, drawing no form. That is deliberate: forcing login on load would bounce every
anonymous visitor away from the public directory. But it means that after signing in to org-admin,
opening a club link authenticates you as your administrator identity without saying so.

## Can two tabs hold two different users?

**No, not in one browser profile**, and no application change makes it so. The SSO session is one
per browser per realm. The isolation boundary is the cookie jar, so the answer is a **second browser
profile, a private window, or a Firefox container**.

`prompt=login` in the second tab looks like a way around it and is a trap. It creates a *new*
Keycloak session and repoints the cookie. The org-admin session survives server-side (this realm
sets no session limit; idle 30 min, max 10 h) and its token keeps refreshing, so for a while you do
appear to have two. Then you reload the org-admin tab — which initialises with `login-required` — it
round-trips to Keycloak, Keycloak reads the *new* cookie, and the tab comes back silently signed in
as the account user. Two tabs, no prompt, wrong identity, and nothing on screen to say so. That is a
worse failure than the one being fixed.

Separate realms per app would give genuinely independent sessions, since realm cookies are scoped
per realm. It is a large change and it breaks the current model, in which one person can be both an
administrator and a member on one identity. Not worth it unless dual sessions become a requirement.

## What changed

The silent adoption cannot be intercepted — it happens inside `kc.init`. What can change is the
first screen that knows the adopted identity does not fit the club, which is where the person
actually notices something is wrong. Two screens: `NotConnectedPage` (A6) and `AwaitingApprovalPage`
(A8).

| | Before | Now |
|---|---|---|
| Whose session is this? | Not stated anywhere | `Signed in as Sam Rivers (member@example.com)`, above the body |
| Enrolment button | "Create an account" | "Create an account for Sam Rivers (member@example.com)" |

`SignedInAs` (`src/components/SignedInAs.tsx`) renders the line; `describeUser` formats it. The
email is always included, never dropped in favour of the name — it is the part that tells somebody
they are signed in as their administrator account rather than as themselves.

The button label matters as much as the banner. Unlabelled, "Create an account" enrolled whoever
the session happened to be into a club they were only looking at, which is the one action on that
screen that is hard to undo — and the code comments already lamented "offering to enrol the wrong
person" without doing anything about it.

**No primary action was reordered.** Two journeys end on A6 — a member of another club deliberately
joining this one, and a mis-adopted session — and nothing in the request distinguishes them.
Promoting "Sign in as someone else" would be a guess in the other direction. Naming the identity
lets the reader decide, which they can do instantly and the code cannot.

## Tests

- `src/components/__tests__/SignedInAs.test.tsx` — the name-and-email format, the email kept when
  the name is unambiguous, the email-only fallback, no stray space when only one name part is set,
  and nothing rendered without a user.
- `src/pages/__tests__/NotConnectedPage.test.tsx` — the identity is named, the enrolment button
  names it, and the plain label returns when there is no user.
- `src/pages/__tests__/AwaitingApprovalPage.test.tsx` — the identity is named there too, because
  "awaiting approval" otherwise reads as the club being slow when it is really the wrong account in
  the queue.

`renderWithProviders` now supplies a whole user rather than `{ id, email }`, matching what the real
hook sets from the token's claims.

Six locales, two keys each: `common.signedInAs` and `notConnected.registerAs`.
