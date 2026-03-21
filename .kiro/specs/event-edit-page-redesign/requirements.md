# Requirements Document

## Introduction

Redesign the event editing experience so that the edit event page displays all wizard sections (Basic Info, Event Dates, Ticketing Settings, Activities, Review & Confirm) as vertically stacked sections on a single scrollable page, rather than using the current multi-step wizard (stepper). The wizard stepper remains unchanged for the create event flow. This gives editors a full overview of the event and faster access to any section they need to modify.

## Glossary

- **Edit_Event_Page**: The page rendered when navigating to `/events/:id/edit`, used to modify an existing event.
- **Create_Event_Page**: The page rendered when navigating to `/events/new`, used to create a new event via the multi-step wizard.
- **Wizard**: The existing MUI Stepper-based multi-step form flow with Next/Back navigation between steps.
- **Section**: A visually distinct, labelled block of form fields corresponding to one wizard step (e.g., Basic Info, Event Dates, Ticketing Settings, Activities).
- **Sidebar_Navigation**: An optional sticky table-of-contents component with anchor links that allow quick jumping to any section on the Edit_Event_Page.
- **Sticky_Save_Bar**: A persistently visible bar containing Save/Cancel actions that remains accessible regardless of scroll position.
- **Section_Header**: A clearly labelled heading (card or divider) that visually separates each section on the Edit_Event_Page.

## Requirements

### Requirement 1: Preserve Wizard for Event Creation

**User Story:** As an event organiser, I want to create events using the existing step-by-step wizard, so that I am guided through each section in order without being overwhelmed.

#### Acceptance Criteria

1. WHEN a user navigates to `/events/new`, THE Create_Event_Page SHALL render the multi-step Wizard with Stepper navigation.
2. THE Create_Event_Page SHALL display the same five steps in the same order: Basic Info, Event Dates, Ticketing Settings, Activities, Review & Confirm.
3. WHEN a user clicks Next on the Create_Event_Page, THE Wizard SHALL validate the current step before advancing to the next step.

### Requirement 2: Single Scrollable Page for Event Editing

**User Story:** As an event organiser, I want to see all event sections on one scrollable page when editing, so that I can quickly review and modify any part of the event without stepping through a wizard.

#### Acceptance Criteria

1. WHEN a user navigates to `/events/:id/edit`, THE Edit_Event_Page SHALL render all form sections vertically stacked on a single scrollable page instead of using the Wizard.
2. THE Edit_Event_Page SHALL display sections in the same order as the Wizard steps: Basic Info, Event Dates, Ticketing Settings, Activities.
3. THE Edit_Event_Page SHALL NOT display the Stepper component or Next/Back step navigation buttons.
4. THE Edit_Event_Page SHALL pre-populate all form fields with the existing event data loaded from the API.

### Requirement 3: Section Headers and Visual Separation

**User Story:** As an event organiser, I want each section to be clearly labelled and visually separated, so that I can easily identify and locate the section I need to edit.

#### Acceptance Criteria

1. THE Edit_Event_Page SHALL render each section inside a distinct MUI Card component with a Section_Header.
2. THE Section_Header SHALL display the section title matching the corresponding Wizard step label (using existing i18n translation keys).
3. THE Edit_Event_Page SHALL include consistent vertical spacing between section cards.

### Requirement 4: Sidebar Navigation for Quick Jumping

**User Story:** As an event organiser, I want a sidebar table-of-contents on the edit page, so that I can jump directly to any section without scrolling manually.

#### Acceptance Criteria

1. THE Edit_Event_Page SHALL render a Sidebar_Navigation component listing all section titles as anchor links.
2. WHEN a user clicks a Sidebar_Navigation link, THE Edit_Event_Page SHALL smooth-scroll to the corresponding section.
3. WHILE a user scrolls the Edit_Event_Page, THE Sidebar_Navigation SHALL visually highlight the currently visible section.
4. THE Sidebar_Navigation SHALL remain fixed in position (sticky) so it is accessible at all scroll positions.
5. WHERE the viewport width is below the medium breakpoint (MUI `md`), THE Edit_Event_Page SHALL hide the Sidebar_Navigation to preserve content space on smaller screens.

### Requirement 5: Sticky Save Bar

**User Story:** As an event organiser, I want Save and Cancel buttons always visible while editing, so that I can save my changes at any point without scrolling to the bottom.

#### Acceptance Criteria

1. THE Edit_Event_Page SHALL render a Sticky_Save_Bar that remains fixed at the bottom of the viewport.
2. THE Sticky_Save_Bar SHALL contain a Cancel button and a Save button (preserving the current save behaviour: Save as Draft and Publish).
3. WHEN a user clicks Save on the Sticky_Save_Bar, THE Edit_Event_Page SHALL validate all sections and submit the complete event data to the API.
4. IF validation fails on any section, THEN THE Edit_Event_Page SHALL scroll to the first section containing errors and display the validation messages.

### Requirement 6: Collapsible Sections

**User Story:** As an event organiser, I want the option to collapse sections I am not currently editing, so that I can reduce visual clutter and focus on the section I need.

#### Acceptance Criteria

1. THE Edit_Event_Page SHALL render each section as a collapsible accordion (expandable/collapsible card).
2. THE Edit_Event_Page SHALL render all sections expanded by default when the page loads.
3. WHEN a user clicks a Section_Header, THE Edit_Event_Page SHALL toggle the collapsed/expanded state of that section.
4. WHILE a section is collapsed, THE Edit_Event_Page SHALL display only the Section_Header for that section.
5. WHEN a Sidebar_Navigation link is clicked for a collapsed section, THE Edit_Event_Page SHALL expand that section before scrolling to it.

### Requirement 7: Shared Form Logic and Data Consistency

**User Story:** As a developer, I want the edit page to reuse the same form components and validation logic as the create wizard, so that behaviour is consistent and maintenance is minimised.

#### Acceptance Criteria

1. THE Edit_Event_Page SHALL reuse the same form field components used by the Create_Event_Page (e.g., EventActivityForm, DiscountSelector, DatePicker fields).
2. THE Edit_Event_Page SHALL apply the same field validation rules as the Create_Event_Page (required fields, date constraints, activity validation).
3. WHEN the event data is saved from the Edit_Event_Page, THE Edit_Event_Page SHALL submit the same API payload structure as the Create_Event_Page.

### Requirement 8: Internationalisation Support

**User Story:** As an event organiser using a non-English locale, I want the redesigned edit page to be fully translated, so that I can use the application in my preferred language.

#### Acceptance Criteria

1. THE Edit_Event_Page SHALL use existing i18n translation keys for all section titles, field labels, button labels, and validation messages.
2. WHEN new UI text is introduced (e.g., Sidebar_Navigation labels, Sticky_Save_Bar labels), THE Edit_Event_Page SHALL define translation keys for all six supported locales (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT).

### Requirement 9: Routing Separation

**User Story:** As a developer, I want the create and edit flows to use separate page components, so that the codebase is clean and each flow can evolve independently.

#### Acceptance Criteria

1. THE routing configuration SHALL map `/events/new` to the Create_Event_Page component (existing Wizard).
2. THE routing configuration SHALL map `/events/:id/edit` to the Edit_Event_Page component (new single-page layout).
3. THE Edit_Event_Page SHALL be a new React component separate from the Create_Event_Page.
