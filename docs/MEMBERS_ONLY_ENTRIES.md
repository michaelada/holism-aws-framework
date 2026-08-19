# Members-only event entries

**Request:** per activity, when a club uses Memberships and actually has members, let the org admin
choose who may enter:

- **Entries Open To All** — the default, always selected first
- **Entries Open to Our Members Only** — then:
  - an account user with no active membership cannot enter, and the listing shows *members only*
  - with one active membership, the entry form says the entry is for that member
  - with more than one, the form asks which member is being entered

---

## 1. What already exists, and is reused rather than rebuilt

- **`UnavailableReason`** (`account-catalogue.service`) already answers *"why can't I enter this?"*
  per activity, and the account shell already renders it. Members-only is one more reason, not a new
  mechanism.
- **`listMemberships(organisationId, organisationUserId)`** already returns every membership a login
  holds, with `status`. "Active" means `status === 'active'`, the same test the account dashboard
  uses.
- **A login holding several memberships is already normal** — a parent holds their children's. The
  dashboard was fixed once for exactly this. So "more than one active membership" is the existing
  shape of the data, not a new case.
- **`cart_items.context_ref`** is jsonb, so the chosen member rides to checkout without a schema
  change.

## 2. Decisions

**The entry carries the member's name, not the account holder's.** Fulfilment currently copies
`first_name`/`last_name`/`email` off `organization_users`; for a members-only entry it copies the
`members` row instead and stores `member_id`. Without this a parent's two entries are two identical
rows and the org admin cannot tell which child is which — which would make the selector pointless.

**"Already entered" becomes per member, not per account.** A parent must be able to enter both
children in one class. This changes today's rule, which blocks any second entry from the same login,
and it changes it **only for members-only activities** — an open activity keeps the account-level
rule, because there is no member to key on.

## 3. Where the option appears — and when it does not

The selector is on `EventActivityForm`, and is shown only when **both** hold:

1. the organisation has the `memberships` capability, and
2. it has at least one member.

A club with the capability switched on but nobody in the database would otherwise be offered a
setting that can only lock everyone out. Absent, the field is not rendered at all and the activity
keeps `all`.

Existing activities are unaffected: the column defaults to `'all'`, which is the current behaviour.

## 4. The gate, stated once

`entry_eligibility = 'members'` means: **the signed-in account user must hold at least one active
membership in this organisation.**

Enforced in three places, deliberately:

| Where | What it does |
|---|---|
| `account-catalogue.service` | `unavailableReason: 'members-only'` so the listing shows it and no button is offered |
| `EntryFormPage` | refuses to render the form, and picks or asks for the member |
| `cart.service` | refuses the item outright, and refuses a member the caller does not own |

The third is the one that matters. The first two are courtesy; a screen that hides a button has not
stopped anybody who can type a URL, and this decides who gets into a club's event.

## 5. Requirements

| # | Requirement |
|---|---|
| R1 | Per-activity setting, default *Entries Open To All* |
| R2 | Setting offered only when the club uses memberships **and** has members |
| R3 | Listing shows *Members only* to an account user with no active membership; no entry button |
| R4 | One active membership → the form states which member the entry is for |
| R5 | More than one → the form asks which member |
| R6 | The entry records the member: name, and a link to the membership |
| R7 | One entry per member for members-only activities; a parent may enter each child once |
| R8 | The server refuses a members-only entry from a non-member, and refuses a member the caller does not hold |
| R9 | Everything in all six locales |
| R10 | A third option, gated on the `organisation-level-members` capability — see §7 |
| R11 | Members of any organisation of the same type may enter such an activity |
| R12 | The event is surfaced to account users of every other organisation of that type, badged, linking to the organiser |

## 6. Design

### Database

```
event_activities.entry_eligibility  varchar(20) NOT NULL DEFAULT 'all'
                                    CHECK IN ('all','members','org-type-members')   -- see §7
event_entries.member_id             uuid NULL REFERENCES members(id) ON DELETE SET NULL
```

