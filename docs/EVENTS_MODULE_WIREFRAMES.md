# Events Module - Visual Wireframes & Documentation

## Overview
This document provides visual wireframes and detailed descriptions of all screens in the Events Management module for ItsPlainSailing Organisation Admin system.

---

## 1. Events List Page

**Route:** `/orgadmin/events`

**Purpose:** Display all events with search and filtering capabilities

```
┌─────────────────────────────────────────────────────────────────────┐
│  Events                                          [+ Create Event]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [🔍 Search events...]              [Status: All ▼]          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Event Name    │ Dates           │ Status    │ Limit  │ Actions│  │
│  ├───────────────┼─────────────────┼───────────┼────────┼────────┤  │
│  │ Summer Regatta│ 15 Jun - 16 Jun │ Published │ 50 max │ 👥📄✏️ │  │
│  │               │                 │  (green)  │        │        │  │
│  ├───────────────┼─────────────────┼───────────┼────────┼────────┤  │
│  │ Training Day  │ 22 Jun 2024     │ Draft     │Unlimited│ 👥📄✏️ │  │
│  │               │                 │  (grey)   │        │        │  │
│  ├───────────────┼─────────────────┼───────────┼────────┼────────┤  │
│  │ Club BBQ      │ 01 Jul 2024     │ Cancelled │ 100 max│ 👥📄✏️ │  │
│  │               │                 │  (red)    │        │        │  │
│  └───────────────┴─────────────────┴───────────┴────────┴────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Search Box**: Real-time filtering by event name or description
- **Status Filter**: Dropdown with options (All, Draft, Published, Cancelled, Completed)
- **Status Chips**: Color-coded badges
  - 🟢 Green = Published
  - ⚪ Grey = Draft
  - 🔴 Red = Cancelled
  - 🔵 Blue = Completed
- **Action Icons**:
  - 👥 View Entries
  - 📄 View Details
  - ✏️ Edit Event

---

## 2. Create/Edit Event Page

**Route:** `/orgadmin/events/new` or `/orgadmin/events/:id/edit`

**Purpose:** Create new event or edit existing event with comprehensive attributes

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create Event                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─ Event Details ─────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  Event Name *                                                │    │
│  │  [_____________________________________________________]     │    │
│  │  Name as it appears to members on public website            │    │
│  │                                                              │    │
│  │  Description *                                               │    │
│  │  [_____________________________________________________]     │    │
│  │  [_____________________________________________________]     │    │
│  │  [_____________________________________________________]     │    │
│  │  Detailed event information including start time, location  │    │
│  │                                                              │    │
│  │  Email Notifications                                         │    │
│  │  [_____________________________________________________]     │    │
│  │  Comma-separated email addresses for notifications          │    │
│  │                                                              │    │
│  │  Event Start Date *        Event End Date *                 │    │
│  │  [📅 15/06/2024 10:00]    [📅 16/06/2024 17:00]            │    │
│  │                                                              │    │
│  │  Open Date Entries *       Entries Closing Date *           │    │
│  │  [📅 01/06/2024 00:00]    [📅 14/06/2024 23:59]            │    │
│  │                                                              │    │
│  │  All four dates are required. An empty one blocks Save and   │    │
│  │  the wizard's Next, and shows its message under that field:  │    │
│  │  "Entry opening date is required". A null entry window means │    │
│  │  unbounded to the server, so it is never a usable default.   │    │
│  │                                                              │    │
│  │  ☐ Limit Number Of Event Entries                            │    │
│  │                                                              │    │
│  │  ☐ Add Message To Confirmation Email                        │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Event Activities ──────────────────────────────────────────┐    │
│  │                                          [+ Add Activity]    │    │
│  │                                                              │    │
│  │  ⚠️ Add at least one activity to complete your event setup  │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  [Cancel]  [Save as Draft]  [Publish Event]                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Conditional Fields:**

When "Limit Number Of Event Entries" is checked:
```
│  ☑ Limit Number Of Event Entries                            │
│                                                              │
│  Event Entries Limit                                         │
│  [____50____]                                                │
│  Maximum number of entries allowed across all activities    │
```

When "Add Message To Confirmation Email" is checked:
```
│  ☑ Add Message To Confirmation Email                        │
│                                                              │
│  Confirmation Email Message                                  │
│  [_____________________________________________________]     │
│  [_____________________________________________________]     │
│  Custom text to include in confirmation emails              │
```

---

## 3. Event Activity Form (Component)

**Purpose:** Configure individual event activities with detailed settings

```
┌─ Activity 1: Junior Sailing ──────────────────────────── [▼] [🗑️] ─┐
│                                                                      │
│  Activity Name *                                                     │
│  [Junior Sailing_____________________________________________]       │
│  Activity name as it appears to members                             │
│                                                                      │
│  Description                                                         │
│  [For sailors aged 8-16 years_______________________________]       │
│  [_________________________________________________________]         │
│                                                                      │
│  ☑ Show Publicly                                                    │
│                                                                      │
│  Application Form *                                                  │
│  [Junior Entry Form ▼]                                              │
│  Select from application forms created in Form Builder              │
│                                                                      │
│  ☐ Limit Number of Applicants                                       │
│  ☐ Allow Specify Quantity                                           │
│  ☐ Use Terms and Conditions                                         │
│                                                                      │
│  Fee                                                                 │
│  [£__25.00__]                                                        │
│  Entry fee for this activity (0.00 for free)                        │
│                                                                      │
│  Allowed Payment Method                                              │
│  [Both ▼]  (Card / Cheque/Offline / Both)                          │
│                                                                      │
│  ☑ Handling Fee Included                                            │
│                                                                      │
│  Cheque/Offline Payment Instructions                                 │
│  [Please make cheques payable to "Sailing Club"____________]        │
│  [Send to: Club House, Marina Road___________________________]       │
│  [_________________________________________________________]         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Conditional Sections:**

