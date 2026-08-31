# Audit trail, and who is signed in

**Status: built.** Every phase below is in the working tree, including the
org-admin viewer that was Phase 4's optional item.

Two requests, related enough to share a screen area in Platform Admin and
almost nothing else:

1. See who is signed in right now, and force them to sign in again.
2. A meaningful audit trail of everything happening in the system — super
   admins, org admins and account users — searchable by organisation, user,
   user type, action type and free text.

---

## 0. What exists today, and why it does not work

This matters, because the honest starting point is not "greenfield".

| Thing | State |
|---|---|
| `admin_audit_log` | **0 rows.** FK `user_id → users(id)` |
| `organization_audit_log` | **1 row.** `organization_id`, `entity_type`, `entity_id`, `changes` |
| `audit-log.service.ts` | Exists, 226 lines. Called from **one** file — `admin.routes.ts` |
| `users` table | **0 rows.** The platform's identity is `organization_users.keycloak_user_id` |

**The existing audit log cannot say who did anything.**
`extractUserIdFromRequest` resolves the actor by
`SELECT id FROM users WHERE keycloak_user_id = $1`. That table is empty, so the
lookup misses, the method logs a warning and returns `null`, and every row is
written with a null actor. An audit trail that records *what* but never *who* is
not an audit trail.

Two further problems worth naming before designing on top:

- **Two tables with the same job.** One keyed to the platform, one to an
  organisation. Any new work has to pick, and every reader has to union them.
- **`logAdminAction` rethrows on failure.** An audit write that fails takes the
  user's action down with it. That is the wrong trade for a log — see §2.6.

**Recommendation: replace both tables and the service** with one design, and
migrate the single existing row. This is proposed as part of Phase 1 rather than
as a separate cleanup, because building the requested feature on the current
foundation means inheriting the null-actor bug.

---

## Part 1 — Who is signed in, and forcing a re-login

### 1.1 Where the truth lives

Keycloak, not us. It holds the sessions; the applications hold only tokens. So
this screen is a **read through to the Keycloak Admin API**, joined to our own
tables for names and organisations.

`keycloak-admin.service.ts` already exists and authenticates against the Admin
API. It needs three new methods:

| Purpose | Admin API |
|---|---|
| Sessions per client | `GET /admin/realms/{realm}/clients/{id}/user-sessions` |
| Sessions for one user | `GET /admin/realms/{realm}/users/{id}/sessions` |
| End every session for a user | `POST /admin/realms/{realm}/users/{id}/logout` |
| End one session | `DELETE /admin/realms/{realm}/sessions/{sessionId}` |

"Who is signed in" is the union across the three clients — `account-app`,
`orgadmin-client`, `aws-framework-admin` — which also gives us **which
application** each person is in, for free. Each session carries `start`,
`lastAccess` and `ipAddress`.

Joined to `organization_users` on `keycloak_user_id` to get a name, an email, a
user type and an organisation. A session with no matching row is still shown —
"unknown user" on this screen is itself worth seeing.

### 1.2 The honest limit of "make them sign in again"

**Revoking a session does not immediately invalidate an access token.** Measured
on this deployment:

```
access token   300s   (5 minutes)
refresh/session 1800s (30 minutes)
```

Ending a Keycloak session stops the refresh, so the person is thrown out **within
five minutes** — but not instantly. Anyone who describes this button as "sign
them out now" is overselling it, and if the reason for pressing it is a
compromised account, five minutes matters.

The token happens to carry a `sid` claim (the session id). That gives us an
option:

> **Optional hardening.** Keep a small set of revoked `sid`s in Postgres (or
> Redis), and have `authenticateToken` reject a token whose `sid` is in it.
> Entries expire after the access-token lifetime, so the set stays tiny. This
> turns "within five minutes" into "immediately", at the cost of one indexed
> lookup per authenticated request.

I would **not** build this in Phase 1. It is worth doing only if the answer to
"why are you forcing a re-login?" is ever "because this account is compromised",
rather than "because their permissions changed". Which of those it is, is a
question for you.

