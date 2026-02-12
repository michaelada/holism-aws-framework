# Organisation Admin System - Requirements

## 1. Overview

### 1.1 Purpose
Create a capability-driven organisation administration system that allows organisation administrators to manage various aspects of their organisation based on enabled capabilities.

### 1.2 Application Branding
- **Application Name**: ItsPlainSailing
- **Small Logo**: https://itsplainsailing.com/admin//logos/ips-logo-sails-transparent-64.png
- **Large Logo**: https://itsplainsailing.com/admin/logos/ips-logo-sails-darker-text-transparent-128.png
- All UI components and documentation should reference ItsPlainSailing branding

### 1.3 Scope
- Organisation Administrator UI (orgadmin) - capability-based modular interface
- Account User UI (accountuser) - for regular organisation members (future phase)
- Backend services supporting both interfaces
- Integration with existing organisation, role, and capability management
- AWS CloudFront CDN deployment for orgadmin UI
- AWS S3 storage for file uploads

### 1.4 Key Principles
- **Capability-Driven**: UI modules only appear if organisation has the capability enabled
- **Modular Architecture**: Each functional area is a separate workspace package
- **Card-Based Navigation**: Landing page shows available areas as interactive cards
- **URL-Based Routing**: Each area has unique URL prefix for clear separation
- **Reusable Components**: Leverage existing form, wizard, and table components
- **Role-Based Access**: Uses existing organisation roles and permissions

## 2. User Stories

### 2.1 Organisation Administrator Authentication

**As an** organisation administrator  
**I want to** log in to the organisation admin portal  
**So that** I can manage my organisation's settings and features

**Acceptance Criteria:**
- 2.1.1 User authenticates via Keycloak
- 2.1.2 System identifies user as organisation administrator
- 2.1.3 System loads user's organisation details
- 2.1.4 System fetches organisation's enabled capabilities
- 2.1.5 System fetches user's assigned roles and permissions
- 2.1.6 Non-admin users are denied access to orgadmin interface

### 2.2 Dashboard/Landing Page

**As an** organisation administrator  
**I want to** see a dashboard with cards for each available area  
**So that** I can quickly navigate to the functionality I need

**Acceptance Criteria:**
- 2.2.1 Landing page displays cards for all available areas
- 2.2.2 Cards show title, description, and icon
- 2.2.3 Only areas with enabled capabilities are shown
- 2.2.4 Core areas (Forms, Settings, Payments, Reporting, Users) always visible
- 2.2.5 Cards are clickable and navigate to respective areas
- 2.2.6 Visual indication of which areas are available vs unavailable

### 2.3 Event Management (Capability: event-management)

**As an** organisation administrator  
**I want to** manage events and activities  
**So that** people can register and pay for events online

**Context:**
An event is any activity for which you would like to allow people to take part. Examples include:
- Competition Day - organizing competitions with online entry
- Training Sessions - special training requiring online applications
- Camp Week - running camps with online registration
- Club BBQ - yearly events with online ticket sales
- Ticketed Events - events with QR code tickets and scanning capability
- Other Activities - flexible system for various organizational activities

An event must have at least one Event Activity before it is fully set up. Event Activities represent different categories within an event (e.g., age categories, competence levels, ticket types).

**Acceptance Criteria:**
- 2.3.1 Only visible if organisation has 'event-management' capability
- 2.3.2 Can create, edit, and delete events with comprehensive attributes
- 2.3.3 Can add multiple activities to events with detailed configuration
- 2.3.4 Can set pricing and payment options per activity
- 2.3.5 Can view and manage event entries in tabular format
- 2.3.6 Can download all entries as formatted Excel file with separate tables per activity
- 2.3.7 Can drill down to view full entry details including all form fields
- 2.3.8 Routes use `/orgadmin/events/*` prefix
- 2.3.9 Event must have at least one activity before being considered complete
- 2.3.10 Automatic email notifications sent to entrants and specified email addresses

**Event Attributes:**
- **Event Name** - Name as it appears to members on public website (required)
- **Description** - Detailed event information including start time, location, parking, etc. (required)
- **Event Owner** - Defaults to logged-in org admin user who creates the event, can be changed when editing (required)
- **Email Notifications** - Comma-separated email addresses that receive notifications when someone enters the event (optional). Entrants automatically receive confirmation emails.
- **Event Start Date** - The start date for when the event takes place (required)
- **Event End Date** - Defaults to start date, can be set to future date for multi-day events (required)
- **Open Date Entries** - Date and time before which people may not submit entries. Event is listed but marked as "Entries Not Open" until this date/time (optional)
- **Entries Closing Date** - Date and time when entries automatically close. Important to select time as default is midnight at start of date (optional)
- **Limit Number Of Event Entries** - Yes/No toggle. If Yes, displays Event Entries Limit field for maximum entries across all activities (optional)
- **Event Entries Limit** - Maximum number of entries allowed across all event activities (conditional on Limit Number Of Event Entries = Yes)
- **Add Message To Confirmation Email** - Yes/No toggle. If Yes, displays Confirmation Email Message field (optional)
- **Confirmation Email Message** - Custom text to include in confirmation emails sent to entrants (conditional on Add Message To Confirmation Email = Yes)

**Event Activity Attributes:**
- **Name** - Activity name as it appears to members on public website (e.g., "Under 12s", "Open", "Family Ticket") (required)
- **Description** - Detailed description of this specific activity (optional)
- **Show Publicly** - Yes/No toggle to show/hide this activity from account users (required, defaults to Yes)
- **Application Form** - Select from application forms created in Form Builder. If needed form doesn't exist, org admin must create it in Form Builder first (required)
- **Limit Number of Applicants** - Yes/No toggle. If Yes, displays Application Limit field. When limit reached, entries close automatically regardless of event closing date (optional)
- **Application Limit** - Maximum number of applicants for this activity (conditional on Limit Number of Applicants = Yes)
- **Allow Specify Quantity** - Yes/No toggle. If Yes, application form includes Quantity field (up to 10). Multiple quantities result in multiple items in shopping cart from single form submission (optional, defaults to No)
- **Use Terms and Conditions** - Yes/No toggle. If Yes, displays Terms and Conditions editor. Entrants must check agreement box before submitting (optional)
- **Terms and Conditions** - Rich text editor for T&Cs with formatting (bullets, paragraphs, titles). Displayed to users who must agree before entry (conditional on Use Terms and Conditions = Yes)
- **Fee** - Entry fee for this activity. Use 0.00 for free activities (required, defaults to 0.00)
- **Allowed Payment Method** - Options: Card, Cheque/Offline, or Both. If organization not activated for card payments, only Cheque/Offline available (required if Fee > 0)
- **Handling Fee Included** - Yes/No toggle for card payments. Indicates if card handling charge is included in fee or added on top (conditional on Allowed Payment Method includes Card)
- **Cheque/Offline Payment Instructions** - Text describing payment method (who to make cheque to, where to send, bank transfer IBAN, etc.). Automatically included in confirmation email (conditional on Allowed Payment Method includes Cheque/Offline)

