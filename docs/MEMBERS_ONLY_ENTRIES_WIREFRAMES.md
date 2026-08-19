# Members-only entries — wireframes

Companion to [MEMBERS_ONLY_ENTRIES.md](MEMBERS_ONLY_ENTRIES.md).

---

## 1. Org admin — the activity form

Between *Application Form* and the applicant limits, because it is a question about **who** enters,
which is settled before **how many**.

```
┌─ Activity · Under-12 Show Jumping ─────────────────────────────────┐
│                                                                    │
│  Application Form *                                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Junior entry form                                        ▾   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Who can enter                                                     │
│   ◉  Entries open to all                                           │
│      Anyone with an account can enter.                             │
│   ○  Entries open to our members only                              │
│      Only people holding an active membership of this club.        │
│                                                                    │
│  ☐  Limit the number of applicants                                 │
└────────────────────────────────────────────────────────────────────┘
```

**Absent entirely** when the club does not use memberships, or uses them but has no members yet — a
setting whose only possible effect is to lock everyone out should not be offered. The activity keeps
*open to all*.

When "members only" is chosen, a note appears so the consequence is stated before it is saved:

```
│   ◉  Entries open to our members only                              │
│      Only people holding an active membership of this club.        │
│      ⓘ Members without an active membership will see this          │
│        activity marked "Members only" and cannot enter.            │
```

### With the federation capability

A third option appears, and only for an organisation granted **Organisation Level Members**:

```
│  Who can enter                                                     │
│   ◉  Entries open to all                                           │
│   ○  Entries open to our members only                              │
│   ○  Entries open to members (all orgs/branches)                   │
│      Members of any organisation of the same type as yours.        │
│      ⓘ This event will be listed for account users of every        │
│        other organisation of the same type, marked as run by       │
│        your organisation.                                          │
```

The second and third options are gated independently. A club with the federation capability but no
members of its own still sees the third — it has something worth choosing — while the second stays
hidden.

---

## 2. Account user — the event listing

The activity is **shown, not hidden** — a member who has let their membership lapse should see what
they are missing and why, not an event that appears not to exist.

```
┌─ Kildare Hunt Pony Club · Spring Show ─────────────────────────────┐
│  ┌────┐                                                            │
│  │AUG │   Spring Show                    Entries close 22nd Sept   │
│  │ 20 │   Saturday 20 August 2026                                  │
│  └────┘                                                            │
│                                                                    │
│   Open Show Jumping           €25.00      12 of 50    [ Enter ]     │
│                                                                    │
│   Under-12 Show Jumping       €20.00                               │
│   🔒 Members only                                                  │
│                                                                    │
│   Members' Cup                €15.00      8 of 20     [ Enter ]     │
└────────────────────────────────────────────────────────────────────┘
        ↑ no active membership: no button, and the reason is named
        ↑ "Members' Cup" is also members-only — this user holds a
          membership, so it behaves exactly like any other activity
```

---

## 3. Account user — the entry form

### One active membership

Stated, not asked. There is no choice to make, and a select with one option is a question with one
answer.

```
┌────────────────────────────────────────────────────────────────────┐
│  ‹ Back                                                            │
│                                                                    │
│  Under-12 Show Jumping                                             │
│  Spring Show · Saturday 20 August 2026                             │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  This entry is for Saoirse Byrne                             │  │
│  │  Junior Member · KHP-0241                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Horse name *                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  └──────────────────────────────────────────────────────────────┘  │
```

### More than one

```
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Who is this entry for? *                                    │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  Saoirse Byrne — Junior Member · KHP-0241          ▾   │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  Fionn Byrne — Junior Member · KHP-0242                      │  │
│  │  Aoife Byrne — Full Member · KHP-0088                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Horse name *                                                      │
```

Nothing is preselected when there are several. A parent who is entering Fionn and gets Saoirse by
default has been given a wrong answer that looks like their own; an empty required field asks the
question instead. Submitting without choosing fails validation like any other required field.

A member already entered in this activity is **listed but disabled**, so the reason is visible
rather than the name simply missing:

```
│  │  Saoirse Byrne — already entered                       ⊘   │  │
```

### No active membership

Not reachable from the listing, but reachable by URL — so the form refuses rather than rendering.

```
┌────────────────────────────────────────────────────────────────────┐
│  ‹ Back                                                            │
│                                                                    │
│  ⓘ  This activity is open to members of Kildare Hunt Pony Club     │
│     only, and you do not hold an active membership.                │
│                                                                    │
│     [ View memberships ]                                           │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3a. Account user — another branch's event, on the home page

Its own section, below the club's own events, badged on every card. A member glancing at the home
page must never mistake one of these for something their own club is running — the date, the entry
rules and the money are all somebody else's.

```
┌─ Kildare Hunt Pony Club ───────────────────────────────────────────┐
│  Events at other organisations                                     │
│  Run by other organisations of the same type, open to members.     │
│                                                                    │
│  ┌──────────────────────────┐  ┌──────────────────────────┐        │
│  │ [External event]         │  │ [External event]         │        │
│  │ Ward Union Open Show     │  │ Meath Hunt Autumn Rally  │        │
│  │ Ward Union Pony Club     │  │ Meath Hunt Pony Club     │        │
│  │ 5 September 2026         │  │ 3 October 2026           │        │
│  │                          │  │                          │        │
│  │ Join Ward Union Pony     │  │ Go to Meath Hunt Pony    │        │
│  │ Club to enter         ›  │  │ Club                  ›  │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
└────────────────────────────────────────────────────────────────────┘
      ↑ not yet joined: invited to join     ↑ already an account there:
                                              simply taken to the club
```

The link goes to `/{urlCode}` — the organising club's own account app, where their catalogue decides
what this person may enter, against the memberships they hold anywhere in the federation.

---

## 4. Org admin — the entries list

What the member link buys: which child, not two identical rows.

```
┌─ Entries · Under-12 Show Jumping ──────────────────────────────────┐
│  Name              Membership no.   Entered by      Paid           │
│  ────────────────────────────────────────────────────────────────  │
│  Saoirse Byrne     KHP-0241         Aoife Byrne     ✓              │
│  Fionn Byrne       KHP-0242         Aoife Byrne     ✓              │
│  Niamh Walsh       KHP-0193         Niamh Walsh     ✓              │
└────────────────────────────────────────────────────────────────────┘
```

"Entered by" only earns its place when it differs from the name; for the common case the two are the
same person and the column repeats itself.
