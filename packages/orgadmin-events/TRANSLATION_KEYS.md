# Events Module Translation Keys Reference

This document lists all translation keys used in the Events module following the naming convention: `events.{feature}.{element}`

## Common Keys (Shared across modules)

### Actions
- `common.actions.save` - Save button
- `common.actions.cancel` - Cancel button
- `common.actions.delete` - Delete button
- `common.actions.edit` - Edit button
- `common.actions.create` - Create button
- `common.actions.search` - Search button
- `common.actions.filter` - Filter button
- `common.actions.close` - Close button
- `common.actions.back` - Back button
- `common.actions.next` - Next button
- `common.actions.view` - View button
- `common.actions.download` - Download button
- `common.actions.add` - Add button

### Status
- `common.status.draft` - Draft status
- `common.status.published` - Published status
- `common.status.cancelled` - Cancelled status
- `common.status.completed` - Completed status
- `common.status.paid` - Paid status
- `common.status.pending` - Pending status
- `common.status.refunded` - Refunded status

### Labels
- `common.labels.all` - All filter option
- `common.labels.unlimited` - Unlimited label
- `common.labels.max` - Max label
- `common.labels.free` - Free label
- `common.labels.enabled` - Enabled label
- `common.labels.disabled` - Disabled label
- `common.labels.entries` - Entries label
- `common.labels.activity` - Activity (singular)
- `common.labels.activities` - Activities (plural)
- `common.labels.configured` - Configured label

### Messages
- `common.messages.loading` - Loading message
- `common.messages.noData` - No data message

## Events Module Keys

### Main Page (EventsListPage)
- `events.title` - Page title "Events"
- `events.createEvent` - Create event button
- `events.searchPlaceholder` - Search input placeholder
- `events.noEventsFound` - Empty state message
- `events.noMatchingEvents` - No results message
- `events.loadingEvents` - Loading state message
- `events.failedToLoad` - Error loading events

### Table Headers
- `events.table.eventName` - Event Name column
- `events.table.dates` - Dates column
- `events.table.status` - Status column
- `events.table.entryLimit` - Entry Limit column
- `events.table.actions` - Actions column

### Tooltips
- `events.tooltips.viewEntries` - View Entries tooltip
- `events.tooltips.viewDetails` - View Details tooltip
- `events.tooltips.edit` - Edit tooltip

### Create/Edit Event Page (CreateEventPage)
- `events.createEvent` - Create Event title
- `events.editEvent` - Edit Event title
- `events.failedToSave` - Error saving event
- `events.fixValidationErrors` - Validation error message

### Wizard Steps
- `events.wizard.steps.basicInfo` - Basic Information step
- `events.wizard.steps.eventDates` - Event Dates step
- `events.wizard.steps.ticketingSettings` - Ticketing Settings step
- `events.wizard.steps.activities` - Activities step
- `events.wizard.steps.reviewConfirm` - Review & Confirm step

### Basic Information Section
- `events.basicInfo.title` - Section title
- `events.basicInfo.description` - Section description
- `events.basicInfo.eventName` - Event Name field label
- `events.basicInfo.eventNameHelper` - Event Name helper text
- `events.basicInfo.eventNameTooltip` - Event Name tooltip
- `events.basicInfo.eventDescription` - Description field label
- `events.basicInfo.eventDescriptionHelper` - Description helper text
- `events.basicInfo.eventDescriptionTooltip` - Description tooltip
- `events.basicInfo.emailNotifications` - Email Notifications field label
- `events.basicInfo.emailNotificationsHelper` - Email Notifications helper text
- `events.basicInfo.emailNotificationsTooltip` - Email Notifications tooltip
- `events.basicInfo.limitEntries` - Limit Entries checkbox label
- `events.basicInfo.limitEntriesTooltip` - Limit Entries tooltip
- `events.basicInfo.entriesLimit` - Entries Limit field label
- `events.basicInfo.entriesLimitHelper` - Entries Limit helper text
- `events.basicInfo.entriesLimitTooltip` - Entries Limit tooltip
- `events.basicInfo.addConfirmationMessage` - Add Confirmation Message checkbox label
- `events.basicInfo.addConfirmationMessageTooltip` - Add Confirmation Message tooltip
- `events.basicInfo.confirmationMessage` - Confirmation Message field label
- `events.basicInfo.confirmationMessageHelper` - Confirmation Message helper text
- `events.basicInfo.confirmationMessageTooltip` - Confirmation Message tooltip
- `events.basicInfo.validation.nameRequired` - Name required validation
- `events.basicInfo.validation.descriptionRequired` - Description required validation

### Event Dates Section
- `events.dates.title` - Section title
- `events.dates.description` - Section description
- `events.dates.startDate` - Start Date field label
- `events.dates.startDateTooltip` - Start Date tooltip
- `events.dates.endDate` - End Date field label
- `events.dates.endDateHelper` - End Date helper text
- `events.dates.endDateTooltip` - End Date tooltip
- `events.dates.openDateEntries` - Open Date Entries field label
- `events.dates.openDateEntriesHelper` - Open Date Entries helper text
- `events.dates.openDateEntriesTooltip` - Open Date Entries tooltip
- `events.dates.entriesClosingDate` - Entries Closing Date field label
- `events.dates.entriesClosingDateHelper` - Entries Closing Date helper text
- `events.dates.entriesClosingDateTooltip` - Entries Closing Date tooltip