**Event Entries Management:**
- **Tabular View** - Display all entries for an event with the following:
  - **Columns**: Event Activity, First Name, Last Name, Entry Date/Time, Actions (drill-down button)
  - **Filters Above Table**: 
    - Event Activity dropdown filter
    - Name search field (searches against entered names)
  - **Download Button**: "Download All Entries" button (top right above table)
- **Excel Export** - Formatted spreadsheet with separate table for each Event Activity, includes all entry details
- **Entry Details View** - Drill-down shows all field values from the application form submission, including:
  - All form fields based on the application form assigned to the Event Activity
  - Payment status and method
  - Uploaded files with download links (for document_upload fields)

### 2.4 Membership Management (Capability: memberships)

**As an** organisation administrator  
**I want to** manage membership types and members  
**So that** people can sign up and pay for membership online

**Context:**
The Membership functionality allows organisations to define membership forms, configure membership types (Adult, Family, Child, etc.), and manage their members database. Members can apply and pay for membership online, with applications tracked through a comprehensive members database.

**Sub-Areas:**
- **Members Database**: Central repository of all member records with advanced filtering, search, batch operations, and Excel export
- **Membership Types**: Configuration of single and group membership types with flexible pricing, terms, and payment options

**Acceptance Criteria:**
- 2.4.1 Only visible if organisation has 'memberships' capability
- 2.4.2 Can create, edit, and delete membership types (both single and group types)
- 2.4.3 Can configure membership pricing, duration, and payment methods
- 2.4.4 Can view and manage members in comprehensive database with filtering
- 2.4.5 Can manage member renewals and status changes
- 2.4.6 Can perform batch operations (mark processed, add/remove labels)
- 2.4.7 Can create custom filter sets for member searches
- 2.4.8 Can export member data to Excel based on active filters
- 2.4.9 Routes use `/orgadmin/members/*` prefix
- 2.4.10 Supports both rolling and fixed-period memberships
- 2.4.11 Automatic status updates for expired memberships (nightly job)

**Membership Type Configuration:**

**Single Membership Type Attributes:**
- **Name** - Display name for this membership type (e.g., "Adult Membership", "Child Membership") (required)
- **Description** - Detailed description displayed to members when choosing membership (required)
- **Membership Form** - Application form from Form Builder defining required fields (required)
- **Membership Status** - Open (accepting applications) or Closed (visible but not accepting) (required, defaults to Open)
- **Is Rolling Membership** - Toggle between fixed-period and rolling membership (required, defaults to No)
  - **No**: Fixed period membership with specific end date
  - **Yes**: Rolling membership valid for specified number of months from payment date
- **Valid Until** - End date for fixed-period memberships (conditional on Is Rolling Membership = No)
- **Number Of Months** - Duration in months for rolling memberships (conditional on Is Rolling Membership = Yes)
- **Automatically Approve Application** - Toggle to auto-approve or require manual review (required, defaults to No)
  - **No**: New applications marked as "Pending" status requiring manual approval
  - **Yes**: New applications automatically marked as "Active" status
- **Add Member Labels** - Optional tags/labels automatically assigned to members using this type (optional)
- **Supported Payment Methods** - One or more payment methods from Payments module (required)
  - Default: "Pay Offline" (manual payment outside system)
  - Optional: Card payments via Stripe (if activated in Payments module)
  - Architecture supports pluggable payment providers
- **Use Terms and Conditions** - Toggle to include T&Cs in application form (optional, defaults to No)
- **Terms and Conditions** - Rich text T&Cs with formatting (bullets, paragraphs, titles) (conditional on Use Terms and Conditions = Yes)

**Group Membership Type Attributes:**
All Single Membership Type fields plus:
- **Maximum Number of People** - Maximum people allowed in group application (required)
- **Minimum Number of People** - Minimum people required in group application (required)
- **Person Titles** - Optional custom titles for each person slot (e.g., "Father/Guardian One", "Mother/Second Guardian", "Child 1") (optional)
- **Person Labels** - Optional labels/tags for each person slot in the group (optional)
- **Field Configuration** - For each field in the membership form:
  - **(a) Common to all people**: Field entered once, value applies to all group members
  - **(b) Unique for each person**: Field entered separately for each group member
  - Example: Contact Number might be (a) common, while Date of Birth is (b) unique

**Members Database Features:**

**Tabular View Columns:**
- **Membership Type** - The membership type used for application
- **First Name** - Member's first name
- **Last Name** - Member's last name
- **Membership Number** - Auto-generated unique identifier
- **Date Last Renewed** - Date of most recent application or renewal
- **Status** - Active, Pending, or Elapsed
- **Valid Until** - Membership expiry date (may be past for Elapsed members)
- **Labels** - Tags/labels assigned to this member
- **Processed Status** - Boolean flag indicating if record has been reviewed/processed
- **Actions** - View, Edit, Mark Processed/Unprocessed buttons

**Default Filter Buttons:**
- **Current** (default): Shows Active and Pending members only
- **Elapsed**: Shows Elapsed members only
- **All**: Shows all members regardless of status

**Custom Filter Sets:**
Users can create named filter sets with:
- **Name** - Display name for the filter (required)
- **Member Status** - Multi-select: Active, Pending, Elapsed (optional)
- **Date Last Renewed Filter** - Date range filter:
  - Before specific date
  - After specific date
  - Between two dates
- **Valid Until Filter** - Date range filter:
  - Before specific date
  - After specific date
  - Between two dates
- **Member Labels Filter** - Multi-select from available labels (optional)

**Batch Operations:**
- **Mark Processed**: Select multiple rows, mark all as processed in one action
- **Mark Unprocessed**: Select multiple rows, mark all as unprocessed in one action
- **Add Labels**: Select multiple rows, add one or more labels to all selected members
- **Remove Labels**: Select multiple rows, remove one or more labels from all selected members

**Excel Export:**
- Export all member data matching current filter
- Includes all fields from membership application forms
- Separate sheets or tables for different membership types
- Formatted for easy analysis and reporting

