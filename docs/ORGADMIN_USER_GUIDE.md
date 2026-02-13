# ItsPlainSailing OrgAdmin - User Guide

## Welcome to ItsPlainSailing

ItsPlainSailing is a comprehensive organization administration system that helps you manage events, memberships, merchandise, bookings, registrations, and more. This guide will help you get started and make the most of the system.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Core Modules](#core-modules)
4. [Capability Modules](#capability-modules)
5. [Common Tasks](#common-tasks)
6. [Tips and Best Practices](#tips-and-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Logging In

1. Navigate to your organization's OrgAdmin URL:
   ```
   https://yourdomain.com/orgadmin
   ```

2. Click "Sign In" button

3. Enter your credentials in the Keycloak login page

4. You'll be redirected to the ItsPlainSailing dashboard

### First Time Setup

After logging in for the first time:

1. **Review Organization Settings**
   - Click "Settings" in the navigation menu
   - Verify organization details
   - Configure payment settings if needed

2. **Explore Available Modules**
   - The dashboard shows all modules available to your organization
   - Modules are displayed as cards with icons and descriptions

3. **Set Up Your Profile**
   - Click your name in the top right
   - Update your profile information
   - Configure notification preferences

---

## Dashboard Overview

The dashboard is your home base in ItsPlainSailing. It provides:

### Navigation

- **Top Bar**: Organization name, user menu, logout
- **Side Menu**: Quick access to all modules
- **Dashboard Cards**: Visual overview of available modules

### Module Cards

Each card shows:
- **Icon**: Visual identifier for the module
- **Title**: Module name
- **Description**: What the module does
- **Click to Access**: Click anywhere on the card to open the module

### Available Modules

Modules you see depend on your organization's enabled capabilities:

**Core Modules** (Always Available):
- Dashboard
- Forms (Form Builder)
- Settings
- Payments
- Reporting
- Users

**Capability Modules** (If Enabled):
- Events
- Memberships
- Merchandise
- Calendar Bookings
- Registrations
- Event Ticketing

---

## Core Modules

### Form Builder

Create custom application forms for events, memberships, and more.

**Key Features**:
- Drag-and-drop field builder
- Multiple field types (text, email, number, date, file upload, etc.)
- Field validation rules
- Multi-step wizards
- Field grouping

**How to Create a Form**:

1. Navigate to **Forms** module
2. Click **"Create Form"** button
3. Enter form name and description
4. Add fields:
   - Click **"Add Field"**
   - Select field type
   - Configure field properties
   - Set validation rules
5. Organize fields into groups (optional)
6. Configure wizard steps (optional)
7. Click **"Save"** or **"Publish"**

**Field Types**:
- **Text**: Single-line text input
- **Email**: Email address with validation
- **Number**: Numeric input
- **Select**: Dropdown menu
- **Checkbox**: Yes/no or multiple choices
- **Date**: Date picker
- **Document Upload**: File upload (PDF, images, documents)

### Settings

Manage your organization's configuration.

**Tabs**:

1. **Organization Details**
   - Name, address, contact information
   - Currency and language settings
   - Time zone

2. **Payment Settings**
   - Stripe configuration
   - Payment methods
   - Currency settings

3. **Email Templates**
   - Customize email notifications
   - Add organization branding
   - Configure sender information

4. **Branding**
   - Upload organization logo
   - Set theme colors
   - Preview branding

**How to Update Settings**:

1. Navigate to **Settings** module
2. Select the appropriate tab
3. Make your changes
4. Click **"Save"** button
5. Changes take effect immediately

### Payments

View and manage all payments and transactions.

**Features**:
- View all payments
- Filter by date, status, type
- Process refunds
- Export to Excel
- View lodgements

**How to Process a Refund**:

1. Navigate to **Payments** module
2. Find the payment to refund
3. Click **"View Details"**
4. Click **"Refund"** button
5. Enter refund amount (full or partial)
6. Add refund reason
7. Click **"Process Refund"**
8. Confirmation email sent automatically

### Reporting

Generate reports and view analytics.

**Available Reports**:
- Dashboard metrics (overview)
- Events report (attendance, revenue)
- Members report (growth, retention)
- Revenue report (breakdown by source)

**How to Generate a Report**:

1. Navigate to **Reporting** module
2. Select report type
3. Set date range
4. Apply filters (optional)
5. Click **"Generate Report"**
6. View charts and tables
7. Click **"Export"** to download (CSV/PDF)

### Users

Manage organization administrators and account users.

**User Types**:

1. **Org Admin Users**
   - Access OrgAdmin interface
   - Manage organization settings
   - Configure modules

2. **Account Users**
   - Access AccountUser interface (future)
   - Participate in events
   - Make purchases and bookings

**How to Invite an Admin User**:

1. Navigate to **Users** module
2. Click **"Org Admin Users"** tab
3. Click **"Invite Admin User"** button
4. Enter email address
5. Select roles to assign
6. Click **"Send Invitation"**
7. User receives email with setup link

---

## Capability Modules

### Events

Manage events and activities for your organization.

**Key Concepts**:
- **Event**: The main event (e.g., "Annual Competition")
- **Activity**: Categories within an event (e.g., "Under 12s", "Open")
- **Entry**: A participant's registration for an activity

**How to Create an Event**:

1. Navigate to **Events** module
2. Click **"Create Event"** button
3. Fill in event details:
   - Event name and description
   - Start and end dates
   - Entry opening and closing dates
   - Email notifications
4. Add activities:
   - Click **"Add Activity"**
   - Enter activity name and description
   - Select application form
   - Set pricing and payment options
   - Configure terms and conditions
5. Click **"Save as Draft"** or **"Publish"**

**Managing Entries**:

1. Open the event
2. Click **"View Entries"** tab
3. Filter by activity or search by name
4. Click entry to view full details
5. Download all entries to Excel

### Memberships

Manage membership types and member database.

**Membership Types**:
- **Single**: Individual memberships
- **Group**: Family or group memberships

**How to Create a Membership Type**:

1. Navigate to **Memberships** module
2. Click **"Membership Types"** tab
3. Click **"Create Membership Type"**
4. Select type (Single or Group)
5. Fill in details:
   - Name and description
   - Membership form
   - Duration (fixed or rolling)
   - Pricing and payment methods
   - Terms and conditions
6. For group memberships:
   - Set min/max people
   - Configure person titles
   - Set field configuration (common vs unique)
7. Click **"Save and Publish"**

**Managing Members**:

1. Click **"Members Database"** tab
2. Use filters:
   - Current (default)
   - Elapsed
   - Custom filters
3. Search by name
4. Select members for batch operations:
   - Mark processed/unprocessed
   - Add/remove labels
5. Export to Excel

### Merchandise

Sell branded items and products.

**How to Create a Merchandise Item**:

1. Navigate to **Merchandise** module
2. Click **"Create Merchandise Type"**
3. Fill in basic information:
   - Name and description
   - Upload images
   - Set status (Active/Inactive)
4. Configure options:
   - Add option types (Size, Color, etc.)
   - Add option values with prices
5. Configure stock management (optional):
   - Enable stock tracking
   - Set quantities per option
   - Set low stock alerts
6. Configure delivery:
   - Select delivery type (Free/Fixed/Quantity-based)
   - Set delivery fees
7. Set order quantity rules
8. Link application form (optional)
9. Configure payment and T&Cs
10. Click **"Save and Publish"**

**Managing Orders**:

1. Click **"Orders"** tab
2. Filter by merchandise type, status, date
3. View order details
4. Update order status
5. Export to Excel

### Calendar Bookings

Manage bookable resources and time slots.

**How to Create a Calendar**:

1. Navigate to **Calendar** module
2. Click **"Create Calendar"**
3. Fill in basic information:
   - Calendar name and description
   - Display color
   - Status (Open/Closed)
4. Configure booking window:
   - Min/max days in advance
5. Add time slot configurations:
   - Select days of week
   - Set start time
   - Add duration options with prices
   - Set capacity (places available)
6. Add blocked periods (optional):
   - Block specific dates
   - Block time segments
7. Configure cancellation policy
8. Set payment methods and T&Cs
9. Click **"Save and Publish"**

**Managing Bookings**:

1. View bookings in table or calendar view
2. Filter by calendar, date, status
3. Cancel bookings with optional refund
4. Resend confirmation emails
5. Export to Excel

### Registrations

Register entities like horses, boats, equipment.

**How to Create a Registration Type**:

1. Navigate to **Registrations** module
2. Click **"Create Registration Type"**
3. Fill in details:
   - Name and description
   - Entity name (e.g., "Horse", "Boat")
   - Registration form
   - Duration (fixed or rolling)
   - Pricing and payment methods
4. Click **"Save and Publish"**

**Managing Registrations**:

1. Click **"Registrations Database"** tab
2. Filter by status, type, labels
3. Search by entity name or owner
4. Batch operations available
5. Export to Excel

### Event Ticketing

Generate and manage electronic tickets with QR codes.

**How to Enable Ticketing for an Event**:

1. Navigate to **Events** module
2. Open or create an event
3. Toggle **"Generate Electronic Tickets"** to Yes
4. Configure ticket settings:
   - Header text
   - Instructions
   - Footer text
5. Save the event
6. Tickets automatically generated for all bookings

**Managing Tickets**:

1. Navigate to **Ticketing** module
2. View ticketing dashboard:
   - Total issued
   - Scanned/not scanned
   - Last scan time
3. Filter by event, activity, status
4. Manually mark tickets as scanned/unscanned
5. Export to Excel

---

## Common Tasks

### Creating a New Event

1. Forms → Create application form for event entries
2. Events → Create event with activities
3. Link application form to each activity
4. Set pricing and payment options
5. Publish event
6. Monitor entries in real-time

### Setting Up Memberships

1. Forms → Create membership application form
2. Memberships → Create membership type
3. Link application form
4. Configure pricing and duration
5. Publish membership type
6. Manage members in database

### Processing Payments

1. Payments → View all payments
2. Filter by date or status
3. Click payment to view details
4. Process refund if needed
5. Export payment data for accounting

### Generating Reports

1. Reporting → Select report type
2. Set date range
3. Apply filters
4. View charts and data
5. Export to CSV or PDF

### Managing Users

1. Users → Org Admin Users tab
2. Invite new admin users
3. Assign roles
4. Manage existing users
5. Deactivate users when needed

---

## Tips and Best Practices

### Forms

- **Use Clear Field Labels**: Make it obvious what information is needed
- **Add Help Text**: Provide examples or instructions for complex fields
- **Group Related Fields**: Use field groups for better organization
- **Test Forms**: Submit a test entry before publishing
- **Use Validation**: Prevent invalid data with validation rules

### Events

- **Set Clear Dates**: Specify when entries open and close
- **Limit Entries**: Use entry limits to manage capacity
- **Multiple Activities**: Break events into logical categories
- **Email Notifications**: Add admin emails to receive entry notifications
- **Test Payment Flow**: Make a test entry to verify payment works

### Memberships

- **Clear Descriptions**: Explain what each membership type includes
- **Use Labels**: Tag members for easy filtering and communication
- **Regular Reviews**: Check for expired memberships regularly
- **Batch Operations**: Use batch operations for efficiency
- **Custom Filters**: Create filters for common searches

### Merchandise

- **Quality Images**: Upload clear product images
- **Accurate Stock**: Keep stock levels updated
- **Clear Options**: Use descriptive option names (e.g., "Small (Youth)", "Large (Adult)")
- **Delivery Fees**: Set realistic delivery fees
- **Test Orders**: Place a test order to verify the flow

### Calendar Bookings

- **Clear Names**: Use descriptive calendar names
- **Color Coding**: Assign distinct colors to each calendar
- **Block Maintenance**: Block out maintenance periods in advance
- **Cancellation Policy**: Set clear cancellation rules
- **Reminder Emails**: Enable reminder emails for bookings

### General

- **Regular Backups**: Export data regularly for backup
- **Monitor Payments**: Check payment status daily
- **Respond Promptly**: Reply to user inquiries quickly
- **Update Settings**: Keep organization details current
- **Train Staff**: Ensure all admins know how to use the system

---

## Troubleshooting

### Login Issues

**Problem**: Can't log in

**Solutions**:
1. Check username and password
2. Try password reset
3. Verify you have org-admin role
4. Clear browser cache and cookies
5. Try a different browser
6. Contact system administrator

### Module Not Visible

**Problem**: Expected module doesn't appear on dashboard

**Solutions**:
1. Check if capability is enabled for your organization
2. Verify you have appropriate role
3. Refresh the page
4. Log out and log back in
5. Contact system administrator

### Form Not Saving

**Problem**: Changes to form not saving

**Solutions**:
1. Check for validation errors (red text)
2. Ensure all required fields are filled
3. Check internet connection
4. Try saving again
5. Copy your work and refresh the page
6. Contact support if issue persists

### Payment Issues

**Problem**: Payment not processing

**Solutions**:
1. Verify Stripe is configured in Settings
2. Check payment method is enabled
3. Verify card details are correct
4. Check for sufficient funds
5. Try a different payment method
6. Contact payment support

### File Upload Issues

**Problem**: Can't upload files

**Solutions**:
1. Check file size (max 10MB typically)
2. Verify file type is allowed
3. Check internet connection
4. Try a different file
5. Try a different browser
6. Contact support if issue persists

### Export Not Working

**Problem**: Excel export fails

**Solutions**:
1. Check if data exists to export
2. Try smaller date range
3. Check browser pop-up blocker
4. Try a different browser
5. Clear browser cache
6. Contact support if issue persists

### Slow Performance

**Problem**: System is slow

**Solutions**:
1. Check internet connection
2. Close unnecessary browser tabs
3. Clear browser cache
4. Try a different browser
5. Check if issue is widespread
6. Contact support if issue persists

### Email Not Received

**Problem**: Confirmation emails not arriving

**Solutions**:
1. Check spam/junk folder
2. Verify email address is correct
3. Add sender to safe senders list
4. Check email settings in Settings module
5. Wait a few minutes (emails can be delayed)
6. Contact support if issue persists

---

## Getting Help

### In-App Help

- Look for **?** icons throughout the interface
- Hover over field labels for tooltips
- Check validation messages for guidance

### Documentation

- User Guide (this document)
- [Deployment Guide](./ORGADMIN_DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

### Support Channels

- **Email**: support@itsplainsailing.com
- **Help Desk**: https://support.itsplainsailing.com
- **Phone**: Available during business hours

### Reporting Issues

When reporting an issue, include:
1. What you were trying to do
2. What happened instead
3. Error messages (if any)
4. Screenshots (if helpful)
5. Browser and operating system
6. Steps to reproduce the issue

---

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save current form
- **Ctrl/Cmd + K**: Open search
- **Esc**: Close dialog/modal
- **Tab**: Navigate between fields
- **Enter**: Submit form (when focused on button)

---

## Glossary

- **Capability**: A feature that can be enabled for an organization
- **Module**: A functional area of the system (Events, Memberships, etc.)
- **Activity**: A category within an event
- **Entry**: A participant's registration
- **Member**: A person with a membership
- **Registration**: An entity (horse, boat, etc.) that is registered
- **Booking**: A reserved time slot on a calendar
- **Ticket**: An electronic ticket with QR code
- **Form**: A custom application form
- **Field**: An input element in a form
- **Validation**: Rules that ensure data is correct
- **Wizard**: A multi-step form
- **Label**: A tag for categorizing records
- **Filter**: Criteria for searching records
- **Batch Operation**: An action performed on multiple records at once

---

## Appendix

### Browser Compatibility

ItsPlainSailing works best with modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile Access

The system is responsive and works on tablets and mobile devices, though some features work best on desktop.

### Accessibility

ItsPlainSailing is designed to be accessible:
- Keyboard navigation supported
- Screen reader compatible
- High contrast mode available
- Adjustable text size

### Data Privacy

Your data is:
- Encrypted in transit (HTTPS)
- Encrypted at rest
- Backed up regularly
- Compliant with GDPR
- Never shared without permission

---

## Feedback

We value your feedback! Help us improve ItsPlainSailing:

- **Feature Requests**: Submit via help desk
- **Bug Reports**: Email support with details
- **Usability Feedback**: Share your experience
- **Documentation**: Suggest improvements

Thank you for using ItsPlainSailing!