When "Limit Number of Applicants" is checked:
```
│  ☑ Limit Number of Applicants                                       │
│                                                                      │
│  Application Limit                                                   │
│  [____30____]                                                        │
│  Maximum number of applicants for this activity                     │
```

When "Use Terms and Conditions" is checked:
```
│  ☑ Use Terms and Conditions                                         │
│                                                                      │
│  Terms and Conditions                                                │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ [B] [I] [U] │ [H1▼] │ [•] [1.] │                      │         │
│  ├────────────────────────────────────────────────────────┤         │
│  │ 1. All participants must wear life jackets             │         │
│  │ 2. Parents must sign consent forms                     │         │
│  │ 3. No refunds after registration closes                │         │
│  │                                                         │         │
│  └────────────────────────────────────────────────────────┘         │
│  Rich text editor with formatting options                           │
```

When Fee > 0 and Payment Method includes "Card":
```
│  ☑ Handling Fee Included                                            │
│  Indicates if card handling charge is included in fee               │
```

When Fee > 0 and Payment Method includes "Cheque/Offline":
```
│  Cheque/Offline Payment Instructions                                 │
│  [Instructions for offline payment_________________________]         │
│  Automatically included in confirmation email                        │
```

**Validation Rules:**

An event cannot be saved (as a draft or published) until every activity satisfies:

| Field | Rule |
|-------|------|
| Activity Name | Required, non-blank |
| Description | Required, non-blank |
| Application Form | **Required** – one must always be selected; entries cannot be captured without a form |

The Application Form dropdown has no "none" option: the "Select a form" placeholder is
disabled, so an existing selection cannot be cleared, only changed. When a save or a
wizard "Next" is attempted with a form missing, the field is highlighted in error with
"Every activity must have an application form selected", alongside the section-level
alert.

In the wizard (Create Event) these rules also block advancing past the Activities step.

---

## 4. Event Details Page

**Route:** `/orgadmin/events/:id`

**Purpose:** View complete event information including all activities

