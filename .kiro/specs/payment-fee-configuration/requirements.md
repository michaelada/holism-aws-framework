# Requirements Document

## Introduction

This feature standardises the fee and payment configuration across all modules that accept payments: Events, Memberships, Registrations, Calendar Bookings, and Merchandise. Each of these modules must present a consistent set of three core payment fields when defining a type/activity: the fee amount (in the organisation's currency), the supported payment methods, and a handling fee inclusion toggle. The handling fee toggle controls whether the credit card processing fee is absorbed by the organisation (included) or passed on to the payer (excluded).

## Glossary

- **Organisation**: The entity that owns and configures the system. Each Organisation has a `currency` setting (e.g., 'EUR').
- **Fee**: A monetary amount denominated in the Organisation's currency that a payer must pay for a given type/activity.
- **Supported_Payment_Methods**: The set of payment methods (e.g., card, offline) available for a given type/activity, drawn from the Organisation's configured payment methods.
- **Handling_Fee_Included**: A boolean flag indicating whether the credit card processing fee is absorbed into the Fee (Yes) or added on top of the Fee at checkout (No).
- **Membership_Type**: A configuration record in the Memberships module that defines a category of membership (e.g., "Annual Adult Membership").
- **Registration_Type**: A configuration record in the Registrations module that defines a category of entity registration (e.g., "2026 Horse Registration").
- **Calendar**: A bookable resource configuration in the Calendar module (e.g., "Tennis Court 1").
- **Merchandise_Type**: A product configuration in the Merchandise module (e.g., "Club Jersey").
- **Event_Activity**: An activity within an Event that users can enter and pay for.
- **Payment_Configuration_Section**: The standardised UI section containing the Fee, Supported_Payment_Methods, and Handling_Fee_Included fields.
- **MembershipTypeForm**: The React form component used to create and edit Membership_Type records.
- **RegistrationTypeForm**: The React form component used to create and edit Registration_Type records.
- **CalendarForm**: The React form component used to create and edit Calendar records.
- **CreateMerchandiseTypePage**: The React page component used to create and edit Merchandise_Type records.
- **EventActivityForm**: The React form component used to create and edit Event_Activity records within an Event.

## Requirements

### Requirement 1: Add Fee Field to Membership Types

**User Story:** As an organisation administrator, I want to specify a fee for each membership type, so that applicants know the cost of that membership.

#### Acceptance Criteria

1. THE MembershipTypeForm SHALL display a Fee input field labelled with the Organisation's currency code (e.g., "Fee (EUR)").
2. WHEN the administrator enters a Fee value, THE MembershipTypeForm SHALL accept only non-negative numeric values with up to two decimal places.
3. WHEN the administrator saves a Membership_Type, THE System SHALL persist the Fee value to the `membership_types` database table.
4. THE Membership_Type data model SHALL include a `fee` field of type `DECIMAL(10,2)` with a default value of `0.00`.

### Requirement 2: Add Handling Fee Included Toggle to Membership Types

**User Story:** As an organisation administrator, I want to specify whether the handling fee is included in the membership fee, so that I can control whether the card processing cost is absorbed or passed to the applicant.

#### Acceptance Criteria

1. WHEN the Membership_Type Fee is greater than zero and the Supported_Payment_Methods include a card-based method, THE MembershipTypeForm SHALL display a Handling_Fee_Included checkbox.
2. WHEN Handling_Fee_Included is set to Yes, THE System SHALL treat the Fee as inclusive of the card processing fee, so the payer pays only the specified Fee.
3. WHEN Handling_Fee_Included is set to No, THE System SHALL add the calculated card processing fee on top of the specified Fee at checkout.
4. THE Membership_Type data model SHALL include a `handling_fee_included` field of type `BOOLEAN` with a default value of `false`.

### Requirement 3: Add Fee Field to Registration Types

**User Story:** As an organisation administrator, I want to specify a fee for each registration type, so that applicants know the cost of registering an entity.

#### Acceptance Criteria

1. THE RegistrationTypeForm SHALL display a Fee input field labelled with the Organisation's currency code (e.g., "Fee (EUR)").
2. WHEN the administrator enters a Fee value, THE RegistrationTypeForm SHALL accept only non-negative numeric values with up to two decimal places.
3. WHEN the administrator saves a Registration_Type, THE System SHALL persist the Fee value to the `registration_types` database table.
4. THE Registration_Type data model SHALL include a `fee` field of type `DECIMAL(10,2)` with a default value of `0.00`.

### Requirement 4: Add Handling Fee Included Toggle to Registration Types

**User Story:** As an organisation administrator, I want to specify whether the handling fee is included in the registration fee, so that I can control whether the card processing cost is absorbed or passed to the applicant.

#### Acceptance Criteria

1. WHEN the Registration_Type Fee is greater than zero and the Supported_Payment_Methods include a card-based method, THE RegistrationTypeForm SHALL display a Handling_Fee_Included checkbox.
2. WHEN Handling_Fee_Included is set to Yes, THE System SHALL treat the Fee as inclusive of the card processing fee, so the payer pays only the specified Fee.
3. WHEN Handling_Fee_Included is set to No, THE System SHALL add the calculated card processing fee on top of the specified Fee at checkout.
4. THE Registration_Type data model SHALL include a `handling_fee_included` field of type `BOOLEAN` with a default value of `false`.

### Requirement 5: Add Handling Fee Included Toggle to Calendar Bookings

**User Story:** As an organisation administrator, I want to specify whether the handling fee is included in calendar booking prices, so that I can control whether the card processing cost is absorbed or passed to the booker.

#### Acceptance Criteria

1. WHEN the Calendar has Supported_Payment_Methods that include a card-based method, THE CalendarForm SHALL display a Handling_Fee_Included checkbox in the payment configuration section.
2. WHEN Handling_Fee_Included is set to Yes, THE System SHALL treat the time slot prices as inclusive of the card processing fee.
3. WHEN Handling_Fee_Included is set to No, THE System SHALL add the calculated card processing fee on top of the time slot price at checkout.
4. THE Calendar data model SHALL include a `handling_fee_included` field of type `BOOLEAN` with a default value of `false`.

### Requirement 6: Add Handling Fee Included Toggle to Merchandise Types

**User Story:** As an organisation administrator, I want to specify whether the handling fee is included in merchandise prices, so that I can control whether the card processing cost is absorbed or passed to the buyer.

#### Acceptance Criteria

1. WHEN the Merchandise_Type has Supported_Payment_Methods that include a card-based method, THE CreateMerchandiseTypePage SHALL display a Handling_Fee_Included checkbox in the payment configuration section.
2. WHEN Handling_Fee_Included is set to Yes, THE System SHALL treat the merchandise option prices as inclusive of the card processing fee.
3. WHEN Handling_Fee_Included is set to No, THE System SHALL add the calculated card processing fee on top of the merchandise price at checkout.
4. THE Merchandise_Type data model SHALL include a `handling_fee_included` field of type `BOOLEAN` with a default value of `false`.

### Requirement 7: Database Migration for New Fields

**User Story:** As a developer, I want the database schema to support the new fee and handling fee fields, so that the data is persisted correctly across all modules.

#### Acceptance Criteria

1. THE System SHALL provide a SQL migration that adds a `fee` column of type `DECIMAL(10,2)` with default `0.00` to the `membership_types` table.
2. THE System SHALL provide a SQL migration that adds a `handling_fee_included` column of type `BOOLEAN` with default `false` to the `membership_types` table.
3. THE System SHALL provide a SQL migration that adds a `fee` column of type `DECIMAL(10,2)` with default `0.00` to the `registration_types` table.
4. THE System SHALL provide a SQL migration that adds a `handling_fee_included` column of type `BOOLEAN` with default `false` to the `registration_types` table.
5. THE System SHALL provide a SQL migration that adds a `handling_fee_included` column of type `BOOLEAN` with default `false` to the `calendars` table.
6. THE System SHALL provide a SQL migration that adds a `handling_fee_included` column of type `BOOLEAN` with default `false` to the `merchandise_types` table.
7. THE migration SHALL be backward-compatible, using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with default values so existing rows are unaffected.

### Requirement 8: Consistent Payment Configuration UI Pattern

**User Story:** As an organisation administrator, I want the fee and payment configuration to look and behave the same across all modules, so that the experience is predictable and easy to learn.

#### Acceptance Criteria

1. THE Payment_Configuration_Section SHALL display the Fee field, Supported_Payment_Methods selector, and Handling_Fee_Included toggle in a consistent order across all modules.
2. THE Fee field label SHALL include the Organisation's currency code retrieved from `organisation.currency` (e.g., "Fee (EUR)").
3. WHEN the Fee is zero or no card-based payment method is selected, THE Payment_Configuration_Section SHALL hide the Handling_Fee_Included toggle.
4. THE Handling_Fee_Included toggle SHALL use consistent labelling and helper text across all modules explaining that "Yes" means the fee absorbs the card processing charge and "No" means the payer pays the processing charge on top.

### Requirement 9: Internationalisation Support for New Fields

**User Story:** As a developer, I want all new field labels and helper text to use i18n translation keys, so that the UI can be localised.

#### Acceptance Criteria

1. THE System SHALL define translation keys for the Fee field label, Handling_Fee_Included label, and Handling_Fee_Included helper text.
2. THE MembershipTypeForm, RegistrationTypeForm, CalendarForm, CreateMerchandiseTypePage, and EventActivityForm SHALL use i18n translation keys for all new field labels and helper text.
3. THE System SHALL provide English translations for all new translation keys in each module's i18n file.

### Requirement 10: Standardise Event Activity Fee Display

**User Story:** As an organisation administrator, I want the event activity fee field to display the organisation's currency code and follow the same payment configuration pattern as other modules, so that the fee presentation is consistent across the entire system.

#### Acceptance Criteria

1. THE EventActivityForm SHALL display the Fee input field labelled with the Organisation's currency code (e.g., "Fee (EUR)") retrieved from `organisation.currency`.
2. WHEN the EventActivityForm displays a persisted Fee value, THE EventActivityForm SHALL format the Fee value using the `formatCurrency` utility consistent with other modules.
3. THE EventActivityForm SHALL render the Fee field, Supported_Payment_Methods selector, and Handling_Fee_Included toggle in the same order and layout as the Payment_Configuration_Section used in other modules.
4. THE EventActivityForm SHALL use i18n translation keys for the Fee field label that include a currency code placeholder (e.g., `events.activities.activity.feeCurrency`), consistent with the pattern used in MembershipTypeForm, RegistrationTypeForm, CalendarForm, and CreateMerchandiseTypePage.
