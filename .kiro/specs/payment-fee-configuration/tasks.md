# Implementation Plan: Payment Fee Configuration

## Overview

This implementation adds fee and handling fee configuration fields across Memberships, Registrations, Calendar, and Merchandise modules, and standardises the Events module's existing fee display. Changes span database migration, backend service updates, frontend form updates, and i18n keys.

## Tasks

- [ ] 1. Database migration
  - [ ] 1.1 Create migration file `packages/backend/src/database/migrations/010_add_payment_fee_configuration.sql`
    - `ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;`
    - `ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
    - `ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;`
    - `ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
    - `ALTER TABLE calendars ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
    - `ALTER TABLE merchandise_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 1.2 Write unit test for migration SQL
    - Test file: `packages/backend/src/__tests__/migrations/payment-fee-configuration-migration.test.ts`
    - Verify migration SQL contains `IF NOT EXISTS` for all six column additions
    - Verify column types and defaults match requirements
    - _Requirements: 7.7_
    - _Property 5: Migration idempotency_

- [ ] 2. Backend service changes — Memberships
  - [ ] 2.1 Update `MembershipType` interface, `CreateMembershipTypeDto`, and `UpdateMembershipTypeDto`
    - Add `fee: number` (default 0.00) and `handlingFeeIncluded: boolean` (default false)
    - _Requirements: 1.4, 2.4_

  - [ ] 2.2 Update `rowToMembershipType()` mapper
    - Map `row.fee` using `parseFloat` and `row.handling_fee_included`
    - _Requirements: 1.3_

  - [ ] 2.3 Update `createMembershipType()` and `updateMembershipType()` SQL and params
    - Add `fee` and `handling_fee_included` to INSERT columns/values
    - Add conditional update for both fields in UPDATE dynamic builder
    - _Requirements: 1.3, 2.4_

  - [ ] 2.4 Write property test for fee round-trip persistence (Memberships)
    - Test file: `packages/backend/src/services/__tests__/membership-fee-persistence.property.test.ts`
    - Generate random valid fee values, create membership type, read back, assert fee matches
    - // Feature: payment-fee-configuration, Property 3: Fee round-trip persistence
    - **Validates: Requirements 1.3**

- [ ] 3. Backend service changes — Registrations
  - [ ] 3.1 Update `RegistrationType` interface, `CreateRegistrationTypeDto`, and `UpdateRegistrationTypeDto`
    - Add `fee: number` (default 0.00) and `handlingFeeIncluded: boolean` (default false)
    - _Requirements: 3.4, 4.4_

  - [ ] 3.2 Update `rowToRegistrationType()` mapper
    - Map `row.fee` using `parseFloat` and `row.handling_fee_included`
    - _Requirements: 3.3_

  - [ ] 3.3 Update `createRegistrationType()` and `updateRegistrationType()` SQL and params
    - Add `fee` and `handling_fee_included` to INSERT columns/values
    - Add conditional update for both fields in UPDATE dynamic builder
    - _Requirements: 3.3, 4.4_

- [ ] 4. Backend service changes — Calendar
  - [ ] 4.1 Update `Calendar` interface, `CreateCalendarDto`, and `UpdateCalendarDto`
    - Add `handlingFeeIncluded: boolean` (default false)
    - _Requirements: 5.4_

  - [ ] 4.2 Update `rowToCalendar()` mapper and create/update SQL
    - Map `row.handling_fee_included`
    - Add to INSERT columns/values and UPDATE dynamic builder
    - _Requirements: 5.4_

- [ ] 5. Backend service changes — Merchandise
  - [ ] 5.1 Update `MerchandiseType` interface, `CreateMerchandiseTypeDto`, and `UpdateMerchandiseTypeDto`
    - Add `handlingFeeIncluded: boolean` (default false)
    - _Requirements: 6.4_

  - [ ] 5.2 Update `rowToMerchandiseType()` mapper and create/update SQL
    - Map `row.handling_fee_included`
    - Add to INSERT columns/values and UPDATE dynamic builder
    - _Requirements: 6.4_

