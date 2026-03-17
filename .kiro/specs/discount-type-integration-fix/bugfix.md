# Bugfix Requirements Document

## Introduction

The discount selector is not visible on either the Registration Type or Membership Type forms. There are two root causes:

1. **Missing `/auth/capabilities` endpoint**: The `CapabilityProvider` in the frontend calls `GET /api/orgadmin/auth/capabilities` to determine which capabilities the user has. This endpoint did not exist, so the capabilities array was always empty, and `hasCapability('registration-discounts')` / `hasCapability('membership-discounts')` always returned `false`, hiding the DiscountSelector on both forms. This has been fixed by adding the endpoint to `orgadmin-auth.routes.ts`.

2. **Missing backend support for Registration Type discounts**: The backend registration service has no support for `discount_ids`. The frontend `RegistrationTypeForm` component already renders a `<DiscountSelector>` and includes `discountIds` in its form state, but the backend `registration.service.ts` is missing the `discountIds` field on all interfaces, the database `registration_types` table has no `discount_ids` column, and there is no validation or storage logic. This means any discount selections made in the UI are silently dropped on save and never returned on read.

The equivalent functionality works correctly for Membership Types, where the full pipeline (database column, interface fields, validation, create/update/read mapping) is implemented.

## Bug Analysis

### Current Behavior (Defect)

1.0 WHEN the frontend CapabilityProvider loads THEN it calls `GET /api/orgadmin/auth/capabilities` which did not exist, resulting in an empty capabilities array, causing `hasCapability()` to always return false and hiding the DiscountSelector on both Membership Type and Registration Type forms — FIXED: endpoint added to `orgadmin-auth.routes.ts`

1.1 WHEN a user creates a Registration Type with discount IDs selected in the DiscountSelector THEN the system silently discards the discount IDs because `CreateRegistrationTypeDto` has no `discountIds` field and the INSERT query does not include a `discount_ids` column

1.2 WHEN a user updates an existing Registration Type to add or change discount IDs THEN the system silently discards the discount IDs because `UpdateRegistrationTypeDto` has no `discountIds` field and the UPDATE query does not handle `discount_ids`

1.3 WHEN a user reads a Registration Type that should have discount IDs THEN the system returns no discount information because `RegistrationType` interface has no `discountIds` field and `rowToRegistrationType()` does not map `discount_ids` from the database row

1.4 WHEN the discount service checks which Registration Types use a given discount THEN the system cannot find any because there is no `getRegistrationTypesUsingDiscount()` method and no `discount_ids` column to query

1.5 WHEN a user provides invalid discount IDs (non-existent, wrong organisation, wrong module type, or inactive) during Registration Type creation or update THEN the system does not validate them because there is no `validateDiscountIds()` call in the registration service

### Expected Behavior (Correct)

2.1 WHEN a user creates a Registration Type with discount IDs selected THEN the system SHALL validate the discount IDs and persist them in the `discount_ids` JSONB column of the `registration_types` table

2.2 WHEN a user updates an existing Registration Type to add or change discount IDs THEN the system SHALL validate the discount IDs and update the `discount_ids` column accordingly

2.3 WHEN a user reads a Registration Type that has discount IDs stored THEN the system SHALL return the `discountIds` array as part of the `RegistrationType` response

2.4 WHEN the discount service checks which Registration Types use a given discount THEN the system SHALL query the `registration_types` table's `discount_ids` column and return matching Registration Type IDs

2.5 WHEN a user provides invalid discount IDs (non-existent, wrong organisation, wrong module type, or inactive) during Registration Type creation or update THEN the system SHALL reject the request with appropriate validation errors

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user creates a Registration Type without selecting any discounts THEN the system SHALL CONTINUE TO create the Registration Type successfully with an empty `discount_ids` array

3.2 WHEN a user updates a Registration Type without changing discounts (discountIds not provided in update payload) THEN the system SHALL CONTINUE TO preserve all other fields and not alter the existing discount_ids

3.3 WHEN a user creates or updates a Membership Type with discount IDs THEN the system SHALL CONTINUE TO validate and persist discount IDs through the existing membership service pipeline

3.4 WHEN a user reads, creates, updates, or deletes Registration Types THEN the system SHALL CONTINUE TO handle all existing fields (name, description, entityName, registrationFormId, registrationStatus, isRollingRegistration, validUntil, numberOfMonths, automaticallyApprove, registrationLabels, supportedPaymentMethods, useTermsAndConditions, termsAndConditions) identically to current behavior

3.5 WHEN the discount service checks which Membership Types use a given discount THEN the system SHALL CONTINUE TO return correct results via the existing `getMembershipTypesUsingDiscount()` method
