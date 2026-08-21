# Wireframes — who the entry is for

The field sits above the club's own form, in its own card, on every event entry.
See [ENTRANT_NAME.md](ENTRANT_NAME.md) for the rules behind it.

## 1. Entries open to all — a club that runs memberships

Completes against the club's roster, and accepts a name that matches nobody.

```
┌──────────────────────────────────────────────────────────────┐
│  Spring Show Jumping League                                  │
│  Grade 3 — 1.00m                                             │
│  €35.00                                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Who is this entry for? *                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ bre                                              ▾     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Saoirse Brennan                                       │  │
│  │  Junior Member · 100002                                │  │
│  └────────────────────────────────────────────────────────┘  │
│  Start typing to find a member, or type any name.            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Please fill out the details below                           │
│  … the club's own form …                                     │
└──────────────────────────────────────────────────────────────┘
```

A name that matches nobody is kept, because here it is the answer:

```
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Fionn Doyle                                      ▾     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  No members found.                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│  Start typing to find a member, or type any name.            │
```

## 2. Entries open to our members only

Same roster, but nothing may be submitted that did not come from it.

```
┌──────────────────────────────────────────────────────────────┐
│  Who is this entry for? *                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ bre                                              ▾     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Saoirse Brennan                                       │  │
│  │  Junior Member · 100002                                │  │
│  │  ────────────────────────────────────────────────────  │  │
│  │  Órla Kavanagh                    [ Already entered ]  │  │  ← listed, not selectable
│  │  Junior Member · 100004                                │  │
│  └────────────────────────────────────────────────────────┘  │
│  Start typing to find a member. Only active members can      │
│  be entered.                                                 │
└──────────────────────────────────────────────────────────────┘
```

Leaving the field with something typed but not chosen clears it and says why,
rather than letting the member discover it after the whole form is filled in:

```
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                  ▾     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ⚠ Choose an active member from the list.                    │
```

An already-entered member is shown and disabled rather than dropped — a name
simply missing from the list reads as a bug, while a disabled row with a reason
answers the question the absence would raise.

## 3. Entries open to members (all orgs/branches)

The roster widens to every club in the organisation type, and each match that is
**not** the host club's carries its own club beside the name.

```
┌──────────────────────────────────────────────────────────────┐
│  Inter-Branch Championship                                   │
│  Inter-Branch Team Class                          €30.00     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Who is this entry for? *                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ wals                                             ▾     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Niamh Walsh        ( Laois Hunt Pony Club )           │  │  ← another branch
│  │  Senior Member · 200000                                │  │
│  │  ────────────────────────────────────────────────────  │  │
│  │  Cillian Walsh                                         │  │  ← this club: no chip
│  │  Junior Member · 100007                                │  │
│  └────────────────────────────────────────────────────────┘  │
│  Start typing to find a member. Only active members can      │
│  be entered.                                                 │
└──────────────────────────────────────────────────────────────┘
```

## 4. A club with no membership roster

No memberships enabled, or none active yet: a plain text box, with no dropdown
and no spinner.

```
┌──────────────────────────────────────────────────────────────┐
│  Who is this entry for? *                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Fionn Doyle                                            │  │
│  └────────────────────────────────────────────────────────┘  │
│  The name of the person this entry is for.                   │
└──────────────────────────────────────────────────────────────┘
```

## 5. One membership, nothing to ask

Where the account holds exactly one eligible membership on a members-only
activity, the field opens filled in — there is no choice to make.

```
┌──────────────────────────────────────────────────────────────┐
│  Who is this entry for? *                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Saoirse Byrne                                    ▾     │  │
│  └────────────────────────────────────────────────────────┘  │
│  Start typing to find a member. Only active members can      │
│  be entered.                                                 │
└──────────────────────────────────────────────────────────────┘
```

Where the account holds several, nothing is preselected: a parent entering Fionn
who gets Saoirse by default has been handed a wrong answer that looks like their
own. The same reasoning is why an open entry does **not** default to the account
holder's own name — that would make the commonest mistake the commonest default.

## 6. Not a member at all

Unchanged by this work, and shown here because it is the boundary. Widening who
may be *named* did not widen who may *enter*: a caller with no eligible
membership still never reaches the form for a members-only activity.

```
┌──────────────────────────────────────────────────────────────┐
│  ⓘ This activity is open to members of Kildare Hunt Pony     │
│    Club only, and you do not hold an active membership.      │
│                                        [ View memberships ]  │
└──────────────────────────────────────────────────────────────┘
```