- [ ] 6. Frontend type changes
  - [ ] 6.1 Update `packages/orgadmin-memberships/src/types/membership.types.ts`
    - Add `fee: number` and `handlingFeeIncluded: boolean` to `MembershipType` and `CreateMembershipTypeDto`
    - _Requirements: 1.4, 2.4_

  - [ ] 6.2 Update `packages/orgadmin-registrations/src/types/registration.types.ts`
    - Add `fee: number` and `handlingFeeIncluded: boolean` to `RegistrationType` and `RegistrationTypeFormData`
    - _Requirements: 3.4, 4.4_

  - [ ] 6.3 Update Calendar form types (inline in CalendarForm)
    - Add `handlingFeeIncluded: boolean`
    - _Requirements: 5.4_

  - [ ] 6.4 Update Merchandise form types (inline in CreateMerchandiseTypePage)
    - Add `handlingFeeIncluded: boolean`
    - _Requirements: 6.4_

- [ ] 7. Frontend form changes — MembershipTypeForm
  - [ ] 7.1 Add fee field and handling fee toggle to MembershipTypeForm
    - Add `TextField` for fee with `type="number"`, `inputProps={{ min: 0, step: 0.01 }}`
    - Label from i18n: `t('payment.fee', { currency: organisation?.currency || 'EUR' })`
    - Add `FormControlLabel` + `Checkbox` for handling fee included
    - Conditionally show handling fee toggle when fee > 0 AND card-based payment method selected
    - Reset `handlingFeeIncluded` to false when card payment method deselected
    - _Requirements: 1.1, 1.2, 2.1, 8.1, 8.2, 8.3, 8.4_

  - [ ] 7.2 Write property test for fee label currency code (Memberships)
    - Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee.property.test.tsx`
    - Generate random 3-letter currency codes, render form, assert fee label contains currency code
    - // Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
    - **Validates: Requirements 1.1, 8.2**

  - [ ] 7.3 Write property test for fee validation
    - Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee-validation.property.test.tsx`
    - Generate random numbers, assert accepted iff non-negative and ≤ 2 decimal places
    - // Feature: payment-fee-configuration, Property 2: Fee validation rejects invalid values
    - **Validates: Requirements 1.2**

  - [ ] 7.4 Write property test for handling fee toggle visibility (Memberships)
    - Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.handling-fee.property.test.tsx`
    - Generate random fee values and payment method sets, assert toggle visibility matches formula
    - // Feature: payment-fee-configuration, Property 4: Handling fee toggle visibility
    - **Validates: Requirements 2.1, 8.3**

  - [ ] 7.5 Write unit tests for MembershipTypeForm payment configuration
    - Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.payment.test.tsx`
    - Test fee field renders with "EUR" label when org currency is EUR
    - Test handling fee checkbox hidden when fee is 0
    - Test handling fee checkbox visible when fee is 50 and payment methods include 'stripe'
    - Test handling fee checkbox hidden when payment methods are ['pay-offline']
    - Test default values (fee 0.00, handlingFeeIncluded false)
    - _Requirements: 1.1, 1.2, 2.1, 8.1, 8.3_

- [ ] 8. Frontend form changes — RegistrationTypeForm
  - [ ] 8.1 Add fee field and handling fee toggle to RegistrationTypeForm
    - Same pattern as MembershipTypeForm (task 7.1)
    - _Requirements: 3.1, 3.2, 4.1, 8.1, 8.2, 8.3, 8.4_

  - [ ] 8.2 Write unit tests for RegistrationTypeForm payment configuration
    - Test file: `packages/orgadmin-registrations/src/components/__tests__/RegistrationTypeForm.payment.test.tsx`
    - Same test cases as MembershipTypeForm (task 7.5) adapted for registrations
    - _Requirements: 3.1, 3.2, 4.1, 8.1, 8.3_

