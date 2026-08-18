# Wireframes — changing a password and an email address in the app

Screens for [ACCOUNT_SELF_SERVICE_CREDENTIALS.md](ACCOUNT_SELF_SERVICE_CREDENTIALS.md).

## P3 — Profile & Settings, sign-in section

The two buttons stay where they were. What changes is that neither leaves the
app, so the external-link mark and the "you are about to be taken to another
site" interstitial both go.

![P3 — Profile & Settings, sign-in section](images/account-credentials/P3-profile-settings-sign-in-section.svg)

## P4 — Change password

One dialog, three fields. The current password is first because it is what
authorises the change, not an afterthought.

![P4 — Change password](images/account-credentials/P4-change-password.svg)

The warning line is where Keycloak's own complaint appears — *"Invalid password:
must contain at least one number"* and the rest come through verbatim, so a
realm whose policy is tightened tomorrow needs no change here.

## P5 — Change email address

![P5 — Change email address](images/account-credentials/P5-change-email-address.svg)

### P5a — after sending

Deliberately says nothing about whether the address was already in use. The
member finds that out by mail, at the address in question.

![P5a — after sending](images/account-credentials/p5a-after-sending.svg)

## P6 — The confirmation page

Its own page, not a dialog: it is opened cold from a mail client, often in a
different browser, with no session and no memory of what was being done.

![P6 — The confirmation page](images/account-credentials/P6-the-confirmation-page.svg)

And when the link has expired, been used, or was never valid — one message for
all three, since distinguishing them tells an attacker which tokens exist:

![P6 — The confirmation page, link not valid](images/account-credentials/P6-the-confirmation-page-2.svg)

## The three emails

| To | When | Why it exists |
|---|---|---|
| **New address** | a change is requested | Carries the link; proves the address reaches the member |
| **Old address** | a change is requested | The alarm. Somebody who has taken over a session finds out before the address moves, while the old address still works |
| **Current address** | a password is changed | The same alarm for the other credential |

The mail to the old address names the new one and says plainly that it has not
happened yet. A warning that cannot be acted on is decoration.
