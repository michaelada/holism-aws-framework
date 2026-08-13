# Registration approval — the org-admin side (I3 / I4)

Phase 5 built the whole approval mechanism on the server: the `registration` block in
`organizations.settings`, the pending/approve/reject endpoints, and the emails. Nothing ever called
them. A club that turned auto-registration **off** could take registrations and then had no way to
let anyone in — members reached the awaiting-approval screen and stayed there.

This adds the two screens that close that loop.

---

## 1. I4 — Registration settings

`packages/orgadmin-core/src/settings/components/RegistrationSettingsTab.tsx`, a fifth tab on
**Settings**.

| Control | Effect |
|---|---|
| **Approve registrations automatically** | ON — a member can sign in as soon as their email is verified. OFF — an administrator must approve them first, and until then they see the awaiting-approval screen (A8). |
| **Notification emails** | Who is told when someone registers. |

Reads and writes `GET`/`PUT /api/orgadmin/organisation/registration-settings`, which returns
`{ autoRegistration, notificationEmails }`.

### The warning that matters

Approval required **and** nobody notified is the combination that quietly strands people: requests
sit in a queue no one is watching, and the members who made them are locked out with no explanation
and no way to chase it. The tab detects exactly that pair and says so, rather than leaving a club to
discover it from a complaint months later.

Email validation mirrors the backend's own pattern, so the form rejects what the API would. Duplicate
detection is case-insensitive — the same inbox added twice would simply be mailed twice.

---

## 2. I3 — Registrations

`packages/orgadmin-core/src/users/pages/RegistrationsPage.tsx`, route `/users/registrations`.

Three tabs — **Awaiting approval**, **Approved**, **Not approved** — over
`GET /api/orgadmin/organisation/registrations?status=pending|active|rejected`.

Three rather than one list, because a refusal is not a deletion. The row remains, and being able to
see it is what answers the phone call that begins "I registered last week and I still can't sign in".
The approved tab answers "did I already deal with this person?" without a search.

Approve and refuse both post to
`POST /api/orgadmin/organisation/registrations/:id/decision` with `{ decision, note? }`.

### Decisions are confirmed, and the note is internal

Both actions open a dialog. Approving grants access to the club's data and refusing locks a real
person out; neither belongs behind a single click in a dense table.

The note is recorded for the club **only** — the member never sees it, and the awaiting-approval
screen deliberately gives no reason for a refusal ([A8](ACCOUNT_USER_APP_WIREFRAMES.md#a8--awaiting-approval)),
because a reason shown to the person refused invites an argument the platform cannot adjudicate. The
dialog says so under the field, or an administrator will write it as though it were a message.

After a decision the list reloads rather than dropping the row locally: the row moves to a different
tab, and the other tabs' contents change with it.

### Route ordering

`users/registrations` is declared **before** `users/:type/:id` in `src/users/index.ts`, or it is read
as a user-detail page for a member whose id happens to be "registrations".

---

## 3. Two things found while building this

**A misleading empty state.** On a failed load the page showed the error *and* "No registrations are
waiting for approval." The reassuring half is the one an administrator believes, so a queue of real
people would look empty. The empty state is now suppressed when the load failed. A test caught this,
not a review.

**An infinite render loop.** Both components originally had `load` as a `useCallback` depending on
`t`. `t` is not reliably a stable reference, so the mount effect re-ran on every render and the
screen span forever instead of failing visibly — CLAUDE.md §3.4, and it presented as "nothing
renders" rather than as a loop.

Fixed in the components rather than the test mocks: errors and notices are now held as **i18n keys**
and translated at render, so `load` depends only on `execute` and `status`. That is the more robust
shape regardless of how `t` behaves.

---

## 4. Tests — 25, all passing

`RegistrationSettingsTab.test.tsx` (11) covers both settings, the approval-without-recipients
warning and its absence when auto-registration is on, email validation, case-insensitive duplicates,
removal, saving both together, and both failure paths.

`RegistrationsPage.test.tsx` (14) covers the three tabs, that past-decision lists offer no action
buttons, that both decisions confirm first and send nothing until confirmed, the note reaching the
API, the "never shown to the member" hint, cancelling cleanly, reloading after a decision, the empty
queue, and both failure paths.

`packages/orgadmin-core` is now **648 passing, 0 skipped, 0 failing** (was 623).

---

## 5. Translations

46 new keys under `settings.registration.*` and `users.registrations.*`, added to **all six**
locales (§3.2).

Note for anyone touching these files: the org-admin catalogues carry substantial **pre-existing**
drift — `de-DE`, `it-IT` and `pt-PT` are each missing ~394 keys that exist in `en-GB`, and `fr-FR`
and `es-ES` about 322. That predates this work and was not addressed here, but it means a whole-file
key comparison will look alarming. The 46 keys added here are aligned across all six.

---

## 6. Still not done

- **No count badge** on the menu item, so an administrator has to open the page to discover a queue
  is waiting. The notification emails are the only prompt today.
- **No bulk approve.** Each decision is individual, which is right for a small queue and tedious for
  a club that has just switched approval on with a backlog.
- **The refusal is not final** in any enforced sense — nothing stops a refused member registering
  again; they simply reappear in the pending queue.
- **`GET /registrations` is unpaginated.** Fine for a queue, wrong for the `active` tab at a club
  with thousands of members.
