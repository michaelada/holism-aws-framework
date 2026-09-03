# Scanning tickets at the gate — wireframes

Three surfaces: what a club does before the gate opens, what a steward sees on their phone, and what
the club reads afterwards. Everything else in the feature exists to make the middle one correct.

See [GATE_SCANNING.md](GATE_SCANNING.md).

---

## 1. The club creates a link — Event ticketing page

Above the ticket list, because it is what a club does *before* the gate opens.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ← Back to ticketed events                                                    │
│                                                                               │
│  Autumn Gate Day                              [ Refresh ]  [ Export to Excel ] │
│                                                                               │
│  ┌── Issued ──┐ ┌── Scanned ──┐ ┌── Not scanned ──┐ ┌── Revenue ──┐           │
│  │    218     │ │     0       │ │      218        │ │  € 2,180    │           │
│  └────────────┘ └─────────────┘ └─────────────────┘ └─────────────┘           │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ ⌗  Scanning at the gate                                                │   │
│  │                                                                        │   │
│  │ Create a link for whoever is on the gate. They open it on their own    │   │
│  │ phone, give their name and the PIN, and start scanning. No account     │   │
│  │ needed, and it expires by itself.                                      │   │
│  │                                                                        │   │
│  │   Lasts for [ 12 hours  ▾ ]     [  Create a scanning link  ]           │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌── Filters ────────────────────────────────────────────────────────────┐   │
```

### 1.1 Immediately after creating one — **the PIN is shown once**

```
  ┌───────────────────────────────────────────────────────────────────────┐
  │ ⌗  Scanning at the gate                                                │
  │                                                                        │
  │   Lasts for [ 12 hours  ▾ ]     [  Create a scanning link  ]           │
  │                                                                        │
  │ ┌─ green ──────────────────────────────────────────────────────────┐  │
  │ │ Send this link and PIN to whoever is on the gate                  │  │
  │ │                                                                    │  │
  │ │ [ https://itsplainsailing.com/account/scan/9f2K…  ] [⧉]  ( PIN 004821 ) │
  │ │                                                                    │  │
  │ │ The PIN is shown once. If it is lost, create another link.          │  │
  │ └────────────────────────────────────────────────────────────────────┘  │
  │ ─────────────────────────────────────────────────────────────────────  │
  │ ( Active until 2 Sep 2026, 21:00 )   [ ⃠ Stop this link ]               │
  │   Nobody has started scanning with this link yet.                       │
  └───────────────────────────────────────────────────────────────────────┘
```

The PIN is never shown again — what the server keeps is a scrypt hash. A club that loses it creates
another link, which is a smaller problem than a PIN readable off a screen weeks later.

### 1.2 During the day — who is scanning

```
  │ ( Active until 2 Sep 2026, 21:00 )   [ ⃠ Stop this link ]               │
  │   Ann Doyle    — 137 scans, last seen 14:52                             │
  │   Marek Nowak  —  64 scans, last seen 14:51                             │
  │   Síle Ó Braonáin — 12 scans, last seen 13:04                           │
```

Three stewards, one link. Each named themselves when they unlocked; the names come from
`ticket_scan_devices.steward_name` and are written onto every scan they make.

---

## 2. The steward's phone — `/account/scan/:token`

### 2.1 Unlocking

```
        ┌───────────────────────────────────┐
        │                                   │
        │   Ticket scanning                 │
        │                                   │
        │   Give your name and the PIN the  │
        │   club sent you. Your name is     │
        │   recorded against every ticket   │
        │   you scan.                       │
        │                                   │
        │   ┌─ Your name ────────────────┐  │
        │   │ Ann Doyle                  │  │
        │   └────────────────────────────┘  │
        │   So the club can see who scanned │
        │   each ticket.                    │
        │                                   │
        │   ┌─ PIN ──────────────────────┐  │
        │   │ 0 0 4 8 2 1                │  │
        │   └────────────────────────────┘  │
        │                                   │
        │   [      Start scanning       ]   │
        │                                   │
        └───────────────────────────────────┘
```

A numeric keypad on a phone (`inputMode="numeric"`), six digits, and the button stays disabled until
both fields are filled. An invalid link, an expired one and a revoked one all say the same thing —
telling them apart would make this a way to learn which links are real.

### 2.2 Scanning — admitted

```
        ┌───────────────────────────────────┐  dark ground, so the
        │ Autumn Gate Day        [ Finish ] │  camera is the page
        │ Scanning as Ann Doyle             │
        │                                   │
        │  ┌─────────────────────────────┐  │
        │  │                             │  │
        │  │      ┌───────────┐          │  │
        │  │      │  camera   │          │  │
        │  │      │  ▢ ▢ ▢    │          │  │  qrbox 250×250
        │  │      └───────────┘          │  │
        │  │                             │  │
        │  └─────────────────────────────┘  │
        │                                   │
        │  ┌─ GREEN ───────────────────────┐│
        │  │ ✓  Admitted                   ││
        │  │    Bríd McNamara              ││
        │  │    Family ticket              ││
        │  │    2 of 4 admitted            ││
        │  └───────────────────────────────┘│
        │                                   │
        │  [ Type the code        ] [Check] │
        └───────────────────────────────────┘
```

**The holder's name is the answer to the screenshot problem.** A static QR can be forwarded; showing
who the ticket belongs to lets the steward match it to the person in front of them. No cryptography
solves that, and rotating codes need a live screen and a signal the holder may not have.

### 2.3 Scanning — refused

```
        │  ┌─ RED ─────────────────────────┐│
        │  │ ✕  Already used               ││
        │  │    Bríd McNamara              ││
        │  │    Day ticket                 ││
        │  │    1 of 1 admitted            ││
        │  │    Admitted at 09:20 by Marek ││
        │  └───────────────────────────────┘│
```

Each refusal is a different sentence, because each needs a different question:

| Reason | What the steward reads |
|---|---|
| `already_used` | **Already used** — with the time and who let them through |
| `wrong_event` | **Not for this event** — last month's gate day |
| `cancelled` | **Cancelled** |
| `withdrawn` | **Entry withdrawn** — refunded; there is no ticket to honour |
| `expired` | **Out of date** |
| `not_found` | **Not one of ours** — a real code, for a ticket this event does not hold |
| `forged` | **Not a valid ticket** — not issued by us at all: a tampered code, or a QR off a poster |

### 2.4 No signal

```
        │ Autumn Gate Day        [ Finish ] │
        │ Scanning as Ann Doyle             │
        │ ┌─ amber ─────────────────────┐   │
        │ │ No signal. Tickets are still│   │
        │ │ being checked against the   │   │
        │ │ list downloaded when you    │   │
        │ │ started, and will be sent   │   │
        │ │ when a signal returns.      │   │
        │ └─────────────────────────────┘   │
        │ ( 23 scans waiting to be sent )   │
```

And when the signal comes back and the server disagrees with something this phone let through:

```
        │ ┌─ amber ─────────────────────┐   │
        │ │ Let through here, but       │   │
        │ │ refused when sent           │   │
        │ │ Bríd McNamara — Already used│   │
        │ └─────────────────────────────┘   │
```

**Surfaced, not swallowed.** Offline, two phones cannot stop the same ticket being used at two
gates; they can only detect it afterwards. Hiding that would leave a club believing a count it
should not.

---

## 3. Afterwards — the ticket's own history

`Ticket details → Scanning`, the tab that already existed, with two columns added.

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │  The ticket   │  ► Scanning                                          │
  ├──────────────────────────────────────────────────────────────────────┤
  │  Scan status  Scanned        Scan count  1 of 1                      │
  │  Scan date    2 Sep, 09:20   Location    Main gate                   │
  │                                                                       │
  │  Scan History                                                         │
  │  ┌──────────────┬──────────────┬────────────┬───────────┬─────────┐  │
  │  │ Scan Date    │ Result       │ Scanned by │ Location  │ Notes   │  │
  │  ├──────────────┼──────────────┼────────────┼───────────┼─────────┤  │
  │  │ 2 Sep 09:20  │ success      │ Marek Nowak│ Main gate │ Admitted│  │
  │  │ 2 Sep 11:47  │ Already used │ Ann Doyle  │ Main gate │ Refused…│  │
  │  └──────────────┴──────────────┴────────────┴───────────┴─────────┘  │
  └──────────────────────────────────────────────────────────────────────┘
```

The second row is the point of writing refusals down. Before this, only successes were recorded — so
the duplicate a club actually wants to look at left no trace at all.

---

## 4. The activity setting

`Event → Activities → an activity`, beside the other entry rules.

```
  ┌── Gate entry ───────────────────────────────────────────────────────┐
  │  ☐ Limit number of applicants                                       │
  │  ☐ Allow specify quantity                                           │
  │                                                                      │
  │  ┌─ People admitted per ticket ──────┐                              │
  │  │ 4                                 │                              │
  │  └───────────────────────────────────┘                              │
  │  How many people one of this activity's tickets lets through the    │
  │  gate. 1 for a day ticket, 4 for a family ticket.                   │
  │                                                                      │
  │  ☐ Use terms and conditions                                         │
  └──────────────────────────────────────────────────────────────────────┘
```

Minimum 1 — an activity that admits nobody is a broken gate rather than a setting. The number is
copied onto each ticket when it is issued, so raising it in March does not change what a ticket sold
in February is worth.
