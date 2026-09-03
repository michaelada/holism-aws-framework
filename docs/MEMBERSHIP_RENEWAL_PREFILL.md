# A renewal opens filled in

## The ask

> If I am renewing a membership where I select the Renew button on my existing
> membership record, and when I select the membership type, the displayed fields
> in the form should be automatically populated with the values from my existing
> membership record. I should not have to type them in again.

A renewal gives the club the same address, the same emergency contact and the
same medical notes as last season. The member was retyping all of it, once per
child.

## Which membership, and how it survives the journey

Renewal is three screens: the membership card → the catalogue → the application
form. The card knows which membership is being renewed; the form is where that
matters; and nothing connected the two.

So the membership id travels with the member, as `?renew=`:

```
/khpc/memberships                      Renew
/khpc/browse/memberships?renew=member-9        choose a type
/khpc/browse/memberships/mt-1/apply?renew=member-9
```

**Not "their most recent membership of that type", which the server could have
worked out on its own.** A parent holds four, and inferring which is being
renewed would eventually open the form with the wrong child's details filled
in — a wrong answer that looks like the member's own.

## Where the answers come from

`GET /api/account/:orgCode/memberships/:membershipId/form-answers` returns
`submission_data` from the membership's form submission, keyed by field `name` —
which is the shape the application form already holds its own values in, so the
prefill is a merge rather than a translation.

Scoped to the caller's own memberships, and **not found and not-yours answer
identically**: this returns the contents of an application form, so confirming
that an id is real would be a way of learning which ids exist.

## Three rules the prefill follows

- **Only fields the chosen type actually asks for.** Renewing into a *different*
  type is allowed and that type may ask different questions; an answer to a
  question nobody asked would be submitted as an orphan.
- **It fills blanks, it does not overwrite.** Anything the member has already
  typed stays. The effect runs once the form definition has loaded, because
  until then there is nothing to match against.
- **A failure leaves a working form.** If the answers cannot be read the form
  opens blank — which is exactly what it did before this existed. A convenience
  must not be able to take the form down with it.

## It says so

> Filled in from your current membership. Please check it is still correct.

A form that fills itself in has to be checked. A member who does not know where
the answers came from either trusts them without reading — and renews on an
address they moved out of — or retypes them anyway, which is the work this was
meant to save.

## Tests

`EntryFormPage.test.tsx` — last season's answers appear in the fields; the
notice appears with them; an answer the chosen type does not ask for is left
behind; a fresh application (no `?renew=`) opens blank with no notice; and a
failed lookup still renders a usable form.

`MyMembershipsPage.test.tsx` — Renew names the membership in the URL.

`account-activity.service.test.ts` — the answers come back keyed by field name;
the query is scoped by membership, member and organisation; a membership with no
submission reports empty answers rather than failing.

---

# The answers belong to whoever is named above them

Reported from the product, in three parts:

> I logged in as Áine, the home page said her membership expires in 15 days, so I clicked Renew.
> That brought me to the membership types listing, I chose Senior Member — and the form was not
> populated with her details. Selecting her name in "Select a name to fill in" filled nothing
> either. It *did* autofill if I went through My Memberships → Renew. And when I click a different
> name it does not clear Áine's values, and does not fill in the new person's.

Three faults, and one rule that resolves all of them: **the answers on screen belong to the
applicant named above them, and follow whoever that is.**

## 1. Two Renew buttons, two journeys

`MyMembershipsPage` sent the member to `…/browse/memberships?renew=<id>`; the dashboard's card sent
them to `…/browse/memberships`. Without `?renew=` the catalogue opens a *fresh application*, which is
why the same membership renewed from the home page arrived blank. The home page now carries it too,
which is the whole of that fix.

## 2. "Select a name to fill it in" filled in only a name

It said what it did — the name — but on a screen where the club already holds that person's answers,
it is the wrong thing to do only half of. `applicantSuggestions` deliberately withheld the membership
id, because as `memberId` it would have read as *renew this one*. It now carries it as
**`fillFromMembershipId`**, which says something different and weaker: *there are answers on file for
this name*. `memberId` stays null, so nothing about eligibility or linkage changes.

Choosing a name — from a chip, from the list, or typed out — fills the form from that person's own
membership.

## 3. Changing the name left the last person's answers