```
┌─────────────────────────────────────────────────────────────────────┐
│  [←] Summer Regatta 2024                    [Published]              │
│                                                                       │
│      [View Entries] [Edit] [Delete]                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─ Event Details ─────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  Description                                                 │    │
│  │  Annual summer regatta with racing for all age groups.      │    │
│  │  Starts at 10:00 AM. Parking available at marina.           │    │
│  │                                                              │    │
│  │  Start Date              End Date                            │    │
│  │  15 Jun 2024            16 Jun 2024                         │    │
│  │                                                              │    │
│  │  Entries Open           Entries Close                        │    │
│  │  01 Jun 2024 00:00     14 Jun 2024 23:59                   │    │
│  │                                                              │    │
│  │  Entry Limit                                                 │    │
│  │  50 entries maximum                                          │    │
│  │                                                              │    │
│  │  Email Notifications                                         │    │
│  │  admin@sailingclub.com, events@sailingclub.com             │    │
│  │                                                              │    │
│  │  Confirmation Email Message                                  │    │
│  │  Looking forward to seeing you at the regatta!              │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Event Activities ──────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  ┌────────────────────────────────────────────────────────┐ │    │
│  │  │ Activity  │ Fee    │ Payment  │ Visible │ Limit       │ │    │
│  │  ├───────────┼────────┼──────────┼─────────┼─────────────┤ │    │
│  │  │ Junior    │ £25.00 │ Both     │ Yes     │ 30 max      │ │    │
│  │  │ Sailing   │        │          │ (green) │             │ │    │
│  │  │ Ages 8-16 │        │          │         │             │ │    │
│  │  ├───────────┼────────┼──────────┼─────────┼─────────────┤ │    │
│  │  │ Open Race │ £35.00 │ Card     │ Yes     │ Unlimited   │ │    │
│  │  │ All ages  │        │          │ (green) │             │ │    │
│  │  ├───────────┼────────┼──────────┼─────────┼─────────────┤ │    │
│  │  │ Family    │ Free   │ N/A      │ Yes     │ 20 max      │ │    │
│  │  │ Fun Race  │        │          │ (green) │             │ │    │
│  │  └───────────┴────────┴──────────┴─────────┴─────────────┘ │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Delete Confirmation Dialog:**
```
┌─────────────────────────────────────────┐
│  Delete Event                           │
├─────────────────────────────────────────┤
│                                         │
│  Are you sure you want to delete this  │
│  event? This action cannot be undone.  │
│                                         │
│  [Cancel]              [Delete]         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 5. Event Entries Page

**Route:** `/orgadmin/events/:id/entries`

**Purpose:** Who has entered, grouped into the classes they entered

