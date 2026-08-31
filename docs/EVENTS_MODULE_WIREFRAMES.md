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

**Purpose:** View and manage all entries for an event with filtering and export

```
┌─────────────────────────────────────────────────────────────────────┐
│  Event Entries                              [📥 Download All Entries]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [Event Activity: All Activities ▼]  [🔍 Search by name...]  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Activity    │ First Name │ Last Name │ Entry Date/Time │ Act. │  │
│  ├─────────────┼────────────┼───────────┼─────────────────┼──────┤  │
│  │ Junior      │ Emma       │ Wilson    │ 05 Jun 10:23    │  👁️  │  │
│  │ Sailing     │            │           │                 │      │  │
│  ├─────────────┼────────────┼───────────┼─────────────────┼──────┤  │
│  │ Open Race   │ James      │ Smith     │ 05 Jun 14:15    │  👁️  │  │
│  │             │            │           │                 │      │  │
│  ├─────────────┼────────────┼───────────┼─────────────────┼──────┤  │
│  │ Junior      │ Oliver     │ Brown     │ 06 Jun 09:45    │  👁️  │  │
│  │ Sailing     │            │           │                 │      │  │
│  ├─────────────┼────────────┼───────────┼─────────────────┼──────┤  │
│  │ Family      │ Sarah      │ Johnson   │ 07 Jun 16:30    │  👁️  │  │
│  │ Fun Race    │            │           │                 │      │  │
│  └─────────────┴────────────┴───────────┴─────────────────┴──────┘  │
│                                                                       │
│  Showing 4 entries                                                    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Activity Filter**: Dropdown to filter by specific event activity
- **Name Search**: Real-time search across first and last names
- **Download Button**: Exports all entries to Excel with separate tables per activity
- **View Action**: Eye icon (👁️) opens entry details dialog

**Empty State:**
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    No entries yet for this event              │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Filtered Empty State:**
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                  No entries match your filters                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. Event Entry Details Dialog

**Purpose:** Display complete entry information including form submission and files

```
┌─────────────────────────────────────────────────────────────────┐
│  Entry Details                                          [Close] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  First Name              Last Name                              │
│  Emma                    Wilson                                 │
│                                                                 │
│  Email                   Quantity                               │
│  emma.wilson@email.com   1                                      │
│                                                                 │
│  Payment Status          Payment Method                         │
│  [Paid] (green)         Card                                   │
│                                                                 │
│  Entry Date                                                     │
│  05/06/2024, 10:23                                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Form Submission Data                                           │
│                                                                 │
│  Age                                                            │
│  12                                                             │
│                                                                 │
│  Experience Level                                               │
│  Intermediate                                                   │
│                                                                 │
│  Emergency Contact                                              │
│  Jane Wilson - 555-0123                                        │
│                                                                 │
│  Dietary Requirements                                           │
│  Vegetarian                                                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Uploaded Files                                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📄 parental_consent.pdf                    [📥 Download] │ │
│  │  PDF • 245 KB                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📄 medical_form.pdf                        [📥 Download] │ │
│  │  PDF • 189 KB                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                                                 │
│                                                        [Close]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Payment Status Colors:**
- 🟢 Green = Paid
- 🟡 Yellow = Pending
- 🔴 Red = Refunded

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
    └─→ Event Entries Page
            │
            ├─→ Filter by Activity
            ├─→ Search by Name
            ├─→ Download Excel Export
            └─→ View Entry Details Dialog
                    │
                    └─→ Download Files
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