**Member Detail View:**
- Display all field values from membership application form
- Show payment status and method
- Display uploaded files with download links (for document_upload fields)
- Edit capability for admin users
- Status change controls (Pending → Active, Active → Elapsed, etc.)
- Label management (add/remove labels)
- Processed status toggle

**Automatic Status Management:**
- Nightly automated job runs at midnight
- Checks all Active members with Valid Until date in the past
- Automatically changes status from Active to Elapsed
- Ensures membership database stays current without manual intervention

### 2.5 Merchandise Management (Capability: merchandise)

**As an** organisation administrator  
**I want to** manage merchandise items  
**So that** people can purchase organisation merchandise

**Context:**
The Merchandise functionality allows organisations to sell branded items, equipment, and other products to their members. The system supports flexible configuration including product variants (sizes, packs), optional stock management, delivery options, and quantity rules.

**Acceptance Criteria:**
- 2.5.1 Only visible if organisation has 'merchandise' capability
- 2.5.2 Can create, edit, and delete merchandise types
- 2.5.3 Can configure product options (sizes, packs) with individual pricing
- 2.5.4 Can upload multiple product images
- 2.5.5 Can optionally manage stock levels
- 2.5.6 Can configure flexible delivery models (free, paid, quantity-based)
- 2.5.7 Can set order quantity rules and limits
- 2.5.8 Can link application forms for additional information
- 2.5.9 Can view and manage merchandise orders
- 2.5.10 Routes use `/orgadmin/merchandise/*` prefix
- 2.5.11 Automatic email notifications for orders

**Merchandise Type Configuration:**

**Basic Attributes:**
- **Name** - Display name for the merchandise item (e.g., "Club T-Shirt", "Training Equipment Pack") (required)
- **Description** - Detailed description displayed to members, including product details, materials, sizing information (required)
- **Images** - Multiple product images (main image + additional views) uploaded to S3 (required, minimum 1 image)
- **Status** - Active (available for purchase) or Inactive (hidden from members) (required, defaults to Active)

**Options Configuration:**
Merchandise can have multiple option types (e.g., Size, Pack Type) with different pricing:
- **Option Type** - Name of the option category (e.g., "Size", "Pack Type", "Color") (required if options used)
- **Option Values** - List of available choices for this option type (required if options used)
  - Each option value has:
    - **Name** - Display name (e.g., "Small", "Medium", "Large", "6-Pack", "12-Pack")
    - **Price** - Individual price for this option (required)
    - **SKU** - Optional stock keeping unit identifier
- **Multiple Option Types** - Can configure multiple independent option types (e.g., both Size AND Color)
- **Option Combinations** - System generates all possible combinations with calculated total price

**Examples:**
1. T-Shirt with sizes: Small (€20), Medium (€20), Large (€22), XL (€24)
2. Equipment with pack options: Single Item (€15), 6-Pack (€80), 12-Pack (€150)
3. Jersey with size AND color: Size (S/M/L/XL) × Color (Red/Blue/Green) = 12 combinations

**Stock Level Management (Optional):**
- **Track Stock Levels** - Yes/No toggle (optional, defaults to No)
- **Stock Quantity** - If tracking enabled, specify quantity per option value (conditional on Track Stock Levels = Yes)
- **Low Stock Alert** - Threshold for low stock notifications (conditional on Track Stock Levels = Yes)
- **Out of Stock Behavior** - Hide option or show as "Out of Stock" (conditional on Track Stock Levels = Yes)
- **Stock Updates** - Automatic decrement on order, manual adjustment capability

**Delivery Configuration:**
Flexible delivery model supporting various scenarios:
- **Delivery Type** - Options: Free Delivery, Fixed Delivery Fee, Quantity-Based Delivery (required)
  
  **Free Delivery:**
  - No delivery charge regardless of quantity
  
  **Fixed Delivery Fee:**
  - **Delivery Fee** - Single flat fee added to order (required for Fixed type)
  - Applied once per order regardless of quantity
  
  **Quantity-Based Delivery:**
  - **Delivery Rules** - List of quantity ranges with associated fees (required for Quantity-Based type)
  - Each rule specifies:
    - **Min Quantity** - Minimum items in order
    - **Max Quantity** - Maximum items in order (optional, blank = no upper limit)
    - **Delivery Fee** - Fee for this quantity range
  - Example rules:
    - 1-5 items: €5 delivery
    - 6-10 items: €8 delivery
    - 11+ items: €12 delivery

**Order Quantity Rules:**
- **Minimum Order Quantity** - Minimum items that must be ordered (optional, defaults to 1)
- **Maximum Order Quantity** - Maximum items allowed per order (optional, blank = no limit)
- **Quantity Increments** - Must order in multiples of this number (optional, e.g., "must order in packs of 6")

**Application Form Integration:**
- **Require Application Form** - Yes/No toggle (optional, defaults to No)
- **Application Form** - Select from Form Builder forms (conditional on Require Application Form = Yes)
- **Form Purpose** - Collect additional information like:
  - Custom text/numbers for personalization
  - Size measurements
  - Delivery preferences
  - Special instructions
- **Form Submission** - Linked to order in unified form_submissions table

**Payment Configuration:**
- **Supported Payment Methods** - One or more payment methods from Payments module (required)
  - Default: "Pay Offline" (manual payment outside system)
  - Optional: Card payments via Stripe (if activated in Payments module)
  - Architecture supports pluggable payment providers
- **Use Terms and Conditions** - Toggle to include T&Cs in purchase flow (optional, defaults to No)
- **Terms and Conditions** - Rich text T&Cs with formatting (conditional on Use Terms and Conditions = Yes)

**Order Management:**

**Order Attributes:**
- **Order ID** - Auto-generated unique identifier
- **Customer** - Account user who placed order (name, email)
- **Merchandise Type** - The product ordered
- **Selected Options** - Chosen option values (e.g., Size: Large, Color: Blue)
- **Quantity** - Number of items ordered
- **Unit Price** - Price per item based on selected options
- **Subtotal** - Quantity × Unit Price
- **Delivery Fee** - Calculated based on delivery configuration
- **Total Price** - Subtotal + Delivery Fee
- **Form Submission** - Link to application form data if required
- **Payment Status** - Pending, Paid, Refunded
- **Payment Method** - Card, Offline, etc.
- **Order Status** - Pending, Processing, Shipped, Delivered, Cancelled
- **Order Date** - When order was placed
- **Notes** - Admin notes for order processing

**Orders List View:**
- **Tabular Display** with columns:
  - Order ID
  - Customer Name
  - Merchandise Type
  - Options (e.g., "Large, Blue")
  - Quantity
  - Total Price
  - Payment Status
  - Order Status
  - Order Date
  - Actions (View Details, Update Status)
