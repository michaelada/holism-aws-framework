# Changing a password and an email address without leaving the app

Members could already do both, but only by being sent to Keycloak's account
console and back. This brings the two into the account app itself, with Keycloak
updated underneath.

## 1. Requirements

### 1.1 What the member gets

| | |
|---|---|
| **R1** | Change their password from Profile & Settings, without leaving the app |
| **R2** | Change their email address from the same place, without leaving the app |
| **R3** | Be told, in their own language, exactly why a change was refused |
| **R4** | Never be redirected to a Keycloak-branded page for either |

### 1.2 What the platform must not give up

| | |
|---|---|
| **R5** | The current password is required for both changes |
| **R6** | Keycloak's password policy still applies, and its complaint is what the member sees |
| **R7** | A new email address is proven to belong to the member **before** it takes effect |
| **R8** | Keycloak and `organization_users` never disagree about an address |
| **R9** | A change is announced to the address that is losing control, not only the one gaining it |
| **R10** | Neither endpoint can be used to discover whether an address belongs to somebody else |

### 1.3 The two constraints that shaped the design

**An account user's Keycloak username *is* their email address.** The seed
creates them that way (`username: user.email`), so changing the address changes
the credential they sign in with. A mistyped address is therefore not a
misdirected newsletter — it is a login the member does not own, and a password
reset that can never reach them. This is why R7 exists and why the address is
verified before anything moves.

**Keycloak can set a password but cannot check one.** The Admin API has
`resetPassword` and no equivalent "is this the current password?". The only way
to answer that is to attempt a login, which needs a client with direct access
grants enabled — a realm change, and the reason §3.4 exists.

### 1.4 Out of scope

Org-admin users keep the console link they have today. Their identities are
managed by club administrators through Users, which is a different model from a
member managing their own, and folding both into one flow would have to answer
what an administrator sees when a member is mid-change. Nothing here prevents it
later — see §7.

## 2. Design — changing a password

```
member                     backend                    keycloak
  │  current + new            │                          │
  ├──────────────────────────>│                          │
  │                           │  password grant          │
  │                           │  (account-password-check)│
  │                           ├─────────────────────────>│
  │                           │<─────────── 200 / 401 ───┤
  │                           │                          │
  │                           │  users.resetPassword     │
  │                           ├─────────────────────────>│
  │                           │<──── 200 / policy error ─┤
  │<───────── 204 / 400 ──────┤                          │
  │                           │  "your password changed" │
  │                           │  to the current address  │
```

**The current password is checked by trying to use it.** A successful token
response proves it; a 401 disproves it. The tokens themselves are discarded —
this is an assertion, not a sign-in — and nothing is written until the check
passes.

**The policy message comes from Keycloak, not from us.** A realm can require
length, digits, mixed case, no reuse of the last N, and the rules can change
without this code being touched. Reimplementing them here would produce a second
opinion that eventually disagrees with the one that actually decides. What the
member sees is Keycloak's own `error_description`, so a form that passes our
checks and then fails on theirs cannot happen.

**A refused current password and a refused new password are different answers**
and read differently. Telling somebody "that didn't work" when their new
password was merely too short sends them to reset a password they knew.

## 3. Design — changing an email address

### 3.1 Nothing changes until the new address answers

```
   ┌──────────────────────────────────────────────────────────┐
   │ 1. current password + new address                        │
   │      ↓                                                   │
   │ 2. pending_email_changes row, token hashed at rest       │
   │      ↓                                                   │
   │ 3. mail to the NEW address     mail to the OLD address   │
   │    "confirm this change"       "a change was requested"  │
   │      ↓                                                   │
   │ 4. member clicks the link (any browser, no session)      │
   │      ↓                                                   │
   │ 5. keycloak email + username, and every organization_users│
   │    row for that identity, move together                  │
   └──────────────────────────────────────────────────────────┘
```

Until step 5 the member signs in exactly as before. A typo costs them an email
that never arrives, not their account — which is the whole point, given that the
address is the username.

### 3.2 Why the token is hashed, and single-use