- [ ] 9. Frontend form changes — CalendarForm
  - [ ] 9.1 Add handling fee toggle to CalendarForm
    - Add `FormControlLabel` + `Checkbox` for handling fee included
    - Conditionally show when card-based payment method selected (Calendar has inherent pricing)
    - _Requirements: 5.1, 8.1, 8.3, 8.4_

  - [ ] 9.2 Write unit tests for CalendarForm handling fee toggle
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/CalendarForm.handling-fee.test.tsx`
    - Test toggle visible when payment methods include 'stripe'
    - Test toggle hidden when payment methods are ['pay-offline']
    - _Requirements: 5.1, 8.3_

- [ ] 10. Frontend form changes — CreateMerchandiseTypePage
  - [ ] 10.1 Add handling fee toggle to CreateMerchandiseTypePage
    - Add `FormControlLabel` + `Checkbox` for handling fee included
    - Conditionally show when card-based payment method selected (Merchandise has inherent pricing)
    - _Requirements: 6.1, 8.1, 8.3, 8.4_

  - [ ] 10.2 Write unit tests for CreateMerchandiseTypePage handling fee toggle
    - Test file: `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.handling-fee.test.tsx`
    - Test toggle visible when payment methods include 'stripe'
    - Test toggle hidden when payment methods are ['pay-offline']
    - _Requirements: 6.1, 8.3_

- [ ] 11. Standardise EventActivityForm (Events module)
  - [ ] 11.1 Update EventActivityForm fee label to use organisation currency
    - Change fee field label from `t('events.activities.activity.fee')` to `t('events.activities.activity.feeCurrency', { currency: organisation?.currency || 'EUR' })`
    - Import `formatCurrency` from `@aws-web-framework/orgadmin-shell`
    - Use `formatCurrency` for displaying persisted fee values where applicable
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 11.2 Add `events.activities.activity.feeCurrency` translation key
    - Add to Events module i18n: `"events.activities.activity.feeCurrency": "Fee ({{currency}})"`
    - Retain existing `events.activities.activity.fee` key for backward compatibility
    - _Requirements: 10.4, 9.2_

  - [ ] 11.3 Write property test for EventActivityForm fee label currency code
    - Test file: `packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-label.property.test.tsx`
    - Generate random 3-letter currency codes, render EventActivityForm, assert fee label contains currency code
    - // Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
    - **Validates: Requirements 10.1, 8.2**

  - [ ] 11.4 Write property test for EventActivityForm formatCurrency usage
    - Test file: `packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-format.property.test.tsx`
    - Generate random valid fee values and currency codes, render EventActivityForm with persisted fee, assert displayed text matches `formatCurrency(fee, currency)`
    - // Feature: payment-fee-configuration, Property 6: EventActivityForm fee display uses formatCurrency
    - **Validates: Requirements 10.2**

  - [ ] 11.5 Write unit tests for EventActivityForm standardisation
    - Test file: `packages/orgadmin-events/src/components/__tests__/EventActivityForm.payment-config.test.tsx`
    - Test fee label renders "Fee (EUR)" when org currency is EUR
    - Test fee label renders "Fee (USD)" when org currency is USD
    - Test formatCurrency is used for persisted fee display
    - Test fee, payment method, and handling fee toggle render in correct order
    - Test `events.activities.activity.feeCurrency` i18n key is used with currency placeholder
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 12. Internationalisation
  - [ ] 12.1 Add shared payment translation keys to each module's i18n
    - Add `payment.fee`, `payment.feeHelper`, `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper` to Memberships, Registrations, Calendar, and Merchandise i18n files
    - _Requirements: 9.1, 9.3_

  - [ ] 12.2 Write unit tests for i18n key coverage
    - Verify all required payment translation keys exist in each module's i18n file
    - Verify `events.activities.activity.feeCurrency` key exists in Events i18n
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 13. Final checkpoint
  - [ ] 13.1 Run all unit tests and property-based tests
    - Verify no regressions in existing modules
    - Verify all new tests pass
    - _Requirements: All_

  - [ ] 13.2 Verify consistent Payment_Configuration_Section across all modules
    - Confirm fee → payment methods → handling fee toggle order in all forms
    - Confirm consistent labelling and helper text
    - _Requirements: 8.1, 8.4_