- **Filters:**
  - Merchandise Type dropdown
  - Payment Status multi-select
  - Order Status multi-select
  - Date range filter
  - Customer name search
- **Batch Operations:**
  - Update order status for multiple orders
  - Export selected orders to Excel
- **Excel Export** - Download all orders matching current filters with full details

**Order Details View:**
- Display all order information
- Show selected options and pricing breakdown
- Display delivery fee calculation
- Show application form submission data if applicable
- Display uploaded files with download links (if form has document_upload fields)
- Order status update controls
- Payment status display
- Admin notes field
- Order history/audit trail

**Email Notifications:**
- **Order Confirmation** - Automatic email to customer when order placed
  - Order details and summary
  - Payment instructions (if offline payment)
  - Expected delivery timeframe
- **Admin Notification** - Email to specified addresses when order received
- **Status Updates** - Optional emails when order status changes (shipped, delivered)
- **Custom Message** - Optional custom text to include in confirmation emails

### 2.6 Calendar Bookings (Capability: calendar-bookings)

**As an** organisation administrator  
**I want to** manage bookable calendars and time slots  
**So that** people can book and pay online for specific timeslots within a calendar

**Context:**
The Calendar Booking functionality allows organisations to manage bookable resources with flexible time slot configurations. Use cases include:
- **Lessons/Classes**: Weekly lessons (e.g., Tuesday and Thursday) with multiple places per session
- **Facility Bookings**: Tennis courts, football pitches, riding arenas, gym facilities
- **Hourly Sessions**: Reservable time slots for various durations and prices
- **Multi-Resource Management**: Multiple calendars for different courts, arenas, or facilities

The system provides maximum flexibility for administrators to define days, times, pricing, capacity, and booking rules while automating the booking and payment process for account users.

**Acceptance Criteria:**
- 2.6.1 Only visible if organisation has 'calendar-bookings' capability
- 2.6.2 Can create, edit, and delete multiple calendars (e.g., Tennis Court 1, Tennis Court 2, Arena A)
- 2.6.3 Can manually open and close calendars through admin area
- 2.6.4 Can automate calendar opening/closing based on specific dates and times
- 2.6.5 Can define flexible time slot configurations with varying durations and prices
- 2.6.6 Can set capacity (places available) per time slot with minimum booking thresholds
- 2.6.7 Can configure booking windows (minimum and maximum days in advance)
- 2.6.8 Can enable/configure cancellation policies with automatic refunds
- 2.6.9 Can block out specific date ranges or time segments
- 2.6.10 Can view and manage bookings in both tabular and calendar views
- 2.6.11 Can filter bookings by calendar, date range, and booking status
- 2.6.12 Routes use `/orgadmin/calendar/*` prefix

**Calendar Configuration Attributes:**

**Basic Information:**
- **Calendar Name** - Display name for the bookable resource (e.g., "Tennis Court 1", "Riding Arena", "Gym Facility") (required)
- **Description** - Detailed information about the resource, location, facilities, rules (required)
- **Display Colour** - Hex colour code for calendar view display to account users (required, defaults to organisation theme colour)
- **Status** - Open (accepting bookings) or Closed (not accepting bookings) (required, defaults to Open)

**Automated Opening/Closing:**
- **Enable Automated Schedule** - Toggle to enable automatic opening/closing (optional, defaults to No)
- **Schedule Rules** - List of date/time rules for automatic status changes (conditional on Enable Automated Schedule = Yes)
  - Each rule specifies: Start Date, End Date, Open/Close action, Time of day
  - Example: "Close calendar from Dec 20 to Jan 5 for winter break"
  - Example: "Open calendar every Monday at 6:00 AM, close at 10:00 PM"

**Booking Window Configuration:**
- **Minimum Days In Advance** - Minimum number of days before a timeslot that bookings are allowed (optional, defaults to 0)
  - When set, account users cannot book timeslots once this threshold is passed
  - Example: Set to 2 means users must book at least 2 days before the timeslot
- **Maximum Days In Advance** - Maximum number of days in the future that bookings are allowed (optional, defaults to 90)
  - Limits how far ahead users can book
  - Example: Set to 30 means users can only book up to 30 days in advance

**Terms and Conditions:**
- **Use Terms and Conditions** - Toggle to require T&C acceptance before booking (optional, defaults to No)
- **Terms and Conditions** - Rich text T&Cs with formatting (conditional on Use Terms and Conditions = Yes)
  - Account users must check agreement box before adding booking to cart

**Payment Configuration:**
- **Supported Payment Methods** - One or more payment methods from Payments module (required)
  - Default: "Pay Offline" (manual payment outside system)
  - Optional: Card payments via Stripe (if activated in Payments module)
  - Architecture supports pluggable payment providers

**Cancellation Policy:**
- **Allow Cancellations** - Toggle to enable self-service cancellations by account users (optional, defaults to No)
  - When No: Users must contact organisation directly to cancel
  - When Yes: Users can cancel bookings themselves online
- **Cancel Days In Advance** - Number of days before timeslot that cancellations are allowed (conditional on Allow Cancellations = Yes, required)
  - System prevents cancellations if remaining time is less than this value
  - Example: Set to 2 means users can only cancel if timeslot is more than 2 days away
- **Refund Payment Automatically** - Toggle to enable automatic refunds on cancellation (conditional on Allow Cancellations = Yes, optional, defaults to No)
  - When Yes: System automatically refunds payment if cancellation is within allowed timeframe
  - When No: Cancellation is processed but refund must be handled manually
- **Cancellation Email** - When Allow Cancellations is enabled, system automatically sends booking confirmation email with:
  - Unique booking reference number
  - Cancellation link that pre-fills booking reference
  - Clear instructions on cancellation policy and deadlines

**Time Slot Configuration:**

The system supports highly flexible time slot definitions:

**Weekly Schedule Template:**
- Define different schedules for different days of the week
- Each day can have multiple time slot configurations
- Example: Monday 9am-5pm, Tuesday 6am-10pm, Wednesday closed, etc.

