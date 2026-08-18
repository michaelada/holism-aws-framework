# Wireframes — one administrator, several clubs

Screens for [ORGADMIN_MULTI_ORGANISATION.md](ORGADMIN_MULTI_ORGANISATION.md).

The account app already solved this once (A7 switcher), and this should not
invent a second idiom. Two things genuinely differ: an administrator's switch
changes the organisation's **capabilities**, so the navigation itself changes;
and there is no `:orgCode` in the URL to switch to.

## O1 — The switcher, in the top bar

Where a member's club switcher sits, and for the same reason: it is the widest
piece of context on the screen, so it belongs where the eye starts rather than
buried in a settings page.

![O1 — The switcher, in the top bar](images/orgadmin-multi-org/O1-the-switcher-in-the-top-bar.svg)

**An administrator of one sees no chevron and no menu** — just the club's name,
exactly as now. That falls out of `organisations` having one entry rather than
out of a setting, so there is nothing to configure and nothing to get wrong.

## O2 — What a switch changes

Worth a diagram because it is more than a label. Capabilities belong to the
organisation, so the navigation is not the same on both sides of a switch.

![O2 — What a switch changes](images/orgadmin-multi-org/O2-what-a-switch-changes.svg)

So a switch has to re-resolve capabilities, roles, branding and locale, and it
must **land on the dashboard** rather than trying to keep the current page. Half
the time the current page is a module the other club does not have, and the
alternative is an administrator staring at a capability-denied screen
immediately after choosing a club.

## O3 — Signing in with several

No chooser screen. The last organisation used is restored, and the switcher says
which one — a chooser would be a wall between an administrator and the work
every single time they sign in, to answer a question that is nearly always "the
same one as yesterday".

![O3 — Signing in with several](images/orgadmin-multi-org/O3-signing-in-with-several.svg)

The subtitle is the only new element, and it appears only for an administrator
of more than one organisation. It exists so
that an administrator who has just signed in and is about to change something
knows *which* club they are about to change it in — the failure this feature
introduces is doing the right thing to the wrong organisation.

## O4 — Adding an administrator who already exists

The Users screen needs to say what it is about to do, because it is no longer
always "create an account".

![O4 — Adding an administrator who already exists](images/orgadmin-multi-org/O4-adding-an-administrator-who-already-exists.svg)

The notice is what stops the obvious support call: an administrator who adds a
colleague, sees no invitation email arrive, and assumes it failed. They get "you
now administer X" instead of a temporary password, because they already have one.

**Their name is shown but not editable here.** It belongs to the identity, and
letting one club rename a person who administers three would be the same mistake
as per-club profiles.

## O5 — Removing them from one club

![O5 — Removing them from one club](images/orgadmin-multi-org/O5-removing-them-from-one-club.svg)

Said plainly because the alternative reading is alarming — an administrator
removing a colleague from one club should not have to wonder whether they have
just locked them out of two others. The Keycloak user is deleted only when the
last row goes.