The worst of the three: Áine's date of birth under Rónán's name, ready to be submitted as his. The
form now tracks **which fields it filled in**, as opposed to which the member typed, and on a change
of applicant takes back exactly those — replacing them with the new person's answers, or leaving them
empty where the club holds none.

The rule is one sentence: *the member's own typing wins, and everything the form filled in is the
form's to take back.* Clearing everything would delete a member's work for the crime of correcting a
name; clearing nothing is the bug.

Two implementation notes, both learned the hard way:

- **The filled-in field list is a `ref`, not state.** Two fills can be in flight at once — the
  renewal's, and one a member starts by choosing a name a moment later — and the second closing over
  a stale copy neither clears what the first wrote nor recognises it as its own.
- **The decision happens outside the `setValues` updater.** An updater runs later than the line after
  it, so a flag set from what the updater computed is set from nothing.

## And the name field fills itself in on a renewal

`/memberships/:id/form-answers` now returns `memberName` as well. A renewal knows whose membership it
renews, so leaving "Who is this membership for?" empty asked a question the URL had already
answered — and left the answers on screen belonging to nobody in particular. Filled only where the
member has not already said who it is for.

## Tests

`EntryFormPage.test.tsx` — the details of the person whose name is chosen appear; choosing a
different person swaps them; choosing a name with nothing on file takes back what was filled;
what the member typed themselves survives both; and a renewal names its applicant.

`HomePage.test.tsx` — Renew carries `?renew=` from the dashboard card.

`entrant.suggestions.test.ts` — each suggestion says which membership its answers can be copied from,
while `memberId` stays null; a name used once on an entry carries neither.

`account-activity.service.test.ts` — the answers carry the member's name, and report null rather than
an empty one.

---

# And an entry fills itself in the same way

> I added a membership for Michael Adams, then went to the Tara Hunter Trial to enter the Open class.
> Selecting "Michael Adams — Associate Member" did not populate anything. The membership form has
> "Entrant date of birth" and so does the entry form, but it was not filled in.

Right, and the mechanism was already here — it simply did not run for entries. `EntryFormPage` is one
page serving both journeys, and every part of the fill was gated on `kind === 'membership'`.

**They are the same question.** A club asks a rider's date of birth, their emergency contact and
their medical notes on the entry form, and it already holds all three because the same person gave
them on a membership application. Asking again for every class of every event is exactly the work
this saves.

## Where the membership comes from differs

The two suggestion lists are built for different purposes, so the fill reads a different field on
each:

| | What identifies the person | Why |
|---|---|---|
| **Entry** | `memberId`, already on the suggestion and on the autocomplete option | A members-only class has to prove eligibility, and it is the same `members` row whose answers are on file |
| **Application** | `fillFromMembershipId` | An application *creates* a membership rather than resolving to one, so `memberId` would read as "renew this one". This says only *there are answers on file for this name* |

Everything after that is shared: only fields this form asks for are carried, the member's own typing
is never overwritten, choosing a different rider swaps the answers, and choosing a name the club
holds nothing for takes them back.

The notice names whose details are on screen — *"Filled in from Michael Adams's membership details.
Please check they are still correct."* On an entry that matters more than on a renewal: a parent
filling in a form for one of three children needs to know which one's answers are in front of them.

## Checked against the reported case

Michael Adams's Associate membership at Meath Hunt, against the Tara Hunter Trial's Open class:

```
membership answers: county, age_group, rider_dob, rider_email, rider_phone, address_line,
                    guardian_name, medical_notes, photo_consent, guardian_phone,
                    emergency_contact_name, emergency_contact_phone
entry form asks:    rider_dob, rider_email, rider_phone, age_group, years_riding, pony_name,
                    pony_height, pony_breed, vaccination_status, grade_level,
                    emergency_contact_name, emergency_contact_phone, medical_notes, is_first_aider
would carry across: age_group, rider_dob, rider_email, rider_phone, medical_notes,
                    emergency_contact_name, emergency_contact_phone
```

Seven fields, `rider_dob` among them. The pony's name, its height and its breed are the entry's own
questions and stay for the member to answer.

## Tests

`EntryFormPage.test.tsx` — the entry form fills from the member chosen; it asks the membership named
on the suggestion; it carries only what the entry form asks; it says whose details they are; it swaps
them for a different rider; it takes them back for a name with nothing on file; and it never
overwrites what the member typed.