```
┌─────────────────────────────────────────────────────────────────────┐
│  Entries                                        [📥 Export to Excel] │
│  Spring League                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  🔍 Search by name, email or class…                           │  │
│  │  Showing 4 of 4 entries                                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  80cm   2 entries                                                    │
│  ┌──────────────────┬─────────────────────────┬────────────┬──────┐ │
│  │ Name             │ Email                   │ Entered    │Status│ │
│  ├──────────────────┼─────────────────────────┼────────────┼──────┤ │
│  │ Áine McGrath     │ aine@example.test       │ 01 Aug 10:0│[Paid]│ │
│  │ Bríd McNamara    │ brid@example.test       │ 02 Aug 09:1│[Paid]│ │
│  └──────────────────┴─────────────────────────┴────────────┴──────┘ │
│                                                                       │
│  1.00m   1 entry                                                     │
│  ┌──────────────────┬─────────────────────────┬────────────┬──────┐ │
│  │ Rónán McGrath    │ aine@example.test       │ 01 Aug 10:0│[Pend]│ │
│  └──────────────────┴─────────────────────────┴────────────┴──────┘ │
│                                                                       │
│  [← Back]                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Key features:**
- **Grouped by class**, because that is the unit a club works in — the entries
  for the 80cm are a class list, and a flat table across six classes is not one.
  Grouped by activity **id**, not name: a two-day event runs "80cm" on both days.
- **A count beside each class**, which is the number an organiser checks against
  a limit.
- **Name, email and date entered** — who entered, how to reach them, and when.
  Everything else about an entry is one click away rather than crammed into the
  row.
- **Search across every class at once**, on name, email or class name. A class
  whose entries are all filtered out disappears with them.
- **A row opens that entry**, at `/events/:id/entries/:entryId`.

**Empty state:** *Nobody has entered yet.* — distinct from the filtered state,
*No entries match your search.*, and from a load failure, *We could not load the
entries.*

**Withdrawn entries are not here.** An entry refunded with *"also withdraw from
the event"* has `entry_status = 'removed'`: off this list and out of the counts —
this is the list a club prints on the day — while staying on record and reachable
from the payment that refunded it. See
[PARTIAL_REFUNDS.md](PARTIAL_REFUNDS.md).

---

## 6. Event Entry Details Page

**Route:** `/orgadmin/events/:id/entries/:entryId`

**Purpose:** One entry, in full — what a secretary is asked on the phone

```
┌─────────────────────────────────────────────────────────────────┐
│  Áine McGrath                                          [ Paid ] │
│  80cm — Spring League                                           │
├─────────────────────────────────────────────────────────────────┤
│  Who entered                                          [✎ Edit] │
│  ─────────────────────────────────────────────────────────────  │
│  Name                                                           │
│  Áine McGrath                                                   │
│  Email                 Membership                               │
│  aine@example.test     Áine McGrath  (opens the member)          │
├─────────────────────────────────────────────────────────────────┤
│  The entry                                                      │
│  ─────────────────────────────────────────────────────────────  │
│  Class                 Entry fee                                │
│  80cm                  €25.00                                   │
│  About this class                                               │
│  Open to riders who have not won at this level                  │
│  Event                 Event dates                              │
│  Spring League         12 Sep 2026 – 13 Sep 2026                │
│  Entry Date                                                     │
│  01 Aug 2026 10:00                                              │
├─────────────────────────────────────────────────────────────────┤
│  Form Submission Data                                           │
│  ─────────────────────────────────────────────────────────────  │
│  Pony name             Entrant age group                        │
│  Bramble               Under 12                                 │
│  Medical notes                                                  │
│  Asthma inhaler carried in the tack box                         │
├─────────────────────────────────────────────────────────────────┤
│  Payment                                                        │
│  ─────────────────────────────────────────────────────────────  │
│  Payment Status        Payment Method                           │
│  Paid                  Card                                     │
│  Payment total         Paid                                     │
│  €185.23               01 Aug 2026 10:00                        │
│  [🧾 Open the payment]                                          │
└─────────────────────────────────────────────────────────────────┘
[← Back to entries]
```

**Key features:**
- **The answers the entrant gave.** The form itself is gone once the entry
  exists, so this is the only place the club can read back what was declared.
  Labels come from the form, joined to the stored answers by `formSummariesFor`
  — the same helper the member's own screens use.
- **The payment it came in on**, found through
  `payment_transactions.fulfilment_ref`, with a link into it: an entry is
  usually one line of a basket, and the rest of it is what the club is asked
  about next. An entry added by hand has no payment record and says so.
- **Whether they entered as a member**, and which one. An entry carries its own
  name — a parent may enter a child who is not the account holder.
- **A class that asked nothing** shows *This class asked for no additional
  details.* rather than an empty heading implying the answers were lost.
- **A club can correct a mistake** — **Edit**, beside *Who entered* because the
  name is the commoner correction and an activity that asks nothing still has
  one to fix. Section 7.

**Payment status colours:** 🟢 Paid · 🟡 Pending · 🔴 Refunded

**A withdrawn entry is headed by a notice** — *"This entry was withdrawn on 20
Aug 2026 — Withdrew before the closing date."* It is off the entrant list and
still here, which is the point of withdrawing rather than deleting, so somebody
arriving from the payment that refunded it must not read it as an entry that
still stands.

> The `EventEntryDetailsDialog` component is superseded by this page. It was
> never mounted anywhere and its API hook is a stub returning empty data.

---

## 7. Correcting an Entry

**Opened from:** *Edit*, beside *Who entered* on the entry details page

**Purpose:** the club's remedy for a member's mistake — a name typed in a hurry,
a vaccination date a year out — which used to mean database access

```
┌ Edit this entry ────────────────────────────────────────────────┐
│  The entrant’s name, and every question on the form — whether    │
│  or not it was answered.                                         │
│                                                                  │
│  Name *                                                          │
│  [ Áine McGrath                                              ]   │
│  ──────────────────────────────────────────────────────────────  │
│  Pony name                                                       │
│  [ Bramble                                                   ]   │
│  Entrant age group                                               │
│  [ Under 12                                               ▾ ]    │
│  Entrant date of birth                                           │
│  [ 12/05/2012                                            📅 ]    │
│  Medical notes                        ← never answered, offered  │
│  [                                                           ]   │
│                                                                  │
│  ⚠ Still needed: Emergency contact name                          │
│                                                                  │
│                                       [ Cancel ]  [   Save   ]   │
└──────────────────────────────────────────────────────────────────┘
```

**Key features:**
- **Every field of the form, answered or not.** The read-only summary drops
  blanks — right for reading back what somebody said, useless for correcting it,
  because the skipped question is the one being filled in. The fields come from
  `/application-forms/:formId/with-fields`, not from the answers.
- **The name as one field.** It is typed as one string into *Who is this entry
  for?* and split at the first space only so the schema has somewhere to put it;
  offering *first* and *last* here would ask the club to maintain a split it
  never made.
- **The same controls the member met** — `FieldRenderer`, so a date is a date
  picker and a choice is a choice.
- **Save is held** while a required answer is missing or an answer is wrong for
  its field, and the dialog names them by **label**.
- **An activity that asks nothing still opens this**, with the name alone.
- **A refusal changes nothing.** The name and the answers are checked before
  either is written, so a rejected form does not leave the entrant renamed.

Saved with `PUT /events/:id/entries/:entryId/answers`, audited as
`entry.answers-corrected`. See [CORRECTING_AN_ENTRY.md](CORRECTING_AN_ENTRY.md).

---

## Navigation Flow

```
Events List Page
    │
    ├─→ Create Event Page
    │       │
    │       └─→ Add Activities (EventActivityForm)
    │               │
    │               └─→ Save → Back to Events List
    │
    ├─→ Edit Event Page (same as Create)
    │
    ├─→ Event Details Page
    │       │
    │       ├─→ Edit Event
    │       ├─→ Delete Event
    │       └─→ View Entries
    │
    └─→ Event Entries Page  (grouped by class)
            │
            ├─→ Search by name, email or class
            ├─→ Export to Excel
            └─→ Event Entry Details Page
                    │
                    ├─→ Open the member
                    ├─→ Open the payment
                    └─→ Edit this entry (name + every form field)