`member_id` is nullable and stays null for every open-entry activity, which is most of them.
`ON DELETE SET NULL` because deleting a membership record must not delete the entry — the person
turned up and rode.

### Backend

- `event.service` / activity mapping — read and write `entryEligibility`.
- `account-catalogue.service` — `'members-only'` reason, plus `eligibleMembers` on the activity
  (populated only for members-only activities, and only ever the caller's own).
- `cart.service.addItem` — validate; carry `memberId` in `context_ref`.
- `fulfilment.service` — name and `member_id` from the `members` row.
- `GET /api/orgadmin/members/exists` — the cheap "has any member" the activity form needs.

### Front end

- `EventActivityForm` — a two-option radio group, gated as in §3.
- `EntryFormPage` — a banner for one member, a select for several, neither for an open activity.
- `EntryStatus` — renders the new reason.

Wireframes: [MEMBERS_ONLY_ENTRIES_WIREFRAMES.md](MEMBERS_ONLY_ENTRIES_WIREFRAMES.md).

---

## 7. The third option — entries open across the organisation type

**Request:** a third choice, *Entries open to Members (All Orgs/Branches)*, offered only to an
organisation holding a new capability **Organisation Level Members**. Choosing it lets members of
any organisation of the same type enter. An event with such an activity must also appear for account
users of every other organisation of that type, marked as run by another club, linking to the
organiser's account app and prompting them to join it.

### The federation is the organisation type

`irish-pony-clubs` contains Kildare, Laois, Meath and Ward Union. That is the boundary: the option
opens a club up to its own federation and no further.

### Two switches, not one

`organisation-level-members` is a **capability**, granted per organisation by a super admin, and it
only decides whether the option is *offered*. `entry_eligibility = 'org-type-members'` decides
whether it is *used*. It is seeded onto no organisation, because it lets one club's event admit
another club's members — a decision to be given, not one to discover you already have.

### Identity is the hard part

`members.user_id` points at `organization_users`, which is **per organisation**: the same person is
a different row in every club they belong to, so their memberships elsewhere cannot be reached from
the row in hand. `activeMembershipsAcrossType` joins out through **`keycloak_user_id`**, the one
identifier that is the same person everywhere. Email was the obvious alternative and is wrong: it
can be changed, can be shared by a family, and is not what anything else here treats as identity.

### The two member sets are kept apart

The wider set is a superset of the narrower, and merging them would be the easy mistake: a
membership of *another* branch would then open an activity a club had restricted to *its own*
people. `listEvents` loads both and hands each activity only the set its own eligibility calls for.
There is a test for exactly this — one event with both kinds of activity, and a member of another
branch, who gets into one and not the other.

### Refusals are worded for their remedy

| Eligibility | Reason | What the member should do |
|---|---|---|
| `members` | `members-only` | renew with this club |
| `org-type-members` | `org-members-only` | join any club in the federation |

### Cross-club discovery

`AccountDashboard.externalEvents` — events run by other clubs of the same type with at least one
publicly visible `org-type-members` activity. Shown in their own section on the home page, badged,
naming the organiser, and linking to that club's account app at `/{urlCode}`.

**Deliberately not folded into `whatsOn`.** Everything in that list can be acted on here and now;
these cannot — the member may first have to join another club. One list would leave every consumer
to re-establish the difference, and the first to forget would offer an "Enter" button that leads
nowhere.

`alreadyJoined` decides the wording. Being asked to join something you already belong to reads as
the software not knowing you.

Shown to **every** account user of the club, not only its members: someone who has not joined is
exactly who the link is for. Whether they may ultimately enter is decided by the organising club's
catalogue, against their memberships.

### Rollback narrows, never widens

`down` returns `org-type-members` activities to `members`, not to `all`. A migration that quietly
threw a club's event open to the public would be far worse than one that closed it too far.
