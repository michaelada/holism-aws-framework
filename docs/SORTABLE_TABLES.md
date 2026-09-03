# Sorting an org-admin list by its columns

> Click a column heading to sort ascending, click again for descending. Works for text, numbers,
> dates, date-times and times.

---

## 1. What was asked, and what it needed

Every list in org-admin was in whatever order the server returned it. A club looking for the event
with the most entries, the member whose membership expires soonest, or the largest payment of the
month had a filter and a search box and no way to say "biggest first".

Three things had to be true for the answer to be worth having:

| # | |
|---|---|
| R1 | A heading sorts **ascending on the first click and descending on the second** |
| R2 | The order is right for **text, numbers, dates, date-times and times** — not alphabetical by accident |
| R3 | It reaches **every list table in org-admin**, not the three someone remembered |

---

## 2. Design

### 2.1 One comparison, in one place

[`orgadmin-core/src/utils/sorting.ts`](../packages/orgadmin-core/src/utils/sorting.ts) holds the
whole of it, and three rules are worth stating because each is a way of getting it wrong:

**Type is read from the value, not declared by the column.** A column holds what the row holds. A
call site that had to name the type for each of about two hundred columns would name one wrongly,
and the failure — a date column in alphabetical order — is the kind nobody notices until a club
does. So `compareValues` recognises what it is given: a `Date`, a number, a boolean, an ISO date or
date-time (`2026-09-02`, `2026-09-02T14:30:00Z`), a clock time (`09:30`, `14:00:00`), or text.
Dates and times become numbers, so a column carrying both a bare date and a date-time still orders.

**Empty always sinks.** A blank cell goes to the bottom ascending *and* descending. Nobody sorts
"Entries closing" to find the events with no closing date; they are looking for the earliest or the
latest, and a column of blanks on top hides it either way.

**Text compares the way the reader's language does.** `localeCompare` with `numeric: true` so
"Item 10" follows "Item 9", and `sensitivity: 'base'` so case and accents do not split one list into
two alphabets — `aoife`, `Bríd`, `Colm` rather than `Bríd`, `Colm`, `aoife`.

The sort is **stable**, so rows a column cannot separate keep the order they arrived in. That is
what makes sorting by Status read as a grouping rather than a shuffle.

### 2.2 Two changes per table

```tsx
const sort = useTableSort(filteredEvents);
…
<SortableTableCell sort={sort} field="startDate">{t('events.table.dates')}</SortableTableCell>
…
{sort.rows.map((event) => …)}
```

The header cells that should sort become `SortableTableCell`, and the array the body maps over
becomes `sort.rows`. Nothing else moves.

**The hook holds the rows** rather than returning only the state. The alternative is one line of
sorting per table repeated thirty times, and thirty chances to compare a date as a string. This way
the comparison happens once and a page cannot get it wrong by not thinking about it.

### 2.3 Sort by the value, not by what is on screen

A column showing something derived names an **accessor**:

```tsx
const sort = useTableSort(members, {
  accessors: { name: (m) => `${m.lastName} ${m.firstName}` },
});
```

This is where most of the judgement went, and the pattern is always the same: **the value orders,
the rendering does not.**

- A money column formatted `€1,240.00` sorts as text into a nonsense order — `€1,240.00` before
  `€9.00`. The number behind it does not.
- A status chip whose label is translated would sort differently in each of six locales. The raw
  status keeps one order everywhere.
- A price *range* — `€10.00 - €25.00` — has no order at all. The lowest price has.
- A date **range** — "2–4 September" — likewise. The start date has.
- "Unlimited" is not a very large number. Sorting an entry limit as text would put every unlimited
  event above every capped one; the accessor returns `null` and lets it sink.
- A stock indicator sorts by severity, not by the words: one click on Stock brings what needs
  restocking to the top.
- Labels and roles sort by the labels themselves, so members sharing one land together — a count
  would order by how many, which is not the question.

### 2.4 What is not sortable, and why

Three kinds of column deliberately carry no arrow, because an arrow that cannot reorder anything is
a promise the table does not keep:

- **A picture or a colour** — the merchandise thumbnail, a calendar's swatch.
- **Actions and checkboxes** — they caption themselves and hold no value.
- **A column that is the same for every row** — membership Pricing reads "Configured" for everyone
  until payment integration fills it in.

