# Bugfix Requirements Document

## Introduction

The Event Activity module uses a hardcoded single-select dropdown for payment method selection (`allowedPaymentMethod` with values `'card'`, `'cheque'`, `'both'`), while all other modules (Memberships, Registrations, Calendar, Merchandise) use a dynamic multi-select dropdown (`supportedPaymentMethods`) that loads payment methods from the API (`/api/orgadmin/payment-methods`) and stores an array of payment method UUIDs. This inconsistency means Event Activity cannot support new payment methods added via the API and does not align with the platform's standardized payment method pattern. The handling fee toggle visibility logic is also inconsistent — Event Activity checks hardcoded string values instead of looking up payment method names dynamically.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin configures payment methods for an Event Activity THEN the system displays a single-select dropdown labeled "Allowed Payment Methods" with hardcoded options ('card', 'cheque', 'both') instead of loading payment methods dynamically from the API

1.2 WHEN an admin selects a payment method for an Event Activity THEN the system stores a hardcoded string value ('card', 'cheque', or 'both') in the `allowedPaymentMethod` field instead of storing an array of payment method UUIDs

1.3 WHEN the system determines whether to show the handling fee toggle for an Event Activity THEN it checks if `allowedPaymentMethod` equals 'card' or 'both' using hardcoded string comparison, instead of dynamically checking whether any selected payment method is card-based by looking up the method name from the API data

1.4 WHEN the system determines whether to show cheque/offline payment instructions for an Event Activity THEN it checks if `allowedPaymentMethod` equals 'cheque' or 'both' using hardcoded string comparison, instead of dynamically checking whether any selected payment method is an offline method by looking up the method name from the API data

1.5 WHEN a new payment method is added to the organisation via the API THEN the Event Activity form does not reflect the new payment method because its options are hardcoded, while all other modules automatically display the new method

1.6 WHEN the database stores the Event Activity payment method configuration THEN it uses a `VARCHAR(20)` column (`allowed_payment_method`) with a CHECK constraint limiting values to ('card', 'cheque', 'both'), instead of an array column capable of storing multiple payment method UUIDs

### Expected Behavior (Correct)

2.1 WHEN an admin configures payment methods for an Event Activity THEN the system SHALL display a multi-select dropdown labeled "Supported Payment Methods" that loads available payment methods dynamically from the `/api/orgadmin/payment-methods` API endpoint, consistent with Memberships, Registrations, Calendar, and Merchandise modules

2.2 WHEN an admin selects payment methods for an Event Activity THEN the system SHALL store an array of payment method UUIDs in a `supportedPaymentMethods` field, consistent with the other modules

2.3 WHEN the system determines whether to show the handling fee toggle for an Event Activity THEN it SHALL check if any selected payment method is card-based by looking up the method name from the loaded payment methods data and checking if it contains 'card', 'stripe', or 'helix' (case-insensitive), consistent with the pattern used in MembershipTypeForm and other modules

2.4 WHEN the system determines whether to show cheque/offline payment instructions for an Event Activity THEN it SHALL check if any selected payment method is an offline method by looking up the method name from the loaded payment methods data and checking if it contains 'offline' (case-insensitive), or by checking that it is not a card-based method

2.5 WHEN a new payment method is added to the organisation via the API THEN the Event Activity form SHALL automatically display the new payment method in its multi-select dropdown without requiring code changes

2.6 WHEN the database stores the Event Activity payment method configuration THEN it SHALL use a column capable of storing an array of payment method UUIDs (e.g., `TEXT[]` or a join table), replacing the existing `VARCHAR(20)` column with its CHECK constraint

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an admin sets the fee to 0 for an Event Activity THEN the system SHALL CONTINUE TO hide the payment method selection UI, as payment methods are only relevant for paid activities

3.2 WHEN an admin configures payment methods for Memberships, Registrations, Calendar, or Merchandise modules THEN the system SHALL CONTINUE TO use the existing multi-select "Supported Payment Methods" dropdown with dynamic API loading and UUID storage without any changes

3.3 WHEN an admin toggles the handling fee checkbox for an Event Activity with a card-based payment method selected THEN the system SHALL CONTINUE TO store the `handlingFeeIncluded` boolean value correctly

3.4 WHEN an admin enters cheque/offline payment instructions for an Event Activity THEN the system SHALL CONTINUE TO store the `chequePaymentInstructions` text value correctly

3.5 WHEN an admin configures other Event Activity fields (name, description, application form, limits, terms and conditions, discounts) THEN the system SHALL CONTINUE TO function identically with no changes to those fields' behavior

3.6 WHEN the handling fee toggle is shown and no card-based payment method is selected THEN the system SHALL CONTINUE TO automatically uncheck/reset the handling fee included flag, consistent with the pattern in other modules
