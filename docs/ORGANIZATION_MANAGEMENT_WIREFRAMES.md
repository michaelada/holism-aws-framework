# Organization Management UI Wireframes

## Screen 1: Organization Types List

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Dashboard | Organization Types | System Settings                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Organization Types                          [+ Create Organization Type]│
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Name              Currency  Language  Organizations  Status  Actions ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Swimming Clubs    USD       English   12             Active  [Edit]  ││
│  │                                                              [View]  ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Tennis Clubs      USD       English   8              Active  [Edit]  ││
│  │                                                              [View]  ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Riding Clubs      GBP       English   5              Active  [Edit]  ││
│  │                                                              [View]  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 2: Create/Edit Organization Type

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Organization Types > Create Organization Type                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Create Organization Type                                                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Basic Information                                                    ││
│  │                                                                      ││
│  │ Name *                                                               ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ swimming-clubs                                                   │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Display Name *                                                       ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ Swimming Clubs                                                   │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Description                                                          ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ Organizations focused on swimming activities and competitions    │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Currency *          Language *                                       ││
│  │ ┌──────────────┐    ┌──────────────┐                               ││
│  │ │ USD       ▼ │    │ English   ▼ │                               ││
│  │ └──────────────┘    └──────────────┘                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Default Capabilities                                                 ││
│  │                                                                      ││
│  │ Core Services                                                        ││
│  │ ☑ Event Management        ☑ Memberships                            ││
│  │ ☐ Merchandise             ☑ Calendar Bookings                      ││
│  │ ☐ Registrations                                                     ││
│  │                                                                      ││
│  │ Additional Features                                                  ││
│  │ ☑ Discounts               ☐ Document Uploads                       ││
│  │ ☑ Event Ticketing         ☑ Payment Processing                     ││
│  │ ☐ Email Notifications     ☐ SMS Notifications                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  [Cancel]                                              [Save]            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 3: Organization Type Details (Organizations Tab)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Organization Types > Swimming Clubs                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Swimming Clubs                                                [Edit Type]│
│  Currency: USD | Language: English | 12 Organizations                   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [Overview] [Organizations] [Default Capabilities]                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Organizations                                    [+ Add Organization]   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Name                Status  Capabilities  Admin Users  Created       ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Aquatic Center      Active  5/8          3            2024-01-15    ││
│  │ North                                                    [Edit][View]││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ City Swim Club      Active  8/8          5            2024-02-01    ││
│  │                                                          [Edit][View]││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Metro Aquatics      Inactive 3/8         1            2024-01-20    ││
│  │                                                          [Edit][View]││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Filter: [All ▼] [Active] [Inactive] [Blocked]                          │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 4: Create/Edit Organization

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Organization Types > Swimming Clubs > Organizations > Create            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Create Organization                                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Basic Information                                                    ││
│  │                                                                      ││
│  │ Organization Name *                                                  ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ aquatic-center-north                                             │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Display Name *                                                       ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ Aquatic Center North                                             │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Domain (Optional)                                                    ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ aquatic-north.example.com                                        │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Status *                                                             ││
│  │ ┌──────────────┐                                                    ││
│  │ │ Active    ▼ │                                                    ││
│  │ └──────────────┘                                                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Capabilities                                                         ││
│  │                                                                      ││
│  │ Select capabilities for this organization                            ││
│  │ (Defaults from Swimming Clubs organization type)                    ││
│  │                                                                      ││
│  │ Core Services                                                        ││
│  │ ☑ Event Management        [Default]                                 ││
│  │ ☑ Memberships             [Default]                                 ││
│  │ ☐ Merchandise                                                       ││
│  │ ☑ Calendar Bookings       [Default]                                 ││
│  │ ☐ Registrations                                                     ││
│  │                                                                      ││
│  │ Additional Features                                                  ││
│  │ ☑ Discounts               [Default]                                 ││
│  │ ☐ Document Uploads                                                  ││
│  │ ☐ Event Ticketing         [Default] (Deselected)                   ││
│  │ ☑ Payment Processing      [Default]                                 ││
│  │ ☐ Email Notifications                                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  [Cancel]                                              [Save]            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 5: Organization Details (Admin Users Tab)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Organization Types > Swimming Clubs > Aquatic Center North              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Aquatic Center North                                      [Edit Org]    │
│  Status: Active | 3 Admin Users | 45 Account Users                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [Overview] [Capabilities] [Admin Users] [Account Users]             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Admin Users                                      [+ Add Admin User]     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Name            Email                Role          Status  Last Login││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ John Doe        admin@aquatic.com   Full Admin    Active  2024-02-09││
│  │                                                    [Edit] [Reset PW] ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Jane Smith      jane@aquatic.com    Event Manager Active  2024-02-08││
│  │                                                    [Edit] [Reset PW] ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Bob Johnson     bob@aquatic.com     Membership    Active  2024-02-05││
│  │                                     Manager        [Edit] [Reset PW] ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 6: Add/Edit Organization Admin User

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Org Types > Swimming Clubs > Aquatic Center North > Admin Users > Add  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Add Organization Admin User                                             │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ User Information                                                     ││
│  │                                                                      ││
│  │ Email Address * (used for login)                                    ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ newadmin@aquatic.com                                             │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ First Name *                Last Name *                              ││
│  │ ┌────────────────────┐      ┌────────────────────┐                 ││
│  │ │ Sarah              │      │ Williams           │                 ││
│  │ └────────────────────┘      └────────────────────┘                 ││
│  │                                                                      ││
│  │ Status                                                               ││
│  │ ┌──────────────┐                                                    ││
│  │ │ Active    ▼ │                                                    ││
│  │ └──────────────┘                                                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Role & Permissions                                                   ││
│  │                                                                      ││
│  │ Organization Admin Role *                                            ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ ○ Full Admin (all capabilities)                                  │││
│  │ │ ○ Event Manager (events only)                                    │││
│  │ │ ○ Membership Manager (memberships only)                          │││
│  │ │ ● Custom (select specific capabilities)                          │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ Capability Permissions (Custom Role)                                 ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │ Capability          None   Read   Write  Admin                   │││
│  │ │ Event Management     ○      ○      ○      ●                      │││
│  │ │ Memberships          ○      ○      ●      ○                      │││
│  │ │ Calendar Bookings    ○      ●      ○      ○                      │││
│  │ │ Discounts            ○      ○      ●      ○                      │││
│  │ │ Payment Processing   ○      ●      ○      ○                      │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Account Setup                                                        ││
│  │                                                                      ││
│  │ Temporary Password (leave blank to auto-generate)                   ││
│  │ ┌──────────────────────────────────────────────────────────────────┐││
│  │ │                                                                  │││
│  │ └──────────────────────────────────────────────────────────────────┘││
│  │                                                                      ││
│  │ ☑ Send welcome email with login instructions                        ││
│  │ ☑ Require password change on first login                            ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  [Cancel]                                    [Save & Send Invite]        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 7: Organization Details (Capabilities Tab)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Organization Types > Swimming Clubs > Aquatic Center North              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Aquatic Center North                                      [Edit Org]    │
│  Status: Active | 3 Admin Users | 45 Account Users                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [Overview] [Capabilities] [Admin Users] [Account Users]             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Enabled Capabilities                                                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Core Services                                                        ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Event Management                                    [ON]  ●  │   ││
│  │ │ Manage events, activities, and registrations                 │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Memberships                                         [ON]  ●  │   ││
│  │ │ Manage membership types and subscriptions                    │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Merchandise                                         [OFF] ○  │   ││
│  │ │ Sell merchandise and club gear online                        │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Calendar Bookings                                   [ON]  ●  │   ││
│  │ │ Time slot booking and facility management                    │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Registrations                                       [OFF] ○  │   ││
│  │ │ Custom registration forms and submissions                    │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Additional Features                                                  ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Discounts                                           [ON]  ●  │   ││
│  │ │ Create discount codes and promotional offers                 │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Document Uploads                                    [OFF] ○  │   ││
│  │ │ Allow file uploads and document management                   │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Event Ticketing                                     [OFF] ○  │   ││
│  │ │ Generate and manage event tickets                            │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  │                                                                      ││
│  │ ┌──────────────────────────────────────────────────────────────┐   ││
│  │ │ Payment Processing                                  [ON]  ●  │   ││
│  │ │ Accept online payments and manage transactions               │   ││
│  │ └──────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  [Cancel]                                              [Save Changes]    │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Screen 8: Organization Details (Account Users Tab - Read Only)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin Portal                                    [User Menu ▼] [Logout]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Organization Types > Swimming Clubs > Aquatic Center North              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Aquatic Center North                                      [Edit Org]    │
│  Status: Active | 3 Admin Users | 45 Account Users                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [Overview] [Capabilities] [Admin Users] [Account Users]             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Account Users (Read Only)                                               │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ℹ Account users are managed by Organization Administrators          ││
│  │   through their organization portal.                                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Summary Statistics                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                      ││
│  │  Total Account Users:        45                                      ││
│  │  Active Users:               42                                      ││
│  │  Inactive Users:             3                                       ││
│  │  Users Added This Month:     7                                       ││
│  │  Last User Added:            2024-02-09                              ││
│  │                                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Recent Account Users (Last 10)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Name              Email                    Status    Joined          ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Alice Cooper      alice@example.com       Active    2024-02-09      ││
│  │ Tom Brady         tom@example.com          Active    2024-02-08      ││
│  │ Sarah Johnson     sarah@example.com        Active    2024-02-07      ││
│  │ Mike Wilson       mike@example.com         Active    2024-02-05      ││
│  │ ...                                                                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Note: For full account user management, organization administrators     │
│  should use their organization portal.                                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Library

### Capability Toggle Card
```
┌──────────────────────────────────────────────────────────┐
│ Event Management                            [ON]  ●      │
│ Manage events, activities, and registrations             │
└──────────────────────────────────────────────────────────┘
```

### Status Badge
```
[Active]  [Inactive]  [Blocked]
```

### Breadcrumb Navigation
```
Organization Types > Swimming Clubs > Organizations > Aquatic Center North
```

### Permission Level Radio Group
```
Capability          None   Read   Write  Admin
Event Management     ○      ○      ○      ●
```

### Default Indicator
```
☑ Event Management        [Default]
```

---

## Responsive Considerations

- Tables collapse to cards on mobile
- Forms stack vertically on smaller screens
- Navigation becomes hamburger menu on mobile
- Capability toggles remain full-width
- Action buttons stack vertically on mobile

---

## Accessibility Notes

- All forms have proper labels and ARIA attributes
- Keyboard navigation supported throughout
- Color contrast meets WCAG AA standards
- Screen reader friendly
- Focus indicators visible
- Error messages clearly associated with fields