The row stores a SHA-256 of the token, never the token itself. Anyone who can
read the table — a backup, a support query, a log — must not be able to complete
a change they did not request. It expires after **one hour**, and consuming it
marks it used in the same transaction that applies the change, so a link
forwarded or replayed does nothing the second time.

Requesting a change supersedes any earlier pending one for that identity. Two
live tokens for two different addresses is a question with no good answer.

### 3.3 What the confirmation must not reveal

The request endpoint answers the same way whether or not the new address is
already somebody else's. It has to: a member could otherwise use it to test
whether an address is registered with the platform, which is what R10 forbids.
The clash is detected, the change is not created, and the member is told by
**email to the address they gave** — the one place the answer is safe to send.

The confirmation endpoint is anonymous, because the link is opened from a mail
client that may not carry a session. The token is the authority. That is safe
because getting one requires the current password *and* control of the new
address.

### 3.4 The Keycloak client

A new confidential client, `account-password-check`, with direct access grants
on and a secret only the backend holds. The public `account-app` client is left
exactly as it is.

Enabling direct grants on the SPA client instead would have been less work and a
much wider door: a public client needs no secret, so anyone could post
username-and-password pairs at the token endpoint. Keeping it confidential means
the grant is usable only by something holding the secret.

## 4. Data

```sql
CREATE TABLE pending_email_changes (
  id                uuid PRIMARY KEY,
  keycloak_user_id  text        NOT NULL,
  new_email         text        NOT NULL,
  token_hash        text        NOT NULL,
  requested_at      timestamptz NOT NULL DEFAULT NOW(),
  expires_at        timestamptz NOT NULL,
  consumed_at       timestamptz
);
```

Keyed on the **Keycloak user id**, not on an `organization_users` row, because
the identity is what changes. A member of four clubs has four rows and one
address; a request made from one club's page changes it everywhere, and the
screen already says so.

`timestamptz`, not `timestamp` — the same reasoning as the hold-expiry migration
([BASKET_SOFT_HOLDS.md](BASKET_SOFT_HOLDS.md)): a column compared against `NOW()`
must store an instant, or it is right for half the year.

## 5. Screens

Wireframes: [ACCOUNT_SELF_SERVICE_CREDENTIALS_WIREFRAMES.md](ACCOUNT_SELF_SERVICE_CREDENTIALS_WIREFRAMES.md).

Both changes are dialogs over Profile & Settings rather than pages of their own.
They are short, they are finished in one go, and the member is on the settings
page precisely because they came to change something.

The confirmation link lands on a page of its own, because it is opened cold from
a mail client — often in a different browser, with no session and no memory of
what was being done.

## 6. Task breakdown

| # | Task | Where |
|---|---|---|
| 1 | `pending_email_changes` migration | `migrations/` |
| 2 | `account-credentials.service` — verify, change password, request, confirm | `src/services/` |
| 3 | Password + email-request routes | `account.routes.ts` |
| 4 | Anonymous confirmation route | `public.routes.ts` |
| 5 | Three notifications: verify, password-changed, change-requested | `email.service.ts` |
| 6 | Provision `account-password-check` | `scripts/seed/keycloak.ts`, setup docs |
| 7 | Two dialogs, a confirmation page, and the ProfilePage rewire | `account-shell` |
| 8 | i18n across six locales | `account-shell/src/locales` |
| 9 | Tests, both sides | |
| 10 | Docs, wireframes, module summaries | |

## 7. Deliberately left

**Org-admin self-service.** §1.4. The dialogs are account-shell components for
now; if this is wanted for the org-admin shell, the presentational half belongs
in `packages/components` and the endpoints would be mirrored under
`/api/organizations/:id/me`. Splitting them before there is a second caller
would be guessing at what the second caller needs.

**Signing other sessions out after a password change.** Keycloak's logout is
all-or-nothing per user, so it would end the session doing the changing.

**Rate limiting beyond the platform's.** `/api` already carries `apiRateLimit`.
A password-verification endpoint deserves a tighter, per-identity limit than a
catalogue read, and that is worth doing before this faces the public internet.