### 1.3 What the screen offers

- A list of live sessions: who, which application, which organisation, when they
  signed in, last seen, IP.
- Filter by organisation, user type, application.
- **Sign out** per session, and **sign out everywhere** per person.
- A confirmation naming the consequence and the delay: *"They will be signed out
  within 5 minutes and will have to sign in again."*

Every use of this button is itself an audited action (§2), which matters: the
ability to sign somebody out is a power worth recording.

### 1.4 What it deliberately is not

Not "active users" analytics. A Keycloak session says somebody signed in and has
not signed out or timed out — not that they are at the keyboard. Presenting it
as presence would invite it to be read as a productivity measure, which it
cannot support.

---

## Part 2 — The audit trail

### 2.1 One table

```
audit_events
  id                uuid pk
  occurred_at       timestamptz    not null            -- indexed, the usual sort
  -- who
  actor_kc_user_id  varchar(64)                        -- Keycloak sub; the only cross-cutting identity
  actor_user_type   varchar(20)    not null            -- super-admin | org-admin | account-user | system | anonymous
  actor_display     varchar(255)                       -- denormalised name at time of writing
  actor_email       varchar(255)                       -- denormalised
  -- where
  organisation_id   uuid                               -- null for platform-level actions
  -- what
  category          varchar(40)    not null            -- security | events | memberships | …  (§2.3)
  action            varchar(80)    not null            -- entry.added-to-basket, user.role-assigned, …
  outcome           varchar(20)    not null            -- success | failure | denied
  entity_type       varchar(60)                        -- event-activity, membership, setting…
  entity_id         varchar(64)
  entity_label      varchar(255)                       -- "Grade 1 — 80cm", so a reader need not resolve ids
  -- detail
  changes           jsonb                              -- { field: { from, to } }, or the created/deleted row
  context           jsonb                              -- ip, user agent, session id, request id, amount…
  search_text       text                               -- generated; see §2.7
```

**`actor_kc_user_id` is not a foreign key.** It cannot be: the actor may be a
super admin, an org admin or an account user, and those are different tables
today. More importantly, **an audit row must outlive the user it describes** —
"who deleted this account?" is exactly the question you cannot answer if
deleting the account cascades the evidence away. The name and email are
denormalised at write time for the same reason: a rename must not rewrite
history.

`actor_user_type` is stored rather than derived, so the "filter by user type"
requirement is one indexed column rather than a join into three tables.

### 2.2 Where records are written

Three mechanisms, deliberately, because one does not fit everything:

| Mechanism | Covers | Why |
|---|---|---|
| **Explicit `audit.record(…)` in services** | Everything with before/after values | Only the service knows the old row. Middleware sees `PUT /events/123` and a body; it cannot know what changed |
| **A `withAudit` wrapper for CRUD services** | The repetitive create/update/delete cases | Reads the row before, calls through, diffs after. Removes most of the boilerplate the explicit approach would otherwise create |
| **Auth middleware hook** | login, denied access | These have no service call to hang off; they happen in `authenticateToken` and in Keycloak |
| **`POST /api/audit/session/logout`** | logout | A sign-out is a redirect to Keycloak, so no request reaches this process as the session ends. The front ends report it on the way out, via `reportSignOut` in `packages/components` |

**Not database triggers.** They see the row change but not the person, the
intent, or the request; recovering the actor inside a trigger means smuggling it
through a session variable, and the resulting log says "row changed" where the
requirement is "Aoife changed the entry fee from €25 to €30".

Login and failed-login are the awkward ones: **Keycloak owns them**, and it has
its own event log. Two options, and I recommend the second:

1. Poll Keycloak's admin events API and copy them in. Simple, but delayed and
   duplicative.
2. Have the applications report the outcome of a sign-in to `/api/audit/session`
   as they establish it, and record `LOGIN_ERROR` by enabling Keycloak's event
   listener with a webhook. Immediate, and keeps one store.

Either way this is the one category we do not fully control, and the design
should say so rather than imply completeness.

