# A date that was just picked, and an activity that can be entered twice

Two reports, unrelated in cause and both about being refused something reasonable.

---

## 1. "Must be a valid date" on a date that had just been chosen

> I selected a date from the Entrant's date of birth field, but now the form is showing a red error
> which says "Must be a valid date".

Two faults, one symptom.

**An empty date field was reported as a wrong one.** Yup casts `''` to an Invalid Date, so
`validateField` answered *"Must be a valid date"* for a field nobody had filled in yet. Whether it may
be left empty is the required rule's business; this is the difference between *not filled in* and
*filled in wrongly*, which `validateApplicationField` had always drawn and the field-level validator
had not. The two now agree:

```
empty     valid=true
null      valid=true
iso       valid=true
nonsense  valid=false  Must be a valid date
```

**And the blur validated the value from before the pick.** Choosing a date closes the picker's
popover, which **blurs the input** — and the blur ran before the chosen date had come back down as a
prop, so `validate(value)` saw the empty field the member had just filled in. `FieldRenderer` now
validates through a ref holding the current value.

**A corrected error also clears itself.** The error lived in state until the next blur, and on a
picker there may not be one — so the field stayed red under an answer that was already right. An
effect clears it when the value becomes valid. It only ever *clears*: an error is still raised on
blur, so a half-typed answer is not marked wrong while it is being typed.

### Tests

`FieldRenderer.test.tsx` — an empty date field is not an error; the blur validates the value it has
*now*; a genuinely unparseable value still says so; and a corrected value clears the error without
waiting for a blur.

---

## 2. "Already entered", on an activity that should take a second entry

> I go to the Tara Hunter Trial event and it shows "Already Entered" for the Open class. I should be
> able to add entries for the same activity multiple times — for other people, or even for myself,
> e.g. entering the same event on two different horses.

One entry per person per class was enforced in **five** places:

| Where | Rule |
|---|---|
| `account-catalogue.service` | `already-entered` — this login has an entry, so the activity is closed |
| | `members-all-entered` — every membership this login holds has entered |
| | `in-your-basket` — a line for it is already in the basket |
| `account.routes` (add to cart) | refuses a member whose `alreadyEntered` is true |
| | refuses the same member twice in one basket |
| `EntrantNameField` | an already-entered member was a **disabled** option |

All five are gone. What a class actually looks like is a parent entering three children, a secretary
entering half the club, and one rider on two horses in the same class — and every one of those was
refused, three of them with a message that reads as a capacity problem rather than a rule.

**`alreadyEntered` survives as information.** The name field still says *Already entered* beside the
member; it no longer disables them. Knowing is useful; being stopped is not.

**What this gives up, plainly:** an accidental double entry is now possible, and the basket rule in
particular existed so that a parent would not pay twice for one child. That is a real mistake, and
the club has a remedy for it — refund the line and withdraw the entry, which
[PARTIAL_REFUNDS.md](PARTIAL_REFUNDS.md) added. There is no remedy for a refusal.

**Capacity is untouched.** Two entries take two places; a hold still spends one against the cap. What
changed is who may take them, not how many there are. `in-your-basket` also stays for **calendar
slots**, which is a different thing: a slot is one thing at one time and genuinely cannot be booked
twice.

Read back for the account that reported it:

```
Tara Hunter Trial
   Open class           available=true  reason=—
   Junior class         available=true  reason=—
   Spectator car pass   available=true  reason=—

   this login's existing entries: Darragh O'Toole (Open class)
```

### Tests

| Suite | Covers |
|---|---|
| `account-catalogue.members-only.test.ts` | an activity stays open to a login that has entered, and to members who have all entered — with `alreadyEntered` still reported on each |
| `account-catalogue.capacity.test.ts` | a member's own hold no longer closes the activity, and still counts against the cap |
| `account-catalogue.routes.test.ts` | a member who has entered is accepted, and the same member twice in one basket is accepted |
| `BrowsePage.test.tsx` | the activity stays open with an Add to basket button |

The two unavailable reasons `already-entered` and `members-all-entered` are removed from the union
and from all six locales.

---

## 3. And the same dates, read back

> When I view the entry details in the account view, the date and datetime field values show as what
> look like ISO date strings. Format them nicely, in the same format as other dates and times
> displayed.

`2012-05-04T00:00:00.000Z` under "Date of birth". Right for storing and unreadable on a page.

The answers reach a screen as `{ label, value }` — display text, deliberately: the server turns
booleans into "Yes" and lists into "Sat, Sun" so the same answer reads the same in the basket, in the
member's own record and in the club's export. What it could not do is format a **date**, because that
depends on the reader's locale, which the summary does not know.

So the datatype travels with the answer, and the client formats:

```
label                          stored                        shown
Rider date of birth            1988-04-18                    18 Apr 1988
```

`formatFormAnswer` in `packages/components` uses **the same formatters the rest of the app reads
dates with** — `formatDisplayDate` and `formatDisplayDateTime` — so an answer and the entry date
above it are written the same way. `time` renders as `HH:MM` and nothing else: the day is not part
of that answer, and showing one would invent it.

Three things it does not do:

- **It does not reformat anything else.** `2012` typed into a *number* field parses as a date; the
  datatype is what decides, not the value.
- **It does not replace an unparseable answer with a dash.** The member wrote it, and the club may
  need to see what they wrote.
- **It does not require the datatype.** An older cached response without one shows the value as it
  came.

Applied wherever a form summary is read: the entry detail, My Memberships, and the basket.

### Tests

`applicationField.test.ts` — a date, a datetime, a time, everything else left alone, a number that
parses as a date, an unparseable answer, a second locale, and a missing datatype. The date cases are
built from a **local** instant rather than a `…Z` literal: an answer renders in the reader's own
zone, so a UTC literal would assert the test runner's offset rather than the formatting.
`form-summary.test.ts` (new) — the datatype travels with the answer, blanks stay out, and no query
is made for a set with no submissions.