And one whole table: **the audit log**. It is cursor-paged from the server, fifty at a time, so what
is on screen is the newest fifty of possibly thousands. Sorting those by "Who" would put one name at
the top of a table that looks like the whole log and is not — the earliest entry for that person is
almost certainly on a page nobody has loaded. Its filters are the honest way to narrow it, because
the server applies them to everything. Sorting it properly means ordering in SQL, which is a
separate piece of work.

### 2.5 Where sorting sits among the other things a list does

**After filtering** — so the reader's choice of column survives a search, and "the events with the
most entries" comes from the rows they can actually see.

**Before paging** — a page of a sorted list, not a sorted page. Sorting the twenty rows on screen
would order them among themselves and leave the rest where they were, which is not what clicking a
heading asks for. Where a table pages (Discounts), changing the order also **returns to page one**:
staying on page three of a list that has just been reordered shows rows nobody asked to see.

### 2.6 Accessibility, and the one place it is not offered

`TableSortLabel` rather than an `onClick` and an arrow: the heading is a real button, reachable by
keyboard and announced as one, and the arrow appears on hover before a column is sorted — which is
how a reader discovers that any of this is possible. `sortDirection` on the cell becomes `aria-sort`,
and it is set on the **active column only**; every column claiming a direction would tell a screen
reader the table is sorted six ways at once.

**Below `md` there is nothing to click.** `ResponsiveTable` hides the header row and stacks each row
as label/value pairs, so a phone shows the list in whatever order it arrives in. Where a page has a
hand-built card layout for small screens (the members and registrations databases) the cards follow
the desktop choice, so an administrator who sorts on a laptop and then narrows the window does not
watch the rows jump back. A sort control designed for a phone is a separate piece of work.

---

## 3. Where it is

| | |
|---|---|
| The comparison | `orgadmin-core/src/utils/sorting.ts` — `compareValues`, `sortRows` |
| The hook | `orgadmin-core/src/hooks/useTableSort.ts` |
| The heading | `orgadmin-core/src/components/SortableTableCell.tsx` |

Sorted tables, by package:

| Package | Tables |
|---|---|
| `orgadmin-core` | Payments, Refunds, Lodgements, Lodgement detail, Payment detail (items, refunds, settlement), Forms, Fields, Org-admin users, Account users, User groups, Registrations queue, Members report, Events report |
| `orgadmin-events` | Events, Event types, Venues, Discounts, Discount usage, Event entries |
| `orgadmin-memberships` | Members database, Membership types |
| `orgadmin-merchandise` | Merchandise types, Orders |
| `orgadmin-calendar` | Calendars, Bookings |
| `orgadmin-registrations` | Registration types, Registrations database |
| `orgadmin-ticketing` | Ticketing dashboard, Event ticketing, Ticketed events overview, a ticket's scan history |
| `orgadmin-announcements` | Announcements |

Not sorted: the **audit log** (§2.4), the membership form's **field configuration** table — which
lists the fields in the order the form defines them, and reordering it would break the
correspondence with the form being configured — and the branding **preview** table, which is a
sample rather than a list.

---

## 4. Two defaults that are not "as it arrived"

Most tables open unsorted, in whatever order the server sent. Three open on a column, because the
useful order is not the arrival order:

| Table | Opens on | Why |
|---|---|---|
| Payments | Date, newest first | The question asked of a payment list is "what has just come in" |
| Refunds | Requested, newest first | The same |
| Lodgements | Arrival, newest first | Stripe returns them this way; the sort states it rather than depending on it |
| Registrations queue | Registered, **oldest** first | A queue of people to approve is worked from the front — somebody who registered a fortnight ago should not be at the bottom of it |

---

## 5. Two defects this surfaced

**`TicketDetailsDialog` could put an object into an array.** `setScanHistory(response || [])` trusts
whatever the endpoint sent, and `useApi.execute` answers `null` on an error. Before sorting, a
non-array read as an empty history; iterating it threw. Now checked with `Array.isArray`, and
`useTableSort` treats a list that is not a list as an empty one rather than white-screening the page
— sorting is a display concern and should not be what turns a bad response into a blank screen.

**`PaymentsListPage.test.tsx` assumed row order.** It clicked "the first View button" and asserted
it opened payment 1. With the list opening newest-first that is payment 3. The test now finds the
row by the payer's name and clicks the button inside it, which is what it meant all along.