**As built, option 2 is only half done.** `POST /api/audit/session` exists and
accepts a reported outcome, but no front end calls it, so `auth.login-failed`
is never recorded and the Keycloak event listener was never wired up. Sign-ins
are caught server-side instead, by `noteAuthenticatedRequest` on the first
request a session makes; sign-outs are reported by the applications through
`POST /api/audit/session/logout`. Failed sign-ins remain unrecorded — see
`docs/AUDIT_SESSION_EVENTS_FIX.md`.

**Which organisation a session event is filed under.** A token does not say
which club a session is "for", and for somebody who administers three it is not
for any one of them. `recordSessionEvent` writes **one row per organisation the
person belongs to**, so the event appears in each of their trails; somebody who
belongs to none gets a single unattributed row. Filing it under nothing when
there was more than one candidate — the original behaviour — made the event
invisible to precisely the people most likely to look for it, because the
org-admin viewer scopes hard on `organisation_id`.

### 2.3 Categories and actions

`category` is the coarse filter on the screen; `action` is the precise thing.

| Category | Example actions |
|---|---|
| `security` | `auth.login`, `auth.logout`, `auth.login-failed`, `auth.password-changed`, `auth.email-change-requested`, `auth.email-changed`, `auth.session-revoked`, `role.created`, `role.assigned`, `role.removed`, `user.org-admin-created`, `user.account-created`, `user.deactivated`, `access.denied` |
| `events` | `event.created/updated/deleted`, `activity.created/updated/deleted`, `entry.form-opened`, `entry.form-submitted`, `entry.added-to-basket`, `entry.removed-from-basket` |
| `memberships` | `membership-type.created/updated/deleted`, `membership.applied`, `membership.approved`, `membership.renewed` |
| `registrations` | `registration-type.*`, `registration.submitted` |
| `bookings` | `calendar.*`, `booking.created`, `booking.cancelled` |
| `merchandise` | `merchandise.*`, `order.placed` |
| `forms` | `form.created/updated/deleted`, `field.*` |
| `payments` | `payment.method-selected`, `payment.method-changed`, `checkout.started`, `payment.succeeded/failed`, `refund.issued`, `lodgement.viewed` |
| `settings` | `settings.updated` (branding, payment settings, email templates, organisation details) |
| `data` | `report.viewed`, `export.downloaded` |
| `platform` | `organisation.created/updated`, `organisation-type.*`, `capability.granted/revoked`, `post.*` |

The list is deliberately open. Phase 1 defines the vocabulary and a registry so
that **coverage is measurable** — a test that asserts every mutating service
method has an audit action, so gaps are visible rather than discovered a year
later when somebody asks who changed a fee.

### 2.4 Before and after

Your requirement — old values on edit, values on create, values on delete — is
the part that shapes everything else.

```jsonc
// update
"changes": {
  "fee":        { "from": 2500, "to": 3000 },
  "entriesLimit": { "from": null, "to": 40 }
}
// create
"changes": { "created": { "name": "Grade 1 — 80cm", "fee": 2500, … } }
// delete
"changes": { "deleted": { "name": "Grade 1 — 80cm", "fee": 2500, … } }
```

A field-level diff rather than two whole rows, because the screen's job is to
show *what changed*, and a reader given two 30-field objects has to diff them by
eye. The whole row is still there for create and delete, where it is the point.

The diff is computed by one shared helper so that every module produces the same
shape, with a **redaction list** applied before writing (§2.5).

### 2.5 What must never be written down

This is the part I would most want your agreement on, because an audit log is a
copy of your data with none of the access control that protects the original.

**Never:** passwords, password hashes, tokens, card numbers, Stripe secrets,
bank details.

**Deliberately decided, not defaulted:**

- **Form submissions.** Your requirement says entries should log "the values in
  the form that they used". The seeded entry form asks for *date of birth*,
  *emergency contact* and **medical notes**. Copying those into an audit table
  creates a second store of special-category data, read by super admins who may
  have no clinical reason to see it, retained for as long as the audit log is.
  Options: (a) log the answers in full; (b) log which fields were answered but
  not their values; (c) log in full but redact fields flagged sensitive in the
  form builder. **I recommend (c)**, which needs a "sensitive" flag on
  application fields — a small addition with a clear payoff.