### Ticketing Section
- `events.ticketing.title` - Section title
- `events.ticketing.description` - Section description
- `events.ticketing.generateTickets` - Generate Tickets checkbox label
- `events.ticketing.generateTicketsHelper` - Generate Tickets helper text
- `events.ticketing.generateTicketsTooltip` - Generate Tickets tooltip
- `events.ticketing.headerText` - Header Text field label
- `events.ticketing.headerTextHelper` - Header Text helper text
- `events.ticketing.headerTextTooltip` - Header Text tooltip
- `events.ticketing.instructions` - Instructions field label
- `events.ticketing.instructionsHelper` - Instructions helper text
- `events.ticketing.instructionsTooltip` - Instructions tooltip
- `events.ticketing.footerText` - Footer Text field label
- `events.ticketing.footerTextHelper` - Footer Text helper text
- `events.ticketing.footerTextTooltip` - Footer Text tooltip
- `events.ticketing.validityPeriod` - Validity Period field label
- `events.ticketing.validityPeriodHelper` - Validity Period helper text
- `events.ticketing.validityPeriodTooltip` - Validity Period tooltip
- `events.ticketing.backgroundColor` - Background Color field label
- `events.ticketing.backgroundColorHelper` - Background Color helper text
- `events.ticketing.backgroundColorTooltip` - Background Color tooltip
- `events.ticketing.includeLogo` - Include Logo checkbox label
- `events.ticketing.includeLogoHelper` - Include Logo helper text
- `events.ticketing.includeLogoTooltip` - Include Logo tooltip

### Activities Section
- `events.activities.title` - Section title
- `events.activities.description` - Section description
- `events.activities.addActivity` - Add Activity button
- `events.activities.noActivities` - No activities message
- `events.activities.validation.atLeastOne` - At least one activity required validation

### Activity Form (EventActivityForm)
- `events.activities.activity.untitled` - Untitled Activity label
- `events.activities.activity.activityNumber` - Activity number label (with interpolation)
- `events.activities.activity.name` - Activity Name field label
- `events.activities.activity.nameHelper` - Activity Name helper text
- `events.activities.activity.description` - Description field label
- `events.activities.activity.descriptionHelper` - Description helper text
- `events.activities.activity.showPublicly` - Show Publicly checkbox label
- `events.activities.activity.applicationForm` - Application Form field label
- `events.activities.activity.selectForm` - Select form placeholder
- `events.activities.activity.loadingForms` - Loading forms message
- `events.activities.activity.limitApplicants` - Limit Applicants checkbox label
- `events.activities.activity.applicantsLimit` - Applicants Limit field label
- `events.activities.activity.applicantsLimitHelper` - Applicants Limit helper text
- `events.activities.activity.allowSpecifyQuantity` - Allow Specify Quantity checkbox label
- `events.activities.activity.useTermsAndConditions` - Use Terms and Conditions checkbox label
- `events.activities.activity.termsAndConditions` - Terms and Conditions field label
- `events.activities.activity.fee` - Fee field label
- `events.activities.activity.feeHelper` - Fee helper text
- `events.activities.activity.allowedPaymentMethod` - Allowed Payment Method field label
- `events.activities.activity.paymentMethods.card` - Card Only option
- `events.activities.activity.paymentMethods.cheque` - Cheque/Offline Only option
- `events.activities.activity.paymentMethods.both` - Both option
- `events.activities.activity.handlingFeeIncluded` - Handling Fee Included checkbox label
- `events.activities.activity.chequePaymentInstructions` - Cheque Payment Instructions field label
- `events.activities.activity.chequePaymentInstructionsHelper` - Cheque Payment Instructions helper text

### Review & Confirm Section
- `events.review.title` - Section title
- `events.review.description` - Section description
- `events.review.basicInfo` - Basic Info subsection title
- `events.review.eventName` - Event Name label
- `events.review.description` - Description label
- `events.review.emailNotifications` - Email Notifications label
- `events.review.entryLimit` - Entry Limit label
- `events.review.eventDates` - Event Dates subsection title
- `events.review.eventPeriod` - Event Period label
- `events.review.entriesOpen` - Entries Open label
- `events.review.entriesClose` - Entries Close label
- `events.review.ticketing` - Ticketing subsection title
- `events.review.electronicTickets` - Electronic Tickets label
- `events.review.activities` - Activities subsection title
- `events.review.activitiesConfigured` - Activities configured label (with interpolation)

### Actions
- `events.actions.saveAsDraft` - Save as Draft button
- `events.actions.publishEvent` - Publish Event button

### Entry Details Dialog (EventEntryDetailsDialog)
- `events.entryDetails.title` - Dialog title
- `events.entryDetails.firstName` - First Name label
- `events.entryDetails.lastName` - Last Name label
- `events.entryDetails.email` - Email label
- `events.entryDetails.quantity` - Quantity label
- `events.entryDetails.paymentStatus` - Payment Status label
- `events.entryDetails.paymentMethod` - Payment Method label
- `events.entryDetails.entryDate` - Entry Date label
- `events.entryDetails.formSubmission` - Form Submission Data section title
- `events.entryDetails.loadingSubmission` - Loading submission message
- `events.entryDetails.uploadedFiles` - Uploaded Files section title

## Translation Key Naming Convention

All keys follow the pattern: `events.{feature}.{element}`

- **events** - Module namespace
- **{feature}** - Feature area (e.g., basicInfo, dates, ticketing, activities, review, entryDetails)
- **{element}** - Specific UI element (e.g., title, description, field labels, helper text, tooltips)

## Interpolation

Some keys support interpolation for dynamic values:
- `events.activities.activity.activityNumber` - Uses `{{number}}` placeholder
- `events.review.activitiesConfigured` - Uses `{{count}}` and `{{type}}` placeholders