**Time Slot Attributes:**
- **Day(s) of Week** - Which days this slot configuration applies to (multi-select: Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- **Start Time** - When this slot starts (required)
- **Duration Options** - Multiple duration/price combinations for the same start time (required, at least one)
  - Each option includes:
    - **Duration** - Length of booking (e.g., 30 minutes, 1 hour, 2 hours)
    - **Price** - Cost for this duration (required)
    - **Label** - Display name (e.g., "Half Hour Session", "Full Hour")
  - Example: 9:00 AM slot can offer "30 min for €10" OR "60 min for €15"
- **Places Available** - Number of people/bookings allowed in this timeslot (required, defaults to 1)
  - Set to 1 for exclusive bookings (e.g., tennis court)
  - Set to >1 for group sessions (e.g., 8 places in a class)
- **Minimum Places Required** - Minimum bookings needed before slot is considered "booked" (optional, only relevant if Places Available > 1)
  - Example: 8 places available, minimum 5 required
  - First 4 bookings: slot still shows as "open"
  - 5th booking: slot marked as "booked" (but can still accept up to 8 total)
  - Helps ensure group sessions have minimum viable attendance

**Recurring Pattern:**
- **Effective Date Range** - Start and end dates for this slot configuration (required)
- **Recurrence** - Weekly pattern (every week, every 2 weeks, etc.)

**Blocked Periods:**
- **Block Out Dates** - Specific date ranges when calendar is unavailable (optional)
  - Each block specifies: Start Date, End Date, Reason
  - Example: "Block Dec 25-26 for Christmas holidays"
- **Block Out Times** - Specific time segments within days when slots are unavailable (optional)
  - Each block specifies: Day(s) of week, Start Time, End Time, Reason
  - Example: "Block 12:00-13:00 every day for maintenance"

**Booking Management:**

**Bookings List View (Tabular):**
- **Columns**: Booking Reference, Calendar Name, Account User, Date, Time, Duration, Places Booked, Price, Payment Status, Booking Status, Booked Date, Actions
- **Filters**:
  - Calendar dropdown (all calendars or specific calendar)
  - Date range filter (from date, to date)
  - Booking Status multi-select (Confirmed, Cancelled, Pending Payment)
  - Payment Status multi-select (Paid, Pending, Refunded)
  - Account user name search
- **Actions**:
  - View booking details
  - Cancel booking (with optional refund)
  - Resend confirmation email
  - Export to Excel

**Bookings Calendar View:**
- **Visual Calendar Display**: Month, week, or day view
- **Colour Coding**: Each calendar has its assigned display colour
- **Time Slot Grid**: Shows all available and booked slots
- **Visual Indicators**:
  - Available slots (with places remaining count if >1)
  - Fully booked slots
  - Partially booked slots (for multi-place slots)
  - Blocked periods
- **Click Actions**: Click slot to see booking details or make admin booking
- **Navigation**: Easy switching between calendars, date ranges, and view modes

**Booking Details View:**
- Display all booking information:
  - Booking reference number
  - Calendar name and description
  - Account user details (name, email, phone)
  - Date and time of booking
  - Duration and price
  - Number of places booked (if applicable)
  - Payment status and method
  - Booking status (Confirmed, Cancelled, Pending)
  - Booked date/time
  - Cancellation details (if cancelled): cancelled date, refund status, reason
- Admin actions:
  - Cancel booking with optional refund
  - Modify booking (change date/time if available)
  - Resend confirmation email
  - Add admin notes

**Account User Booking Flow (Context for Admin Configuration):**
When account users book through the accountuser interface:
1. View calendar with available timeslots (colour-coded by calendar)
2. Select desired date and timeslot
3. Choose duration option (if multiple available)
4. Select number of places (if >1 available)
5. Review terms and conditions (if required)
6. Add to cart and proceed to payment
7. Receive confirmation email with booking reference and cancellation link (if enabled)

**Self-Service Cancellation Flow (When Enabled):**
1. Account user clicks cancellation link in confirmation email
2. System pre-fills booking reference
3. User confirms cancellation
4. System validates:
   - Booking reference is correct
   - Cancellation is within allowed timeframe (Cancel Days In Advance)
5. If valid:
   - Booking status changed to "Cancelled"
   - Timeslot becomes available again
   - Automatic refund processed (if Refund Payment Automatically = Yes)
   - Confirmation email sent to user
6. If invalid:
   - Error message explaining why cancellation cannot be processed
   - Instructions to contact organisation directly

**Excel Export:**
- Export all bookings matching current filters
- Includes all booking details and account user information
- Separate sheets or tables for different calendars
- Formatted for easy analysis and reporting

**Email Notifications:**
- **Booking Confirmation** - Automatic email to account user when booking is made
  - Booking details and reference number
  - Calendar information and location
  - Payment confirmation
  - Cancellation link and policy (if cancellations enabled)
- **Admin Notification** - Optional email to specified addresses when booking is made
- **Cancellation Confirmation** - Automatic email when booking is cancelled
  - Cancellation confirmation
  - Refund details (if applicable)
- **Reminder Emails** - Optional automated reminders before booked timeslot

**Note:** This comprehensive calendar booking system provides maximum flexibility for various use cases while maintaining ease of use for administrators and account users.


### 2.7 Registration Management (Capability: registrations)

**As an** organisation administrator  
**I want to** manage entity registrations  
**So that** account users can register and pay for entities like horses, boats, equipment, etc.

**Context:**
The Registration functionality allows organisations to manage registrations for entities (non-person items) that require annual or periodic registration. Unlike Memberships which are for people, Registrations are for things like:
- Horse registration
- Boat registration
- Equipment registration
- Vehicle registration
- Any other entity requiring periodic registration and payment

**Sub-Areas:**
- **Registration Types**: Configuration of different registration types with flexible pricing, terms, and payment options
- **Registration Database**: Central repository of all registration records with advanced filtering, search, batch operations, and Excel export

**Acceptance Criteria:**
- 2.7.1 Only visible if organisation has 'registrations' capability
- 2.7.2 Can create, edit, and delete registration types
- 2.7.3 Can configure registration pricing, duration (fixed or rolling), and payment methods
- 2.7.4 Can define registration forms for collecting entity information
- 2.7.5 Can view and manage registrations in comprehensive database with filtering
- 2.7.6 Can manage registration renewals and status changes
- 2.7.7 Can perform batch operations (mark processed, add/remove labels)
- 2.7.8 Can create custom filter sets for registration searches
- 2.7.9 Can export registration data to Excel based on active filters
- 2.7.10 Routes use `/orgadmin/registrations/*` prefix
- 2.7.11 Supports both rolling and fixed-period registrations
- 2.7.12 Automatic status updates for expired registrations (nightly job)

**Registration Type Configuration:**

**Registration Type Attributes:**
- **Name** - Display name for this registration type (e.g., "2026 Horse Registration", "Annual Boat Registration") (required)
- **Description** - Detailed description displayed to account users when choosing registration (required)
- **Entity Name** - Display name of the thing being registered (e.g., "Horse", "Boat", "Equipment") (required)
  - This name is used throughout the UI to refer to the registered entity
  - Example: "Register your Horse", "Boat Details", "Equipment Information"
- **Registration Form** - Application form from Form Builder defining required fields for the entity (required)
- **Registration Status** - Open (accepting applications) or Closed (visible but not accepting) (required, defaults to Open)
- **Is Rolling Registration** - Toggle between fixed-period and rolling registration (required, defaults to No)
  - **No**: Fixed period registration with specific end date
  - **Yes**: Rolling registration valid for specified number of months from payment date
- **Valid Until** - End date for fixed-period registrations (conditional on Is Rolling Registration = No)
- **Number Of Months** - Duration in months for rolling registrations (conditional on Is Rolling Registration = Yes)
- **Automatically Approve Application** - Toggle to auto-approve or require manual review (required, defaults to No)
  - **No**: New applications marked as "Pending" status requiring manual approval
  - **Yes**: New applications automatically marked as "Active" status
- **Add Registration Labels** - Optional tags/labels automatically assigned to registrations using this type (optional)
- **Supported Payment Methods** - One or more payment methods from Payments module (required)
  - Default: "Pay Offline" (manual payment outside system)
  - Optional: Card payments via Stripe (if activated in Payments module)
  - Architecture supports pluggable payment providers
- **Use Terms and Conditions** - Toggle to include T&Cs in application form (optional, defaults to No)
- **Terms and Conditions** - Rich text T&Cs with formatting (bullets, paragraphs, titles) (conditional on Use Terms and Conditions = Yes)

**Registration Database Features:**

**Tabular View Columns:**
- **Registration Type** - The registration type used for application
- **Entity Name** - Name/identifier of the registered entity (e.g., horse name, boat name)
- **Registration Number** - Auto-generated unique identifier
- **Owner Name** - Name of the account user who owns this registration
- **Date Last Renewed** - Date of most recent application or renewal
- **Status** - Active, Pending, or Elapsed
- **Valid Until** - Registration expiry date (may be past for Elapsed registrations)
- **Labels** - Tags/labels assigned to this registration
- **Processed Status** - Boolean flag indicating if record has been reviewed/processed
- **Actions** - View, Edit, Mark Processed/Unprocessed buttons

**Default Filter Buttons:**
- **Current** (default): Shows Active and Pending registrations only
- **Elapsed**: Shows Elapsed registrations only
- **All**: Shows all registrations regardless of status

**Custom Filter Sets:**
Users can create named filter sets with:
- **Name** - Display name for the filter (required)
- **Registration Status** - Multi-select: Active, Pending, Elapsed (optional)
- **Date Last Renewed Filter** - Date range filter:
  - Before specific date
  - After specific date
  - Between two dates
- **Valid Until Filter** - Date range filter:
  - Before specific date
  - After specific date
  - Between two dates
- **Registration Labels Filter** - Multi-select from available labels (optional)
- **Registration Type Filter** - Multi-select from available registration types (optional)

**Batch Operations:**
- **Mark Processed**: Select multiple rows, mark all as processed in one action
- **Mark Unprocessed**: Select multiple rows, mark all as unprocessed in one action
- **Add Labels**: Select multiple rows, add one or more labels to all selected registrations
- **Remove Labels**: Select multiple rows, remove one or more labels from all selected registrations

**Excel Export:**
- Export all registration data matching current filter
- Includes all fields from registration application forms
- Separate sheets or tables for different registration types
- Formatted for easy analysis and reporting

**Registration Detail View:**
- Display all field values from registration application form
- Show registration type, number, status, dates
- Display entity name and details
- Show payment status and method
- Display uploaded files with download links (for document_upload fields)
- Status change controls (Pending → Active, Active → Elapsed, etc.)
- Label management (add/remove labels)
- Processed status toggle
- Edit capability for admin users

**Automatic Status Management:**
- Nightly automated job runs at midnight
- Checks all Active registrations with Valid Until date in the past
- Automatically changes status from Active to Elapsed
- Ensures registration database stays current without manual intervention

**Key Differences from Memberships:**
- Registrations are for entities (things), not people
- Entity Name field identifies what is being registered
- No group registrations (each entity is registered individually)
- No person-specific fields or configurations
- Simpler data model focused on entity tracking

### 2.8 Event Ticketing (Capability: event-ticketing)

**As an** organisation administrator  
**I want to** manage electronic tickets for events with QR code validation  
**So that** people can receive tickets automatically and I can control access to events

**Context:**
Event Ticketing allows organisations to issue electronic tickets for events with unique QR codes. The system automatically generates and emails tickets when bookings are made, and provides a real-time ticketing dashboard to track issued and scanned tickets. A separate mobile scanning app (out of scope for this project) validates tickets at event entry.

**Key Features:**
- **Easy Setup**: Enable ticketing by setting "Generate Electronic Tickets" to Yes on any event
- **Automatic Generation**: System generates electronic tickets and emails them automatically on booking
- **Customizable Tickets**: Edit ticket text content to personalize for each event
- **QR Code Validation**: Each ticket includes unique QR code for entry validation
- **Scanning App**: Mobile app (separate project) scans QR codes to validate tickets
- **Real-Time Dashboard**: Track all tickets (issued and scanned) in real-time during and after events

**Acceptance Criteria:**
- 2.8.1 Only visible if organisation has 'event-ticketing' capability
- 2.8.2 Can enable electronic ticketing on any event via "Generate Electronic Tickets" toggle
- 2.8.3 System automatically generates unique tickets with QR codes when bookings are made
- 2.8.4 System automatically emails tickets to customers on booking confirmation
- 2.8.5 Can customize ticket text content per event (header, footer, instructions)
- 2.8.6 Can view ticketing dashboard showing all issued tickets with status
- 2.8.7 Dashboard displays real-time scan status (issued, scanned, not scanned)
- 2.8.8 Can filter tickets by event, event activity, scan status, date range
- 2.8.9 Can search tickets by customer name or ticket reference
- 2.8.10 Can export ticket data to Excel for reporting
- 2.8.11 Can manually mark tickets as scanned/unscanned if needed
- 2.8.12 Routes use `/orgadmin/tickets/*` prefix
- 2.8.13 Ticket QR codes are unique and secure (UUID-based)
- 2.8.14 Tickets display event details, customer info, and QR code
- 2.8.15 System tracks scan timestamp and location (via scanning app)

**Event Configuration for Ticketing:**

When editing an event, administrators can enable ticketing with these settings:

**Generate Electronic Tickets** - Yes/No toggle (required)
- **No**: Event operates normally without electronic tickets
- **Yes**: System generates electronic tickets for all bookings, displays ticket settings section

**Ticket Settings** (conditional on Generate Electronic Tickets = Yes):
- **Ticket Header Text** - Text displayed at top of ticket (optional)
  - Example: "Welcome to [Event Name]"
  - Supports basic formatting and event placeholders
- **Ticket Instructions** - Instructions for ticket holders (optional)
  - Example: "Please present this QR code at the entrance. Arrive 15 minutes early."
  - Displayed prominently on ticket
- **Ticket Footer Text** - Text displayed at bottom of ticket (optional)
  - Example: "Thank you for your support! Contact us at [email]"
  - Supports contact information and disclaimers
- **Ticket Validity Period** - How long before event start tickets become valid (optional)
  - Example: "Valid from 2 hours before event start"
  - Prevents early entry if desired

**Automatic Ticket Generation:**

When Generate Electronic Tickets is enabled:
1. **On Booking Confirmation**: System automatically generates ticket for each booking
2. **Unique QR Code**: Each ticket receives unique UUID-based QR code
3. **Ticket Details**: Ticket includes:
   - Event name and date/time
   - Event activity (if applicable)
   - Customer name and email
   - Booking reference
   - Unique ticket reference
   - QR code (large, scannable)
   - Custom header, instructions, and footer text
   - Ticket validity information
4. **Automatic Email**: Ticket PDF automatically attached to booking confirmation email
5. **Multiple Tickets**: If booking includes multiple people/quantities, generates separate ticket for each

**Ticketing Dashboard:**

**Dashboard View:**
- **Summary Cards** at top:
  - Total Tickets Issued
  - Tickets Scanned (with percentage)
  - Tickets Not Scanned
  - Last Scan Time (real-time update)
- **Tabular View** with columns:
  - Ticket Reference (unique ID)
  - Event Name
  - Event Activity (if applicable)
  - Customer Name
  - Customer Email
  - Issue Date/Time
  - Scan Status (Not Scanned / Scanned)
  - Scan Date/Time (if scanned)
  - Actions (View Ticket, Mark Scanned/Unscanned)

**Filters Above Table:**
- **Event** dropdown - Filter by specific event
- **Event Activity** dropdown - Filter by activity within event
- **Scan Status** multi-select - Not Scanned, Scanned
- **Date Range** - Filter by issue date or scan date
- **Search** field - Search by customer name, email, or ticket reference

**Batch Operations:**
- **Mark as Scanned**: Select multiple tickets, mark all as scanned
- **Mark as Not Scanned**: Select multiple tickets, reset scan status
- **Export to Excel**: Download all tickets matching current filters

**Real-Time Updates:**
- Dashboard automatically refreshes when tickets are scanned via mobile app
- Shows live scan count during event
- Displays most recent scan activity
- Useful for monitoring event entry in real-time

**Ticket Details View:**
- Display full ticket information
- Show QR code
- Display scan history (if scanned multiple times)
- Show booking details link
- Manual scan status controls
- Resend ticket email button
- Download ticket PDF button

**Integration with Events Module:**
- Ticketing settings appear in event edit form when capability enabled
- Ticket generation triggers on event booking confirmation
- Tickets link to event entries in Events module
- Event capacity tracking includes ticket counts

**Scanning App Integration (Out of Scope):**
The mobile scanning app is a separate project that:
- Authenticates org admin users
- Scans QR codes using device camera
- Validates tickets against backend API
- Marks tickets as scanned with timestamp
- Works offline with sync capability
- Provides scan statistics

**Note:** This specification covers the web-based ticketing management interface only. The mobile scanning app is a separate project and not included in this implementation.

### 2.9 Form Builder (Core - Always Available)

**As an** organisation administrator  
**I want to** design custom application forms  
**So that** I can collect specific information for events, memberships, etc.

**Acceptance Criteria:**
- 2.9.1 Always available to all organisation administrators
- 2.9.2 Can create, edit, and delete application forms using the same UI patterns as object definitions
- 2.9.3 Can add various field types (text, email, number, select, checkbox, date, document_upload)
- 2.9.4 Can set field validation rules for each field
- 2.9.5 Can organize fields into groups for better UI organization
- 2.9.6 Can configure multi-step wizards for complex forms
- 2.9.7 Forms can be linked to events, memberships, registrations, calendar bookings, and merchandise
- 2.9.8 Routes use `/orgadmin/forms/*` prefix
- 2.9.9 Application forms stored in separate database tables from object definitions
- 2.9.10 Form submissions use a unified data model across all contexts

**UI Approach - Reuse Existing Patterns:**
- Application Form = Object Definition (conceptually the same)
- Application Field = Field Definition (same field types and validation)
- Reuse MetadataForm and MetadataWizard components
- Reuse FieldRenderer for displaying fields
- Reuse field grouping UI for organized forms
- Reuse wizard configuration UI for multi-step forms

**Document Upload Field Type:**
- Field type: "document_upload"
- Files stored in AWS S3 bucket
- Subdirectory structure: `/organization-id/form-id/field-id/filename`
- Ensures organization data segregation
- Supports multiple file types (PDF, images, documents)
- File size validation and security checks

**Separate Database Tables:**
- `application_forms` table (similar to `object_definitions`)
- `application_fields` table (similar to `field_definitions`, includes "document_upload" datatype)
- `application_form_fields` table (similar to `object_fields`)
- Tables have same structure as metadata tables but dedicated to application forms

**Unified Submission Data Model:**
- Single `form_submissions` table stores ALL submissions across contexts
- `submission_type` field distinguishes: event_entry, membership_application, calendar_booking, merchandise_order, registration
- `context_id` field links to specific context (event_id, membership_type_id, calendar_id, merchandise_item_id, registration_type_id)
- Variable form data stored in JSONB column for flexibility
- Separate `form_submission_files` table tracks uploaded files with S3 links

**Note:** Detailed form builder UI implementation and advanced features (conditional logic, calculated fields, etc.) will be specified in future iterations. Initial implementation focuses on basic form creation with field grouping and wizard support.

### 2.10 Settings Management (Core - Always Available)

**As an** organisation administrator  
**I want to** manage organisation settings  
**So that** I can configure how my organisation operates

**Acceptance Criteria:**
- 2.10.1 Always available to all organisation administrators
- 2.10.2 Can update organisation details
- 2.10.3 Can configure payment settings
- 2.10.4 Can manage email templates
- 2.10.5 Can set branding (logo, colours)
- 2.10.6 Routes use `/orgadmin/settings/*` prefix

### 2.11 Payment Management (Core - Always Available)

**As an** organisation administrator  
**I want to** view and manage payments  
**So that** I can track revenue and process refunds

**Acceptance Criteria:**
- 2.11.1 Always available to all organisation administrators
- 2.11.2 Can view all payments (Stripe, etc.)
- 2.11.3 Can view lodgements
- 2.11.4 Can request refunds
- 2.11.5 Can export payment data
- 2.11.6 Routes use `/orgadmin/payments/*` prefix

### 2.12 Reporting (Core - Always Available)

**As an** organisation administrator  
**I want to** view reports and analytics  
**So that** I can understand my organisation's performance

**Acceptance Criteria:**
- 2.12.1 Always available to all organisation administrators
- 2.12.2 Shows high-level dashboard metrics (events, members, revenue)
- 2.12.3 Can generate specific reports
- 2.12.4 Can export reports to CSV/PDF
- 2.12.5 Can filter reports by date range
- 2.12.6 Routes use `/orgadmin/reporting/*` prefix

### 2.13 User Management (Core - Always Available)

**As an** organisation administrator  
**I want to** manage users for my organisation  
**So that** I can control access to different interfaces

**Acceptance Criteria:**
- 2.13.1 Always available to all organisation administrators
- 2.13.2 Two distinct user management areas:
  - **Org Admin Users**: Administrators who access orgadmin UI
  - **Account Users**: Organization members who access accountuser UI (future)
- 2.13.3 Can view all org admin users for the organisation
- 2.13.4 Can create, edit, and delete org admin users
- 2.13.5 Can assign roles to org admin users
- 2.13.6 Can view all account users for the organisation
- 2.13.7 Account users can: enter events, purchase merchandise, make bookings, register items
- 2.13.8 Uses existing backend user management services
- 2.13.9 Routes use `/orgadmin/users/*` prefix

**User Type Distinction:**
- **Org Admin Users**: Access orgadmin UI, manage organization settings, configure modules
- **Account Users**: Access accountuser UI (future), participate in events, make purchases, book resources

## 3. Technical Requirements

### 3.1 Architecture

**3.1.1 Workspace Structure**
- Each functional area is a separate npm workspace package
- Shell package orchestrates all modules
- Shared components in existing `packages/components`
- Single backend in `packages/backend`

**3.1.2 Module Registration**
- Each module exports registration metadata
- Includes capability requirement, routes, navigation info, title, and description
- Title and description used on dashboard cards
- Shell dynamically loads modules based on capabilities

**3.1.3 Routing**
- Base URL: `/orgadmin`
- Each area has unique prefix: `/orgadmin/{area}/*`
- Lazy loading for performance

### 3.2 Authentication & Authorization

**3.2.1 Authentication**
- Keycloak-based authentication
- User must be in organisation's admin group
- Session management

**3.2.2 Authorization**
- Capability-based access control
- Role-based permissions within modules
- Backend API endpoints protected by capability checks

### 3.3 Data Model

**3.3.1 Existing Models (Reuse)**
- Organisation
- OrganisationType
- Capability
- OrganizationUser
- OrganizationAdminRole

**3.3.2 New Models (To Be Defined)**
- Event, EventActivity, EventEntry
- MembershipType, Member
- MerchandiseItem, MerchandiseOrder
- Calendar, Booking
- RegistrationType, Registration
- TicketedEvent, Ticket
- ApplicationForm, ApplicationField, ApplicationFormField (separate from object definitions)
- FormSubmission (unified across all contexts), FormSubmissionFile
- Payment, Refund
- Report
- OrgAdminUser, AccountUser

### 3.4 UI/UX Requirements

**3.4.1 Responsive Design**
- Mobile-first approach
- Works on tablets and desktops
- Touch-friendly interactions

**3.4.2 Consistent Theme**
- Uses existing neumorphic theme
- Material-UI components
- Consistent colour scheme and typography

**3.4.3 Accessibility**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support

### 3.5 Testing Requirements

**3.5.1 Unit Tests**
- All services have unit tests
- All components have unit tests
- Minimum 80% code coverage

**3.5.2 Integration Tests**
- Module integration tests
- API integration tests

**3.5.3 End-to-End Tests**
- Critical user journeys
- Cross-module workflows

### 3.6 Performance Requirements

**3.6.1 Load Time**
- Initial page load < 3 seconds
- Module lazy loading < 1 second
- API responses < 500ms

**3.6.2 Bundle Size**
- Shell bundle < 200KB
- Module bundles < 150KB each
- Code splitting for optimal loading

**3.6.3 CDN Delivery**
- OrgAdmin UI deployed via AWS CloudFront CDN
- Global edge locations for low latency
- Automatic HTTPS and caching
- Gzip/Brotli compression enabled

## 4. Non-Functional Requirements

### 4.1 Security
- All API endpoints require authentication
- Capability checks on all protected routes
- Input validation and sanitisation
- XSS and CSRF protection
- S3 bucket security with organization-level access control
- Secure file upload validation and virus scanning

### 4.2 Scalability
- Support 1000+ organisations
- Support 100+ concurrent users per organisation
- Efficient database queries with indexing

### 4.3 Maintainability
- Clear code structure and documentation
- Consistent coding standards
- Comprehensive error handling
- Logging and monitoring

### 4.4 Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Node.js 18+
- PostgreSQL 14+

## 5. Constraints

### 5.1 Technical Constraints
- Must use existing backend package
- Must integrate with Keycloak
- Must use existing organisation/capability model
- Must reuse existing components where possible

### 5.2 Timeline Constraints
- Phased delivery approach
- Shell and core modules first
- Capability modules incrementally

### 5.3 Resource Constraints
- Single development team
- Existing infrastructure
- Budget for third-party services (Stripe, etc.)

## 6. Assumptions

- Keycloak is properly configured
- Organisation and capability management is functional
- Payment processor (Stripe) integration will be handled separately
- Email service is available for notifications
- AWS S3 bucket is configured for file storage
- AWS CloudFront distribution is configured for UI delivery
- Terraform infrastructure is available for AWS resource management

## 7. Dependencies

- Existing organisation management system
- Keycloak authentication
- PostgreSQL database
- Existing components package
- Material-UI library
- React Router
- Axios for API calls
- AWS S3 SDK for file uploads
- AWS CloudFront for CDN delivery
- Terraform for infrastructure as code

## 8. Future Considerations

### 8.1 Account User Interface
- Separate interface for non-admin users
- Public-facing pages for events, memberships, etc.
- Shopping cart and checkout flow
- User profile management

### 8.2 Mobile Apps
- React Native mobile apps
- Native iOS/Android apps
- Offline capability

### 8.3 Advanced Features
- Multi-language support
- Advanced reporting and analytics
- Integration with third-party services
- Automated marketing campaigns