- **Email addresses** appear throughout and are personal data. They are needed
  to make the log usable, so they stay, but retention (§2.8) then matters.

### 2.6 An audit write must never break the thing it is auditing

The existing service rethrows. If the audit table is full, or a JSONB value is
malformed, the member's entry fails. That is backwards: the entry is the
business, the log is the record of it.

Proposed: `audit.record()` never throws. Failures are counted in a Prometheus
metric and logged at `error`. If you would rather some categories be
*blocking* — a payment refund that cannot be recorded arguably should not
proceed — that is a defensible position and a per-category flag can express it.
**Question for you: are there actions that must fail if they cannot be logged?**

Writes go through a small in-process queue and are flushed in batches, so a busy
endpoint pays one insert per batch rather than one per request.

### 2.7 Making it searchable

The requested filters map to indexed columns: `organisation_id`,
`actor_kc_user_id`, `actor_user_type`, `category`, `action`, `occurred_at`.

Substring search is the expensive one. Searching inside `changes` JSONB with
`LIKE` will table-scan. Proposal: a generated `search_text` column concatenating
the actor name, email, entity label, action and the *values* from `changes`,
with a **trigram index** (`pg_trgm`) for `ILIKE '%…%'`. Costs storage; buys
"find the row mentioning `KHP-0241`" without scanning.

### 2.8 Volume, retention and growth

The requirement includes account-user reads — opening an entry form, viewing a
report. Those are the highest-volume events by an order of magnitude.

A rough sizing, stated as an assumption to be corrected: 200 clubs × 400 members,
each member doing ~20 auditable things a year, plus admin activity ≈ **2M rows a
year**, ~1KB each ≈ **2GB/year** before indexes.

That is manageable, but only with a decision made up front:

- **Partition `audit_events` by month.** Dropping a partition is instant;
  deleting 2M rows is not.
- **Retention by category.** Security events: keep for years. `data`/read events
  (`report.viewed`, `entry.form-opened`): keep for months. Making this
  per-category means the interesting rows are not evicted by the noisy ones.
- **Question for you: what retention does the business need?** If there is a
  regulatory answer — insurance, safeguarding, payment rules — it should drive
  this rather than be retrofitted.

### 2.9 Who may read it

The screen is Platform Admin, i.e. `super-admin`, as you asked.

Worth deciding now, though: **should an org admin see their own club's trail?**
The data model supports it — `organisation_id` is on every row and the
org-admin routes are already organisation-scoped. It is the single most likely
follow-up request ("who cancelled that booking?"), and designing for it now
costs nothing, whereas retrofitting tenancy onto an audit reader is unpleasant.
I recommend building the query layer organisation-aware from the start, and
shipping only the Platform Admin screen in Phase 1.

---

## 3. Recording an action

Two helpers, and the difference between them is what they can see.

### 3.1 `audited()` — middleware, `src/middleware/audit.middleware.ts`

The default. It sits in the middleware chain beside the guards that are already
there, and the handler is untouched:

```ts
router.put('/events/:id',
  authenticateToken(),
  byResource('event', 'id'),
  audited({ action: 'event.updated', resource: 'event', label: 'name' }),
  async (req, res) => { /* unchanged */ });
```

There are 101 mutating endpoints wired this way. Editing 101 handler bodies to
wrap a service call would have been 101 chances to change the behaviour of a
working endpoint, and the shape is uniform enough not to need it: for these
routes the response body *is* the new row.

What it does per request:

| step | detail |
|---|---|
| before | for an update or delete, `SELECT *` the row by the id the guard just authorised |
| capture | wrap `res.json` to see the row the handler returns |
| record | on `finish`, so the outcome reflects what the client actually got |

Three traps are worth naming, because all three were silent:

- **Derived data.** The before-row is `SELECT *`, so its keys are exactly this
  table's columns; the response usually carries more — joined children, computed
  totals. Diffed in, an event edit reported its entire list of activities going
  from nothing to a wall of JSON on **every** save, having not been touched. The
  update diff is therefore narrowed to the columns the row actually owns.
- **Plumbing recorded as content.** A create records the whole row, which meant
  a new form field led with its uuid, its generated machine name and both
  timestamps before reaching its label. Surrogate keys, timestamps, soft-delete
  flags and the organisation are dropped from every kind of record; a route may
  name further internals via `exclude`. Fields nobody filled in are dropped from
  **snapshots** — a create lists what it was created *with* — but never from a
  diff, where clearing a field is a change, and never from a rejected
  submission, where a blank is very often why it was rejected.
- **The two spellings.** `before` comes from `SELECT *`, so its keys are column
  names (`entry_fee`); `after` is the response body, already mapped to
  `entryFee`. Diffed as-is, *every* field reads as changed — the trail becomes
  useless on exactly the updates it exists to record. Both sides are normalised
  to camelCase first.
- **The envelope.** Many handlers answer `{ success: true, data: {...} }` or
  `{ event: {...} }`. Recording the envelope would fill the log with
  `{success: true}`, so single-key and `data` wrappers are unwrapped.

A 4xx is recorded as a `failure` (403 as `denied`) with what was attempted. A
refused change is part of the trail, and often the interesting part.

### 3.2 `withAudit()` — wrapper, `src/services/audit/with-audit.ts`

For the cases where the values are not a table row, or where the record has to
straddle one specific call rather than a whole request. Same four kinds
(`create` / `update` / `delete` / `action`), same redaction, but the caller
supplies the before-loader and the values.

`recordAudit(req, {...})` is the fire-and-forget form, for things that are not
mutations at all — a report opened, an export taken.

### 3.3 Names a reader knows

The trail stores stable identifiers — `event.updated`, `openDateEntries` —
because they must survive renames, be filtered on, and mean one thing in six
languages. Neither belongs on a screen.

`packages/components/src/utils/auditLabels.ts` is the single English source:
`AUDIT_ACTION_LABELS` covers all 109 registered actions, `AUDIT_FIELD_LABELS`
the field names the generic humaniser gets wrong, and `humaniseFieldName`
handles everything else (`openDateEntries` → "Open date entries").

- **Platform Admin** uses them directly; it is English only.
- **Org-admin** passes each as `defaultValue` to `t()`, so `audit.actions.*` in
  the six locales wins where it exists and readable English shows where it does
  not. Field labels are resolved first against the namespaces the edit forms
  already translate — `events.basicInfo`, `events.dates`, `forms.fields` — so the
  audit log calls a field what the form that set it calls it, rather than keeping
  a second copy free to drift.

The stored identifier stays the filter value throughout; only the display
changes.

The namespace probes read i18next resources **directly** rather than through
`t()`. Two reasons, both learned the hard way: asked for a key that holds a
nested object, `t()` returns its own diagnostic (`returned an object instead of
string`) as an ordinary string, which sailed through a truthiness check and onto
the screen as a field name — a form field called `validation` collided with the
`events.basicInfo.validation` message group. And every probe miss is *expected*,
since the English map is the fallback, so `t()` filled the console with
missing-key warnings about a path working exactly as designed.

Values are formatted by `formatAuditValue`, shared by both viewers: timestamps
in the reader's own timezone, date-only values without an invented midnight,
booleans as words, absent as a dash. Platform Admin layers money-in-minor-units
on top.

### 3.4 Coverage

| area | recorded |
|---|---|
| Security | login, logout, failed login, access denied, password change/reset, email change, session revoked |
| Roles & users | role created/updated/deleted/assigned/removed; org-admin and account users created/updated/deleted; invitations |
| Platform | organisations, organisation types, capabilities, posts, org-type logo |
| Settings | organisation, branding, payment, email templates, registration — each with before → after |
| Events | events, activities, venues, event types; entry form submitted, added to / removed from basket, entry created/cancelled |
| Memberships | membership types, members, applications, approvals, renewals |
| Registrations | registration types, submissions, approvals, batch label and processed changes |
| Bookings | calendars, reservations, bookings created and cancelled |
| Merchandise | merchandise types, options, stock adjustments, orders, order status |
| Forms | forms, fields, submissions |
| Payments | checkout started, payment method selected/changed, succeeded/failed, refunds, offline payments, lodgements |
| Data | every report view and every export, with the filters used |