```

---

## Color Scheme & Styling

**Status Colors:**
- Published: `#4caf50` (Green)
- Draft: `#9e9e9e` (Grey)
- Cancelled: `#f44336` (Red)
- Completed: `#2196f3` (Blue)

**Payment Status Colors:**
- Paid: `#4caf50` (Green)
- Pending: `#ff9800` (Orange)
- Refunded: `#f44336` (Red)

**Primary Actions:**
- Primary Button: `#1976d2` (Blue)
- Secondary Button: Outlined with grey border
- Danger Button: `#f44336` (Red)

**Typography:**
- Page Title: H4 (34px)
- Card Title: H6 (20px)
- Body Text: 16px
- Helper Text: 14px (grey)

**Spacing:**
- Page Padding: 24px
- Card Padding: 16px
- Element Spacing: 16px vertical, 8px horizontal
- Form Field Spacing: 24px vertical

---

## Responsive Behavior

**Desktop (>960px):**
- Full table layout
- Side-by-side date pickers
- Multi-column grids

**Tablet (600-960px):**
- Stacked date pickers
- Reduced table columns
- Scrollable tables

**Mobile (<600px):**
- Card-based list view instead of tables
- Full-width form fields
- Stacked action buttons
- Collapsible sections

---

## Accessibility Features

- **Keyboard Navigation**: All interactive elements accessible via Tab
- **Screen Reader Support**: Proper ARIA labels on all form controls
- **Focus Indicators**: Visible focus rings on interactive elements
- **Color Contrast**: WCAG AA compliant contrast ratios
- **Form Labels**: All inputs have associated labels
- **Error Messages**: Clear, descriptive error messages
- **Loading States**: Announced to screen readers

---

## Key Interactions

1. **Search/Filter**: Real-time filtering without page reload
2. **Status Chips**: Visual indicators with hover tooltips
3. **Action Buttons**: Icon buttons with hover tooltips
4. **Collapsible Sections**: Smooth expand/collapse animations
5. **Date Pickers**: Calendar popup with time selection
6. **File Upload**: Drag-and-drop support with progress indicators
7. **Rich Text Editor**: Toolbar with formatting options
8. **Dialogs**: Modal overlays with backdrop click to close
9. **Form Validation**: Inline validation with error messages
10. **Loading States**: Skeleton screens and spinners

---

## Notes for Developers

- All components use Material-UI (MUI) v5
- Date handling uses `date-fns` library
- Rich text editor uses `react-quill`
- Forms use controlled components with React state
- API calls use mock data until backend is implemented
- Responsive breakpoints follow MUI defaults
- Theme uses neumorphic design principles
- All text is internationalization-ready