---

## 4. Sensitive form fields

Your answer to the §2.5 question was option (c): redact by flag.

`application_fields.is_sensitive` is a boolean the club sets on its own field,
in the org-admin field editor. An answer to a marked field is recorded as
**present but hidden** — the trail still shows that the question was answered
and when, which is what an audit needs, and the answer itself never reaches the
log.

This exists because the fixed redaction list in `audit.redaction.ts` can only
catch what we can name in advance — password, token, card number. It cannot know
that a particular club called a field *"Any medical conditions we should know
about?"*. Only the club knows that, so the club says.

`sensitiveFieldsFor(organisationId)` reads the marks, cached for a minute so an
audit write never adds a query to every submission. The cache is cleared on
field create and update, because the dangerous direction to be stale in is a
field just marked sensitive still being logged.

Both the field **name** and its **label** are matched, since a submission's
answers may be keyed by either — matching only one would be a redaction that
silently did nothing.

Defaults to false. A club that has not thought about this gets today's
behaviour, and opting a field in is a deliberate act.

---

## 5. Partitions and retention

`audit_events` is partitioned by month. `src/services/audit/audit-partitions.ts`
keeps the calendar ahead of itself:

- `ensurePartitions()` creates this month and the next three. Idempotent, never
  throws, and called on boot then daily. Daily rather than monthly because a
  monthly timer has to fire on the right day, and a process restarted on the 1st
  would skip it.
- A missing partition is not data loss — rows land in `audit_events_default` —
  but it quietly undoes the point of partitioning, because the default partition
  cannot be detached and dropped the way a month can.
- `dropPartitionsBefore(date)` detaches then drops every month wholly before a
  cutoff. **Nothing calls it.** You said there is no enforced policy yet and
  that dropping old months should be a scheduled task added later, so it takes
  an explicit date rather than reading a configured number of months — deleting
  an audit trail on a config-file default is the accident worth designing out.
  Detach and drop are separate statements so a month can be exported in between.

---

## 6. What was built

All four phases, and the org-admin viewer.

| phase | state |
|---|---|
| 1 — foundation: table, service, redaction, auth hooks, sessions | done |
| 2 — the reader: query layer, Platform Admin list and detail | done |
| 3 — coverage across every module, plus the sensitive-field flag | done |
| 4 — partition rotation, retention helper, org-admin viewer | done |

Two things from the proposal are deliberately **not** built:

- **Immediate revocation via `sid` (§1.2).** You chose the "because their
  permissions changed" approach, so a revoked session ends within five minutes
  rather than instantly. The Sessions dialog says "within 5 minutes" rather than
  "now", because that is the kind of overstatement that matters exactly when
  somebody is relying on it.
- **An enforced retention period (§5).** The helper exists; no schedule calls it.

The old `admin_audit_log` and `organization_audit_log` tables and the
`AuditLogService` that wrote to them are gone, with the single existing row
migrated across — as you asked. Its eight call sites in the super-admin router
now use `recordAudit`.

---

## 7. Reading it

| who | where | scope |
|---|---|---|
| Super admin | Platform Admin → Oversight → Audit log | every organisation, filterable to one |
| Org admin | Org Admin → Audit Log | **their own organisation only** |

The org-admin scope is fixed by the server: `/api/orgadmin/organisation/audit`
resolves the organisation from the session and ignores any organisation in the
query string. The screen does not pass a scope, and could not widen one if it
tried.

See [AUDIT_TRAIL_AND_SESSIONS_WIREFRAMES.md](AUDIT_TRAIL_AND_SESSIONS_WIREFRAMES.md).
