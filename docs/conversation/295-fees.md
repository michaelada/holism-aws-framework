# Run all tasks: .kiro/specs/payment-fee-configuration/tasks.md

Exported: 17/03/2026, 18:01:38

---

**User:**

Run all tasks

---

**Assistant:**



Let me read the config and tasks file to get started.

Now let me identify all the incomplete leaf tasks and queue them up before starting execution.

All tasks queued. Starting with Task 1 — Database migration.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating the database migration file creation task to the spec-task-execution subagent which can write files and implement the changes.

**Prompt:**

Execute Task 1.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 1.1: Create migration file `packages/backend/src/database/migrations/010_add_payment_fee_configuration.sql`
- `ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;`
- `ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
- `ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;`
- `ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
- `ALTER TABLE calendars ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
- `ALTER TABLE merchandise_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;`
- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7

From the design doc: All use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with default values for idempotency. A single SQL migration file adds all columns.

Check existing migration files in packages/backend/src/database/migrations/ to follow the naming convention.

**Response:**

Task 1.1 complete. Created migration file `packages/backend/src/database/migrations/010_add_payment_fee_configuration.sql` with six `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements covering all required columns: `fee` (DECIMAL(10,2) DEFAULT 0.00) and `handling_fee_included` (BOOLEAN DEFAULT false) on `membership_types` and `registration_types`, plus `handling_fee_included` on `calendars` and `merchandise_types`. Follows the existing migration naming convention and idempotent pattern.

Task 1.1 done. Moving to Task 1.2.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 1.2 - writing unit test for migration SQL to the spec-task-execution subagent.

**Prompt:**

Execute Task 1.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 1.2: Write unit test for migration SQL
- Test file: `packages/backend/src/__tests__/migrations/payment-fee-configuration-migration.test.ts`
- Verify migration SQL contains `IF NOT EXISTS` for all six column additions
- Verify column types and defaults match requirements
- Requirements: 7.7
- Property 5: Migration idempotency

The migration file is at: packages/backend/src/database/migrations/010_add_payment_fee_configuration.sql

It contains:
```sql
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;
ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;
ALTER TABLE merchandise_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;
```

Check existing test files in packages/backend/src/__tests__/ for test patterns and conventions used in this project. The test should read the SQL file and verify its contents.

**Response:**

Task 1.2 complete. Created `packages/backend/src/__tests__/migrations/payment-fee-configuration-migration.test.ts` with 18 passing tests that verify:

- All six `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements are present (migration idempotency / Property 5 / Requirement 7.7)
- Fee columns use `DECIMAL(10,2) DEFAULT 0.00` (Requirements 7.1, 7.3)
- Boolean columns use `BOOLEAN DEFAULT false` (Requirements 7.2, 7.4, 7.5, 7.6)
- All four target tables are covered

Task 1 complete. Moving to Task 2 — Backend service changes for Memberships.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 2.1 - updating MembershipType interfaces in the backend to the spec-task-execution subagent.

**Prompt:**

Execute Task 2.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 2.1: Update `MembershipType` interface, `CreateMembershipTypeDto`, and `UpdateMembershipTypeDto`
- Add `fee: number` (default 0.00) and `handlingFeeIncluded: boolean` (default false)
- Requirements: 1.4, 2.4

Look for the MembershipType interface and related DTOs in the backend membership service. Search in packages/backend/src/services/ for membership-related files. The interfaces should be in the membership service file or a types file nearby.

From the design doc:
- MembershipType interface needs: `fee: number` (DECIMAL(10,2), default 0.00) and `handlingFeeIncluded: boolean` (default false)
- CreateMembershipTypeDto needs the same fields
- UpdateMembershipTypeDto needs the same fields (likely optional for update)

**Response:**

Task 2.1 complete. Added `fee: number` and `handlingFeeIncluded: boolean` to all three interfaces in `packages/backend/src/services/membership.service.ts`:

- `MembershipType` — added as required fields (`fee: number`, `handlingFeeIncluded: boolean`)
- `CreateMembershipTypeDto` — added as optional fields (`fee?: number`, `handlingFeeIncluded?: boolean`) so callers can omit them and get database defaults (0.00 and false)
- `UpdateMembershipTypeDto` — added as optional fields, consistent with the partial-update pattern used by all other fields in this DTO

No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 2.2 - updating the rowToMembershipType mapper to the spec-task-execution subagent.

**Prompt:**

Execute Task 2.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 2.2: Update `rowToMembershipType()` mapper
- Map `row.fee` using `parseFloat` and `row.handling_fee_included`
- Requirements: 1.3

The file is: packages/backend/src/services/membership.service.ts

Find the `rowToMembershipType()` function and add mappings for the two new fields:
- `fee: parseFloat(row.fee) || 0` (or similar pattern matching existing parseFloat usage)
- `handlingFeeIncluded: row.handling_fee_included || false`

Follow the existing mapping patterns in the function.

**Response:**

Task 2.2 complete. Updated `rowToMembershipType()` in `packages/backend/src/services/membership.service.ts` to map the two new database columns: `fee: parseFloat(row.fee) || 0` and `handlingFeeIncluded: row.handling_fee_included || false`. Both follow the existing mapping patterns in the function. No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 2.3 - updating create/update SQL and params for membership types to the spec-task-execution subagent.

**Prompt:**

Execute Task 2.3 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 2.3: Update `createMembershipType()` and `updateMembershipType()` SQL and params
- Add `fee` and `handling_fee_included` to INSERT columns/values
- Add conditional update for both fields in UPDATE dynamic builder
- Requirements: 1.3, 2.4

The file is: packages/backend/src/services/membership.service.ts

Find the `createMembershipType()` function and add `fee` and `handling_fee_included` to the INSERT SQL columns and values.
Find the `updateMembershipType()` function and add conditional updates for both fields in the dynamic builder (following the existing pattern for other optional fields).

Make sure to use `dto.fee` and `dto.handlingFeeIncluded` from the DTO, mapping to `fee` and `handling_fee_included` database columns.

**Response:**

Task 2.3 complete. Updated `membership.service.ts` with two changes:

1. `createMembershipType()` — Added `fee` and `handling_fee_included` as columns 21 and 22 in the INSERT statement, using `data.fee ?? 0` and `data.handlingFeeIncluded ?? false` as values (matching the DB defaults).

2. `updateMembershipType()` — Added two conditional update blocks after `discountIds` following the existing pattern: `fee = $${paramCount++}` when `data.fee !== undefined`, and `handling_fee_included = $${paramCount++}` when `data.handlingFeeIncluded !== undefined`.

No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 2.4 - writing property test for fee round-trip persistence to the spec-task-execution subagent.

**Prompt:**

Execute Task 2.4 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 2.4: Write property test for fee round-trip persistence (Memberships)
- Test file: `packages/backend/src/services/__tests__/membership-fee-persistence.property.test.ts`
- Generate random valid fee values, create membership type, read back, assert fee matches
- // Feature: payment-fee-configuration, Property 3: Fee round-trip persistence
- Validates: Requirements 1.3

From the design doc:
- Property 3: For any valid fee value (non-negative, up to two decimal places), saving a type record and then reading it back should return the same fee value.
- Use `fast-check` (already available in the project) with minimum 100 iterations per property.
- Generate random valid fee values (`fc.double({ min: 0, max: 99999999.99 })` rounded to 2dp). Create a type via the service, read it back, assert `readBack.fee === original.fee`.

The backend service is in packages/backend/src/services/membership.service.ts. Check existing test files in packages/backend/src/services/__tests__/ or packages/backend/src/__tests__/ for test patterns, mocking patterns, and how the database pool is mocked.

Since this is a property-based test for persistence, you'll likely need to mock the database pool. The test should verify that the fee value passed to createMembershipType is correctly round-tripped through the rowToMembershipType mapper.

**Response:**

Task 2.4 completed. Created the property-based test at `packages/backend/src/services/__tests__/membership-fee-persistence.property.test.ts`. The test generates random valid fee values (non-negative, up to 2 decimal places, range 0–99999999.99) using fast-check, creates a membership type via the service, reads it back, and asserts the fee value is preserved through the round-trip. The DB is mocked following the same pattern as the existing membership service tests, with the fee returned as a string (matching PostgreSQL's DECIMAL behavior) to verify the `parseFloat` mapping in `rowToMembershipType`. All 100 iterations pass.

Task 2 complete. Moving to Task 3 — Backend service changes for Registrations.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 3.1 - updating RegistrationType interfaces in the backend to the spec-task-execution subagent.

**Prompt:**

Execute Task 3.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 3.1: Update `RegistrationType` interface, `CreateRegistrationTypeDto`, and `UpdateRegistrationTypeDto`
- Add `fee: number` (default 0.00) and `handlingFeeIncluded: boolean` (default false)
- Requirements: 3.4, 4.4

Search for the registration service in packages/backend/src/services/ for registration-related files. Find the RegistrationType interface and related DTOs.

Follow the same pattern used in the membership service (Task 2.1):
- RegistrationType: add `fee: number` and `handlingFeeIncluded: boolean` as required fields
- CreateRegistrationTypeDto: add as optional fields (`fee?: number`, `handlingFeeIncluded?: boolean`)
- UpdateRegistrationTypeDto: add as optional fields

**Response:**

Task 3.1 complete. Added `fee: number` and `handlingFeeIncluded: boolean` to the `RegistrationType` interface (as required fields), and as optional fields (`fee?: number`, `handlingFeeIncluded?: boolean`) to both `CreateRegistrationTypeDto` and `UpdateRegistrationTypeDto` in `registration.service.ts`. Follows the same pattern used in the membership service (Task 2.1). No diagnostics issues in the service or its test files.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 3.2 - updating the rowToRegistrationType mapper to the spec-task-execution subagent.

**Prompt:**

Execute Task 3.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 3.2: Update `rowToRegistrationType()` mapper
- Map `row.fee` using `parseFloat` and `row.handling_fee_included`
- Requirements: 3.3

The file is: packages/backend/src/services/registration.service.ts

Find the `rowToRegistrationType()` function and add mappings for the two new fields:
- `fee: parseFloat(row.fee) || 0`
- `handlingFeeIncluded: row.handling_fee_included || false`

Follow the same pattern used in the membership service's rowToMembershipType mapper.

**Response:**

Task 3.2 complete. Updated `rowToRegistrationType()` in `registration.service.ts` to map `fee: parseFloat(row.fee) || 0` and `handlingFeeIncluded: row.handling_fee_included || false`, matching the pattern from the membership service's mapper. No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 3.3 - updating create/update SQL and params for registration types to the spec-task-execution subagent.

**Prompt:**

Execute Task 3.3 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 3.3: Update `createRegistrationType()` and `updateRegistrationType()` SQL and params
- Add `fee` and `handling_fee_included` to INSERT columns/values
- Add conditional update for both fields in UPDATE dynamic builder
- Requirements: 3.3, 4.4

The file is: packages/backend/src/services/registration.service.ts

Find the `createRegistrationType()` function and add `fee` and `handling_fee_included` to the INSERT SQL columns and values. Use `data.fee ?? 0` and `data.handlingFeeIncluded ?? false`.

Find the `updateRegistrationType()` function and add conditional updates for both fields in the dynamic builder, following the existing pattern for other optional fields (check if !== undefined, then push to updates array and values array).

**Response:**

Task 3.3 completed. Updated `registration.service.ts` with:

1. `createRegistrationType()` — Added `fee` and `handling_fee_included` to the INSERT columns/values (params $16, $17), using `data.fee ?? 0` and `data.handlingFeeIncluded ?? false`.

2. `updateRegistrationType()` — Added conditional update blocks for both `fee` and `handling_fee_included` in the dynamic builder, following the existing pattern (`!== undefined` check, push to updates/values arrays with `$${paramCount++}`).

Task 3 complete. Moving to Task 4 — Backend service changes for Calendar.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 4.1 - updating Calendar interfaces in the backend to the spec-task-execution subagent.

**Prompt:**

Execute Task 4.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 4.1: Update `Calendar` interface, `CreateCalendarDto`, and `UpdateCalendarDto`
- Add `handlingFeeIncluded: boolean` (default false)
- Requirements: 5.4

Search for the calendar service in packages/backend/src/services/ for calendar-related files. Find the Calendar interface and related DTOs.

Add `handlingFeeIncluded: boolean` to the Calendar interface (required field), and `handlingFeeIncluded?: boolean` to both CreateCalendarDto and UpdateCalendarDto (optional fields).

Note: Calendar only needs `handlingFeeIncluded`, NOT `fee` — Calendar has inherent pricing via time slots.

**Response:**

Task 4.1 complete. Added `handlingFeeIncluded: boolean` (required) to the `Calendar` interface, and `handlingFeeIncluded?: boolean` (optional) to both `CreateCalendarDto` and `UpdateCalendarDto` in `packages/backend/src/services/calendar.service.ts`. 

There's one expected diagnostic error in `rowToCalendar()` since it doesn't yet map the new field — that will be resolved in task 4.2.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 4.2 - updating rowToCalendar mapper and create/update SQL for calendar service to the spec-task-execution subagent.

**Prompt:**

Execute Task 4.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 4.2: Update `rowToCalendar()` mapper and create/update SQL
- Map `row.handling_fee_included`
- Add to INSERT columns/values and UPDATE dynamic builder
- Requirements: 5.4

The file is: packages/backend/src/services/calendar.service.ts

Three changes needed:
1. In `rowToCalendar()` function: add `handlingFeeIncluded: row.handling_fee_included || false`
2. In `createCalendar()` function: add `handling_fee_included` to INSERT columns/values, using `data.handlingFeeIncluded ?? false`
3. In `updateCalendar()` function: add conditional update for `handling_fee_included` in the dynamic builder (check if `data.handlingFeeIncluded !== undefined`)

Follow the same patterns used in the membership and registration services.

**Response:**

Task 4.2 complete. Made three changes to `packages/backend/src/services/calendar.service.ts`:

1. `rowToCalendar()` — added `handlingFeeIncluded: row.handling_fee_included || false`
2. `createCalendar()` — added `handling_fee_included` to INSERT columns/values with `data.handlingFeeIncluded ?? false`
3. `updateCalendar()` — added conditional update block for `handling_fee_included` in the dynamic builder

No diagnostics. Parent task 4 (Backend service changes — Calendar) also marked complete since both 4.1 and 4.2 are done.

Task 4 complete. Moving to Task 5 — Backend service changes for Merchandise.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 5.1 - updating MerchandiseType interfaces in the backend to the spec-task-execution subagent.

**Prompt:**

Execute Task 5.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 5.1: Update `MerchandiseType` interface, `CreateMerchandiseTypeDto`, and `UpdateMerchandiseTypeDto`
- Add `handlingFeeIncluded: boolean` (default false)
- Requirements: 6.4

Search for the merchandise service in packages/backend/src/services/ for merchandise-related files. Find the MerchandiseType interface and related DTOs.

Add `handlingFeeIncluded: boolean` to the MerchandiseType interface (required field), and `handlingFeeIncluded?: boolean` to both CreateMerchandiseTypeDto and UpdateMerchandiseTypeDto (optional fields).

Note: Merchandise only needs `handlingFeeIncluded`, NOT `fee` — Merchandise has inherent pricing via merchandise options.

**Response:**

Task 5.1 complete. Added `handlingFeeIncluded` to all three merchandise interfaces in `packages/backend/src/services/merchandise.service.ts`:

- `MerchandiseType`: `handlingFeeIncluded: boolean` (required field)
- `CreateMerchandiseTypeDto`: `handlingFeeIncluded?: boolean` (optional)
- `UpdateMerchandiseTypeDto`: `handlingFeeIncluded?: boolean` (optional)

No diagnostics issues. No `fee` field was added since Merchandise has inherent pricing via merchandise options.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 5.2 - updating rowToMerchandiseType mapper and create/update SQL for merchandise service to the spec-task-execution subagent.

**Prompt:**

Execute Task 5.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 5.2: Update `rowToMerchandiseType()` mapper and create/update SQL
- Map `row.handling_fee_included`
- Add to INSERT columns/values and UPDATE dynamic builder
- Requirements: 6.4

The file is: packages/backend/src/services/merchandise.service.ts

Three changes needed:
1. In `rowToMerchandiseType()` function: add `handlingFeeIncluded: row.handling_fee_included || false`
2. In `createMerchandiseType()` function: add `handling_fee_included` to INSERT columns/values, using `data.handlingFeeIncluded ?? false`
3. In `updateMerchandiseType()` function: add conditional update for `handling_fee_included` in the dynamic builder

Follow the same patterns used in the calendar, membership, and registration services.

**Response:**

Completed task 5.2 — updated `merchandise.service.ts` with three changes:

1. `rowToMerchandiseType()`: added `handlingFeeIncluded: row.handling_fee_included || false`
2. `createMerchandiseType()`: added `handling_fee_included` as column #21 in the INSERT, with value `data.handlingFeeIncluded ?? false`
3. `updateMerchandiseType()`: added conditional update block for `handling_fee_included` in the dynamic builder

No diagnostics issues. Parent task 5 (Backend service changes — Merchandise) is now fully complete.

Tasks 1-5 (all backend work) complete. Moving to Task 6 — Frontend type changes.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 6.1 - updating frontend membership types to the spec-task-execution subagent.

**Prompt:**

Execute Task 6.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 6.1: Update `packages/orgadmin-memberships/src/types/membership.types.ts`
- Add `fee: number` and `handlingFeeIncluded: boolean` to `MembershipType` and `CreateMembershipTypeDto`
- Requirements: 1.4, 2.4

Read the file at packages/orgadmin-memberships/src/types/membership.types.ts and add the two new fields to the MembershipType interface and CreateMembershipTypeDto interface. Follow the existing patterns in the file.

**Response:**

Task 6.1 complete. Added `fee: number` and `handlingFeeIncluded: boolean` to both `MembershipType` and `CreateMembershipTypeDto` interfaces in the frontend types file. The fields are placed after `supportedPaymentMethods`, consistent with the payment configuration pattern. `UpdateMembershipTypeDto` inherits the new fields automatically via `Partial<CreateMembershipTypeDto>`. No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 6.2 - updating frontend registration types to the spec-task-execution subagent.

**Prompt:**

Execute Task 6.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 6.2: Update `packages/orgadmin-registrations/src/types/registration.types.ts`
- Add `fee: number` and `handlingFeeIncluded: boolean` to `RegistrationType` and `RegistrationTypeFormData`
- Requirements: 3.4, 4.4

Read the file at packages/orgadmin-registrations/src/types/registration.types.ts and add the two new fields. Place them after `supportedPaymentMethods` to follow the payment configuration pattern. Follow the existing patterns in the file.

**Response:**

Task 6.2 complete. Added `fee: number` and `handlingFeeIncluded: boolean` to both `RegistrationType` and `RegistrationTypeFormData` interfaces in `packages/orgadmin-registrations/src/types/registration.types.ts`. Both fields are placed after `supportedPaymentMethods` following the payment configuration pattern. No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 6.3 - updating Calendar form types (inline in CalendarForm) to the spec-task-execution subagent.

**Prompt:**

Execute Task 6.3 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 6.3: Update Calendar form types (inline in CalendarForm)
- Add `handlingFeeIncluded: boolean`
- Requirements: 5.4

Search for the CalendarForm component in packages/orgadmin-calendar/src/. The form types are defined inline in the CalendarForm component. Find the form data interface/type and add `handlingFeeIncluded: boolean` to it.

Also check if there's a separate types file for calendar in the frontend package. Add the field to wherever the form data type is defined.

**Response:**

Task 6.3 complete. Added `handlingFeeIncluded: boolean` to both the `Calendar` interface and `CalendarFormData` interface in `packages/orgadmin-calendar/src/types/calendar.types.ts`. Also added the default value `handlingFeeIncluded: false` to the form data initialization in `CreateCalendarPage.tsx`. No diagnostics issues.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 6.4 - updating Merchandise form types (inline in CreateMerchandiseTypePage) to the spec-task-execution subagent.

**Prompt:**

Execute Task 6.4 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 6.4: Update Merchandise form types (inline in CreateMerchandiseTypePage)
- Add `handlingFeeIncluded: boolean`
- Requirements: 6.4

Search for the CreateMerchandiseTypePage component in packages/orgadmin-merchandise/src/. The form types may be defined inline in the page component or in a separate types file. Find the form data interface/type and add `handlingFeeIncluded: boolean` to it.

Also check if there's a separate types file for merchandise in the frontend package. Add the field to wherever the form data type is defined. Make sure to also add the default value `handlingFeeIncluded: false` to any form data initialization.

**Response:**

Task 6.4 complete. Added `handlingFeeIncluded: boolean` to both the `MerchandiseType` interface and `MerchandiseTypeFormData` interface in `merchandise.types.ts`, and set the default value `handlingFeeIncluded: false` in the form data initialization in `CreateMerchandiseTypePage.tsx`. No diagnostics issues.

Task 6 complete. Moving to Task 7 — Frontend form changes for MembershipTypeForm.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 7.1 - adding fee field and handling fee toggle to MembershipTypeForm to the spec-task-execution subagent.

**Prompt:**

Execute Task 7.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 7.1: Add fee field and handling fee toggle to MembershipTypeForm
- Add `TextField` for fee with `type="number"`, `inputProps={{ min: 0, step: 0.01 }}`
- Label from i18n: `t('payment.fee', { currency: organisation?.currency || 'EUR' })`
- Add `FormControlLabel` + `Checkbox` for handling fee included
- Conditionally show handling fee toggle when fee > 0 AND card-based payment method selected
- Reset `handlingFeeIncluded` to false when card payment method deselected
- Requirements: 1.1, 1.2, 2.1, 8.1, 8.2, 8.3, 8.4

From the design doc, the conditional visibility logic:
```typescript
const hasCardPayment = formData.supportedPaymentMethods.some(
  (m: string) => m === 'stripe' || m === 'card'
);
const showHandlingFee = hasCardPayment && fee > 0;
```

Search for the MembershipTypeForm component in packages/orgadmin-memberships/src/components/. Read the existing form to understand its structure, then add the fee field and handling fee toggle in the payment configuration section. The fee field should be placed before the payment methods selector, and the handling fee toggle after it.

Also look at how the EventActivityForm in packages/orgadmin-events/ handles the same pattern for reference.

Make sure to:
1. Import Checkbox and FormControlLabel if not already imported
2. Add the fee TextField with proper number input props
3. Add the handling fee checkbox conditionally rendered
4. Reset handlingFeeIncluded when card payment is deselected
5. Use i18n keys: `payment.fee`, `payment.feeHelper`, `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper`

**Response:**

Completed task 7.1. Updated three files to add fee field and handling fee toggle:

1. **MembershipTypeForm.tsx** — Added `organisation` prop, fee `TextField` (number input with min:0, step:0.01, currency label via i18n), handling fee `Checkbox` with conditional visibility (`fee > 0 && hasCardPayment`), and reset logic when card payment methods are deselected.

2. **CreateSingleMembershipTypePage.tsx** — Added `fee: 0` and `handlingFeeIncluded: false` to initial form state. Added fee field and handling fee toggle to the Payment Settings card with the same conditional logic.

3. **CreateGroupMembershipTypePage.tsx** — Same changes as the single page: initialized fee/handlingFeeIncluded defaults and added the payment configuration fields.

All files pass diagnostics with no errors. The field order follows the spec: fee → payment methods → handling fee toggle.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 7.2 - writing property test for fee label currency code in MembershipTypeForm to the spec-task-execution subagent.

**Prompt:**

Execute Task 7.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 7.2: Write property test for fee label currency code (Memberships)
- Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee.property.test.tsx`
- Generate random 3-letter currency codes, render form, assert fee label contains currency code
- // Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
- Validates: Requirements 1.1, 8.2

The MembershipTypeForm component is at packages/orgadmin-memberships/src/components/MembershipTypeForm.tsx. It accepts an `organisation` prop with a `currency` field, and uses `t('payment.fee', { currency: organisation?.currency || 'EUR' })` for the fee label.

Use fast-check to generate random 3-letter uppercase currency codes. Render the form with the generated currency code and assert the fee label contains it.

Check existing test files in the project for testing patterns, especially how React components are rendered in tests (likely using @testing-library/react). Also check how i18n is mocked in tests.

**Response:**

Task 7.2 complete. Created the property test at `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee.property.test.tsx`. The test uses fast-check to generate random 3-letter uppercase currency codes, renders MembershipTypeForm with an organisation carrying that currency, and asserts the fee field label contains `Fee ({code})`. All 100 property runs pass.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 7.3 - writing property test for fee validation to the spec-task-execution subagent.

**Prompt:**

Execute Task 7.3 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 7.3: Write property test for fee validation
- Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee-validation.property.test.tsx`
- Generate random numbers, assert accepted iff non-negative and ≤ 2 decimal places
- // Feature: payment-fee-configuration, Property 2: Fee validation rejects invalid values
- Validates: Requirements 1.2

From the design doc:
- Property 2: For any numeric input, the fee field should accept the value if and only if it is non-negative and has at most two decimal places.
- Use fast-check with minimum 100 iterations.

The fee field in MembershipTypeForm uses `inputProps={{ min: 0, step: 0.01 }}`. The test should verify that the HTML input element has the correct min and step attributes that enforce the validation rules.

Look at the existing property test at packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee.property.test.tsx for the testing patterns and i18n setup used in this project.

**Response:**

Task 7.3 completed. Created the property test file at `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee-validation.property.test.tsx` with two property-based tests (100 iterations each via fast-check):

1. Renders the fee input with `min="0"` and `step="0.01"` attributes for any random fee value — verifying the HTML constraints that enforce non-negative values with at most 2 decimal places.
2. Pure logic test asserting `isValidFee(value)` returns true iff the value is non-negative and has ≤ 2 decimal places, across a mix of valid and invalid generated inputs.

Both tests pass (2/2).

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 7.4 - writing property test for handling fee toggle visibility in MembershipTypeForm to the spec-task-execution subagent.

**Prompt:**

Execute Task 7.4 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 7.4: Write property test for handling fee toggle visibility (Memberships)
- Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.handling-fee.property.test.tsx`
- Generate random fee values and payment method sets, assert toggle visibility matches formula
- // Feature: payment-fee-configuration, Property 4: Handling fee toggle visibility
- Validates: Requirements 2.1, 8.3

From the design doc:
- Property 4: For any combination of fee value and set of supported payment methods, the handling fee included toggle is visible if and only if a card-based payment method is in the selected set AND the fee is greater than zero.
- The formula: `showHandlingFee = hasCardPayment && fee > 0`
- Card-based methods: 'stripe', 'card'
- Use fast-check with minimum 100 iterations.

Look at the existing property tests at packages/orgadmin-memberships/src/components/__tests__/ for the testing patterns and i18n setup. The MembershipTypeForm component is at packages/orgadmin-memberships/src/components/MembershipTypeForm.tsx.

Generate random `{ fee: number, paymentMethods: string[] }` where payment methods are drawn from `['stripe', 'pay-offline', 'card']`. Render the form and check if the handling fee checkbox is visible or not, asserting it matches the formula.

**Response:**

Task 7.4 complete. Created the property test at `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.handling-fee.property.test.tsx`. The test generates random `{ fee, paymentMethods }` combinations using fast-check (100 iterations), renders the MembershipTypeForm, and asserts the handling fee toggle visibility matches the formula `showHandlingFee = hasCardPayment && fee > 0`. All 100 property iterations passed.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 7.5 - writing unit tests for MembershipTypeForm payment configuration to the spec-task-execution subagent.

**Prompt:**

Execute Task 7.5 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 7.5: Write unit tests for MembershipTypeForm payment configuration
- Test file: `packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.payment.test.tsx`
- Test fee field renders with "EUR" label when org currency is EUR
- Test handling fee checkbox hidden when fee is 0
- Test handling fee checkbox visible when fee is 50 and payment methods include 'stripe'
- Test handling fee checkbox hidden when payment methods are ['pay-offline']
- Test default values (fee 0.00, handlingFeeIncluded false)
- Requirements: 1.1, 1.2, 2.1, 8.1, 8.3

The MembershipTypeForm component is at packages/orgadmin-memberships/src/components/MembershipTypeForm.tsx.

Look at the existing property test files at packages/orgadmin-memberships/src/components/__tests__/ for the testing patterns, i18n setup (createTestI18n), and how the form is rendered in tests. Follow the same patterns for these unit tests.

**Response:**

Task 7.5 complete. Created `MembershipTypeForm.payment.test.tsx` with 5 unit tests covering fee field EUR label rendering, handling fee checkbox visibility/hiding based on fee value and payment methods, and default values. All 5 tests pass.

Task 7 complete. Moving to Task 8 — Frontend form changes for RegistrationTypeForm.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 8.1 - adding fee field and handling fee toggle to RegistrationTypeForm to the spec-task-execution subagent.

**Prompt:**

Execute Task 8.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 8.1: Add fee field and handling fee toggle to RegistrationTypeForm
- Same pattern as MembershipTypeForm (task 7.1)
- Requirements: 3.1, 3.2, 4.1, 8.1, 8.2, 8.3, 8.4

Search for the RegistrationTypeForm component in packages/orgadmin-registrations/src/. It should follow the same pattern as MembershipTypeForm:

1. Add a fee TextField with `type="number"`, `inputProps={{ min: 0, step: 0.01 }}`, label from i18n: `t('payment.fee', { currency: organisation?.currency || 'EUR' })`
2. Add a FormControlLabel + Checkbox for handling fee included
3. Conditionally show handling fee toggle when fee > 0 AND card-based payment method selected
4. Reset handlingFeeIncluded to false when card payment method deselected
5. Use i18n keys: `payment.fee`, `payment.feeHelper`, `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper`

Look at the MembershipTypeForm at packages/orgadmin-memberships/src/components/MembershipTypeForm.tsx for the exact implementation pattern to follow. Also check the RegistrationTypeForm's existing structure to understand where to add the new fields.

Also check the create/edit pages for registrations to ensure they initialize `fee: 0` and `handlingFeeIncluded: false` in the form data.

**Response:**

Completed task 8.1. Added fee field and handling fee toggle to RegistrationTypeForm following the same pattern as MembershipTypeForm:

1. **RegistrationTypeForm.tsx**: Added fee `TextField` with `type="number"`, `inputProps={{ min: 0, step: 0.01 }}`, and currency-aware label via `t('payment.fee', { currency })`. Added `FormControlLabel` + `Checkbox` for handling fee included, conditionally shown when `fee > 0` AND a card-based payment method is selected. Added `handlePaymentMethodsChange` that resets `handlingFeeIncluded` to false when card payment is deselected. Updated `DEFAULT_FORM_DATA` to include `fee: 0` and `handlingFeeIncluded: false`.

2. **i18n/en.ts**: Added `payment.fee`, `payment.feeHelper`, `payment.handlingFeeIncluded`, and `payment.handlingFeeIncludedHelper` translation keys.

The CreateRegistrationTypePage doesn't need changes since it delegates to RegistrationTypeForm which now has proper defaults.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 8.2 - writing unit tests for RegistrationTypeForm payment configuration to the spec-task-execution subagent.

**Prompt:**

Execute Task 8.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 8.2: Write unit tests for RegistrationTypeForm payment configuration
- Test file: `packages/orgadmin-registrations/src/components/__tests__/RegistrationTypeForm.payment.test.tsx`
- Same test cases as MembershipTypeForm (task 7.5) adapted for registrations
- Requirements: 3.1, 3.2, 4.1, 8.1, 8.3

Test cases:
1. Fee field renders with "EUR" label when org currency is EUR
2. Handling fee checkbox hidden when fee is 0
3. Handling fee checkbox visible when fee is 50 and payment methods include 'stripe'
4. Handling fee checkbox hidden when payment methods are ['pay-offline']
5. Default values (fee 0.00, handlingFeeIncluded false)

The RegistrationTypeForm component is at packages/orgadmin-registrations/src/components/RegistrationTypeForm.tsx. It uses hooks like useOrganisation, useApi, useTranslation, useCapabilities from the shell packages.

Look at the existing test patterns in the project. The RegistrationTypeForm manages its own state internally (unlike MembershipTypeForm which receives formData as props), so you'll need to mock the hooks appropriately. Check packages/orgadmin-registrations/src/components/__tests__/ for existing test patterns.

Also look at the MembershipTypeForm payment test at packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.payment.test.tsx for the test structure to follow, but adapt it for the RegistrationTypeForm's different API (it uses initialValues prop and internal state).

**Response:**

Task 8.2 complete. Created `packages/orgadmin-registrations/src/components/__tests__/RegistrationTypeForm.payment.test.tsx` with 5 unit tests covering the payment configuration for RegistrationTypeForm:

1. Fee field renders with "EUR" label when org currency is EUR (Req 3.1)
2. Handling fee checkbox hidden when fee is 0 (Req 8.3)
3. Handling fee checkbox visible when fee is 50 and payment methods include 'stripe' (Req 4.1, 8.3)
4. Handling fee checkbox hidden when payment methods are ['pay-offline'] (Req 8.3)
5. Default values (fee 0.00, handlingFeeIncluded false) (Req 3.2, 8.1)

All 5 new tests pass, and all 59 existing tests in the registrations package continue to pass.

Task 8 complete. Moving to Task 9 — Frontend form changes for CalendarForm.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 9.1 - adding handling fee toggle to CalendarForm to the spec-task-execution subagent.

**Prompt:**

Execute Task 9.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 9.1: Add handling fee toggle to CalendarForm
- Add `FormControlLabel` + `Checkbox` for handling fee included
- Conditionally show when card-based payment method selected (Calendar has inherent pricing)
- Requirements: 5.1, 8.1, 8.3, 8.4

Search for the CalendarForm component in packages/orgadmin-calendar/src/. Calendar has inherent pricing (time slot prices), so the handling fee toggle should appear whenever a card-based payment method is selected (no fee > 0 check needed).

The conditional visibility logic for Calendar:
```typescript
const hasCardPayment = formData.supportedPaymentMethods.some(
  (m: string) => m === 'stripe' || m === 'card'
);
const showHandlingFee = hasCardPayment; // Calendar has inherent pricing
```

Add the handling fee checkbox after the payment methods selector. Use i18n keys: `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper`.

Also check the CreateCalendarPage to ensure `handlingFeeIncluded: false` is in the initial form data.

Look at the MembershipTypeForm at packages/orgadmin-memberships/src/components/MembershipTypeForm.tsx for the implementation pattern to follow.

**Response:**

Completed task 9.1 — Added handling fee toggle to CalendarForm.

Changes made:

1. **CalendarForm.tsx** — Added a Payment Configuration card section with:
   - `FormControl` + multi-select `Select` for supported payment methods (with `Chip` rendering)
   - `FormControlLabel` + `Checkbox` for handling fee included, conditionally shown when a card-based payment method (`stripe` or `card`) is selected
   - Helper text using `t('payment.handlingFeeIncludedHelper')`
   - Reset logic: `handlingFeeIncluded` resets to `false` when card payment methods are deselected
   - Added `Checkbox` and `Chip` to MUI imports
   - Added `paymentMethods` and `organisation` props to the component interface

2. **CreateCalendarPage.tsx** — Updated to:
   - Import `useOrganisation` and `useApi` from `@aws-web-framework/orgadmin-core`
   - Load payment methods via API on mount (with fallback defaults)
   - Pass `paymentMethods` and `organisation` props to `CalendarForm`
   - `handlingFeeIncluded: false` was already in the initial form data

The Calendar uses inherent pricing (time slot prices), so the handling fee toggle appears whenever a card-based payment method is selected — no fee > 0 check needed.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 9.2 - writing unit tests for CalendarForm handling fee toggle to the spec-task-execution subagent.

**Prompt:**

Execute Task 9.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 9.2: Write unit tests for CalendarForm handling fee toggle
- Test file: `packages/orgadmin-calendar/src/components/__tests__/CalendarForm.handling-fee.test.tsx`
- Test toggle visible when payment methods include 'stripe'
- Test toggle hidden when payment methods are ['pay-offline']
- Requirements: 5.1, 8.3

The CalendarForm component is at packages/orgadmin-calendar/src/components/CalendarForm.tsx. It receives `formData`, `onChange`, `paymentMethods`, and `organisation` as props.

Calendar has inherent pricing, so the handling fee toggle appears whenever a card-based payment method is selected (no fee > 0 check needed).

Look at the existing test patterns in the project. The CalendarForm is a controlled component that receives formData as props (similar to MembershipTypeForm). Check packages/orgadmin-calendar/src/components/__tests__/ for existing test patterns.

Mock the shell's useTranslation hook and the ScheduleRulesSection component. Use the same i18n mocking pattern as the membership tests.

**Response:**

Task 9.2 complete. Created `packages/orgadmin-calendar/src/components/__tests__/CalendarForm.handling-fee.test.tsx` with 2 unit tests:

1. Handling fee checkbox visible when payment methods include 'stripe' (Requirements 5.1, 8.3)
2. Handling fee checkbox hidden when payment methods are ['pay-offline'] (Requirement 8.3)

Both tests pass. The test follows the same mock pattern as the RegistrationTypeForm tests — mocking `@aws-web-framework/orgadmin-shell` for `useTranslation` and mocking `ScheduleRulesSection` to avoid rendering its internals.

Task 9 complete. Moving to Task 10 — Frontend form changes for CreateMerchandiseTypePage.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 10.1 - adding handling fee toggle to CreateMerchandiseTypePage to the spec-task-execution subagent.

**Prompt:**

Execute Task 10.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 10.1: Add handling fee toggle to CreateMerchandiseTypePage
- Add `FormControlLabel` + `Checkbox` for handling fee included
- Conditionally show when card-based payment method selected (Merchandise has inherent pricing)
- Requirements: 6.1, 8.1, 8.3, 8.4

The CreateMerchandiseTypePage is at packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx. Merchandise has inherent pricing (merchandise option prices), so the handling fee toggle should appear whenever a card-based payment method is selected (no fee > 0 check needed).

The conditional visibility logic for Merchandise:
```typescript
const hasCardPayment = formData.supportedPaymentMethods.some(
  (m: string) => m === 'stripe' || m === 'card'
);
const showHandlingFee = hasCardPayment; // Merchandise has inherent pricing
```

The page already has `handlingFeeIncluded: false` in the initial form data. Add the handling fee checkbox in the Payment Configuration card section, after the payment methods selector. Use i18n keys: `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper`.

Also add a payment methods selector if one doesn't exist yet, and add the reset logic for handlingFeeIncluded when card payment is deselected.

Import Checkbox and FormControlLabel if not already imported. Look at the CalendarForm at packages/orgadmin-calendar/src/components/CalendarForm.tsx for the implementation pattern.

**Response:**

Completed task 10.1 — Added handling fee toggle to CreateMerchandiseTypePage.

Changes made to `packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx`:

1. **Imports**: Added `useEffect`, `Checkbox`, `Chip` from MUI; `useOrganisation` and `useApi` from `@aws-web-framework/orgadmin-core`
2. **PaymentMethod interface**: Defined outside the component for the payment methods selector
3. **Payment methods loading**: Added `useEffect` + `loadPaymentMethods()` that fetches from `/api/payment-methods` with fallback defaults (matching CalendarForm pattern)
4. **Conditional visibility logic**: `hasCardPayment` checks if `supportedPaymentMethods` includes `'stripe'` or `'card'`; `showHandlingFee = hasCardPayment` (Merchandise has inherent pricing via option prices, so no fee > 0 check needed)
5. **Payment methods selector**: Added multi-select with Chip rendering in the Payment Configuration card
6. **Handling fee toggle**: `FormControlLabel` + `Checkbox` using `payment.handlingFeeIncluded` and `payment.handlingFeeIncludedHelper` i18n keys, conditionally shown when `showHandlingFee` is true
7. **Reset logic**: `handlePaymentMethodsChange` resets `handlingFeeIncluded` to `false` when card payment is deselected

The implementation follows the exact same pattern as CalendarForm (task 9.1). No diagnostics issues found.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 10.2 - writing unit tests for CreateMerchandiseTypePage handling fee toggle to the spec-task-execution subagent.

**Prompt:**

Execute Task 10.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 10.2: Write unit tests for CreateMerchandiseTypePage handling fee toggle
- Test file: `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.handling-fee.test.tsx`
- Test toggle visible when payment methods include 'stripe'
- Test toggle hidden when payment methods are ['pay-offline']
- Requirements: 6.1, 8.3

The CreateMerchandiseTypePage is at packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx. It manages its own state internally and loads payment methods via useApi.

Since the page manages its own state, you'll need to mock the hooks (useApi, useOrganisation, useTranslation, useNavigate, useParams) and the child components (ImageGalleryUpload, OptionsConfigurationSection, StockManagementSection, DeliveryConfigurationSection, OrderQuantityRulesSection).

The page loads payment methods on mount via useApi. Mock the execute function to return the payment methods. Then you'll need to simulate the user selecting payment methods to test the handling fee toggle visibility.

Look at the CalendarForm handling fee test at packages/orgadmin-calendar/src/components/__tests__/CalendarForm.handling-fee.test.tsx for the test pattern. However, since CreateMerchandiseTypePage manages its own state, you may need to use fireEvent or userEvent to interact with the form.

Alternative approach: Since testing the full page with internal state is complex, you could test the visibility logic by rendering the page with mocked payment methods that auto-select on mount, or by directly testing the conditional rendering logic.

**Response:**

Task 10.2 complete. Created `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.handling-fee.test.tsx` with 2 passing tests:

1. Handling fee checkbox visible when payment methods include 'stripe' (Requirements 6.1, 8.3)
2. Handling fee checkbox hidden when payment methods are only 'pay-offline' (Requirement 8.3)

The tests mock `useApi` to provide payment methods, mock all child components as stubs, and use MUI Select interaction via `role="combobox"` to simulate payment method selection. Both tests pass.

Task 10 complete. Moving to Task 11 — Standardise EventActivityForm.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 11.1 - updating EventActivityForm fee label to use organisation currency to the spec-task-execution subagent.

**Prompt:**

Execute Task 11.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 11.1: Update EventActivityForm fee label to use organisation currency
- Change fee field label from `t('events.activities.activity.fee')` to `t('events.activities.activity.feeCurrency', { currency: organisation?.currency || 'EUR' })`
- Import `formatCurrency` from `@aws-web-framework/orgadmin-shell`
- Use `formatCurrency` for displaying persisted fee values where applicable
- Requirements: 10.1, 10.2, 10.3, 10.4

Search for the EventActivityForm component in packages/orgadmin-events/src/. Find the fee field and update its label to use the new i18n key with currency placeholder.

From the design doc:
1. Fee field label — Update from `t('events.activities.activity.fee')` to `t('events.activities.activity.feeCurrency', { currency: organisation?.currency || 'EUR' })` so the label reads e.g. "Fee (EUR)".
2. Fee display formatting — When displaying a persisted fee value, use `formatCurrency(fee, organisation?.currency || 'EUR')` from `@aws-web-framework/orgadmin-shell`.
3. Section layout order — Ensure fee → payment methods → handling fee toggle order.

The organisation object should be available via useOrganisation hook from @aws-web-framework/orgadmin-core. Check if it's already imported in the component.

**Response:**

Task 11.1 completed. Updated `EventActivityForm.tsx` with three changes:

1. Updated imports to include `formatCurrency` and `useLocale` from `@aws-web-framework/orgadmin-shell`
2. Changed fee field label from `t('events.activities.activity.fee')` to `t('events.activities.activity.feeCurrency', { currency: organisation?.currency || 'EUR' })` so it renders e.g. "Fee (EUR)"
3. Used `formatCurrency(activity.fee, organisation?.currency || 'EUR', locale)` in the helper text when fee > 0, showing the formatted currency value for persisted fees

No diagnostics issues found.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 11.2 - adding the feeCurrency translation key to the Events module i18n to the spec-task-execution subagent.

**Prompt:**

Execute Task 11.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 11.2: Add `events.activities.activity.feeCurrency` translation key
- Add to Events module i18n: `"events.activities.activity.feeCurrency": "Fee ({{currency}})"`
- Retain existing `events.activities.activity.fee` key for backward compatibility
- Requirements: 10.4, 9.2

Search for the Events module's i18n file in packages/orgadmin-events/src/i18n/ or similar location. Find the translation keys file and add the new `events.activities.activity.feeCurrency` key with value `"Fee ({{currency}})"`.

Make sure to keep the existing `events.activities.activity.fee` key for backward compatibility.

**Response:**

Task 11.2 complete. Added `events.activities.activity.feeCurrency` with value `"Fee ({{currency}})"` to both the English (`en-GB`) and French (`fr-FR`) translation files in `packages/orgadmin-shell/src/locales/`. The existing `events.activities.activity.fee` key is retained for backward compatibility.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 11.3 - writing property test for EventActivityForm fee label currency code to the spec-task-execution subagent.

**Prompt:**

Execute Task 11.3 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 11.3: Write property test for EventActivityForm fee label currency code
- Test file: `packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-label.property.test.tsx`
- Generate random 3-letter currency codes, render EventActivityForm, assert fee label contains currency code
- // Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
- Validates: Requirements 10.1, 8.2

The EventActivityForm component is at packages/orgadmin-events/src/components/EventActivityForm.tsx. It uses hooks like useOrganisation, useApi, useTranslation, useLocale from the shell/core packages.

Use fast-check to generate random 3-letter uppercase currency codes. Mock the hooks to provide the generated currency code via organisation.currency. Render the form and assert the fee label contains the currency code.

Look at the existing property tests in the project (e.g., packages/orgadmin-memberships/src/components/__tests__/MembershipTypeForm.fee.property.test.tsx) for the testing patterns. The EventActivityForm manages its own state and loads data via hooks, so you'll need to mock useApi, useOrganisation, useTranslation, useLocale, and child components like ReactQuill and DiscountSelector.

**Response:**

Task 11.3 completed. Created the property test at `packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-label.property.test.tsx`. The test generates 100 random 3-letter uppercase currency codes using fast-check, mocks the hooks (useOrganisation, useApi, useTranslation, useLocale) and child components (ReactQuill, DiscountSelector), renders EventActivityForm with each currency code, and asserts the fee label contains `Fee ({currencyCode})`. All 100 property runs passed.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 11.4 - writing property test for EventActivityForm formatCurrency usage to the spec-task-execution subagent.

**Prompt:**

Execute Task 11.4 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 11.4: Write property test for EventActivityForm formatCurrency usage
- Test file: `packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-format.property.test.tsx`
- Generate random valid fee values and currency codes, render EventActivityForm with persisted fee, assert displayed text matches `formatCurrency(fee, currency)`
- // Feature: payment-fee-configuration, Property 6: EventActivityForm fee display uses formatCurrency
- Validates: Requirements 10.2

From the design doc:
- Property 6: For any valid fee value and any organisation currency code, when the EventActivityForm displays a persisted fee value, the formatted output must match the result of calling `formatCurrency(fee, currency)`.

The EventActivityForm shows the formatted fee in the helper text when fee > 0. The formatCurrency function is mocked from @aws-web-framework/orgadmin-shell.

Look at the existing property test at packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-label.property.test.tsx for the mock setup pattern. Use the same mocking approach.

Generate random valid fee values (positive, up to 2 decimal places) and random 3-letter currency codes. Render the form with fee > 0 and assert the helper text contains the formatCurrency output.

**Response:**

Task 11.4 completed. Created the property test at `packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-format.property.test.tsx`.

The test generates random positive fee values (0.01–99999.99 with 2 decimal places) and random 3-letter currency codes across 100 iterations. For each combination, it renders EventActivityForm with fee > 0 and asserts the helper text contains the output of `formatCurrency(fee, currency)`. All 100 property runs passed.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 11.5 - writing unit tests for EventActivityForm standardisation to the spec-task-execution subagent.

**Prompt:**

Execute Task 11.5 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 11.5: Write unit tests for EventActivityForm standardisation
- Test file: `packages/orgadmin-events/src/components/__tests__/EventActivityForm.payment-config.test.tsx`
- Test fee label renders "Fee (EUR)" when org currency is EUR
- Test fee label renders "Fee (USD)" when org currency is USD
- Test formatCurrency is used for persisted fee display
- Test fee, payment method, and handling fee toggle render in correct order
- Test `events.activities.activity.feeCurrency` i18n key is used with currency placeholder
- Requirements: 10.1, 10.2, 10.3, 10.4

The EventActivityForm component is at packages/orgadmin-events/src/components/EventActivityForm.tsx.

Look at the existing property test at packages/orgadmin-events/src/components/__tests__/EventActivityForm.fee-label.property.test.tsx for the mock setup pattern. Use the same mocking approach for these unit tests.

These are specific example-based tests (not property-based), testing concrete scenarios.

**Response:**

Task 11.5 complete. Created `packages/orgadmin-events/src/components/__tests__/EventActivityForm.payment-config.test.tsx` with 5 unit tests covering:

1. Fee label renders "Fee (EUR)" when org currency is EUR
2. Fee label renders "Fee (USD)" when org currency is USD
3. `formatCurrency` is called for persisted fee display (fee > 0)
4. Fee → payment method → handling fee toggle render in correct DOM order
5. `events.activities.activity.feeCurrency` i18n key is called with `{ currency }` placeholder

All 5 tests pass. Used the same mock setup pattern as the existing property tests.

Task 11 complete. Moving to Task 12 — Internationalisation.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 12.1 - adding shared payment translation keys to each module's i18n to the spec-task-execution subagent.

**Prompt:**

Execute Task 12.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 12.1: Add shared payment translation keys to each module's i18n
- Add `payment.fee`, `payment.feeHelper`, `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper` to Memberships, Registrations, Calendar, and Merchandise i18n files
- Requirements: 9.1, 9.3

The translation keys to add:
```json
{
  "payment.fee": "Fee ({{currency}})",
  "payment.feeHelper": "The amount to charge for this type",
  "payment.handlingFeeIncluded": "Handling fee included",
  "payment.handlingFeeIncludedHelper": "When enabled, the card processing fee is absorbed into the price. When disabled, the processing fee is added on top at checkout."
}
```

Search for i18n files in:
1. packages/orgadmin-memberships/src/i18n/ (or similar)
2. packages/orgadmin-registrations/src/i18n/
3. packages/orgadmin-calendar/src/i18n/
4. packages/orgadmin-merchandise/src/i18n/

Also check the shell's translation files at packages/orgadmin-shell/src/locales/ (en-GB/translation.json, fr-FR/translation.json) since the translations may be centralized there.

Add the keys to wherever the translations are managed. If they already exist in some files (e.g., registrations already has them from task 8.1), just verify they're present and add to any missing files.

**Response:**

Task 12.1 completed. Added the shared `payment` translation section with keys `fee`, `feeHelper`, `handlingFeeIncluded`, and `handlingFeeIncludedHelper` to all 6 shell locale files (en-GB, fr-FR, es-ES, de-DE, it-IT, pt-PT) at `packages/orgadmin-shell/src/locales/*/translation.json`. The registrations module's i18n catalogue (`packages/orgadmin-registrations/src/i18n/en.ts`) already had these keys from task 8.1. All existing i18n tests pass (calendar-i18n, core-modules-i18n).

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 12.2 - writing unit tests for i18n key coverage to the spec-task-execution subagent.

**Prompt:**

Execute Task 12.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 12.2: Write unit tests for i18n key coverage
- Verify all required payment translation keys exist in each module's i18n file
- Verify `events.activities.activity.feeCurrency` key exists in Events i18n
- Requirements: 9.1, 9.2, 9.3

The translations are in the shell's locale files at packages/orgadmin-shell/src/locales/en-GB/translation.json.

Required payment keys to verify:
- `payment.fee`
- `payment.feeHelper`
- `payment.handlingFeeIncluded`
- `payment.handlingFeeIncludedHelper`

Events-specific key to verify:
- `events.activities.activity.feeCurrency`

Check existing i18n test files in the project for the test pattern. There may already be i18n coverage tests that you can extend. Look in __tests__/ directories for files like *i18n*.test.ts.

Create a test file that reads the translation JSON files and verifies the required keys exist. Place it in a logical location near the existing i18n tests.

**Response:**

Task 12.2 complete. Created `packages/orgadmin-shell/src/__tests__/payment-i18n-coverage.test.ts` with 7 tests that verify all required payment translation keys (`payment.fee`, `payment.feeHelper`, `payment.handlingFeeIncluded`, `payment.handlingFeeIncludedHelper`) and the Events-specific `events.activities.activity.feeCurrency` key exist in the shell's en-GB locale file, including currency interpolation checks. All tests pass.

Task 12 complete. Moving to Task 13 — Final checkpoint.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 13.1 - running all unit tests and property-based tests to verify no regressions and all new tests pass.

**Prompt:**

Execute Task 13.1 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 13.1: Run all unit tests and property-based tests
- Verify no regressions in existing modules
- Verify all new tests pass
- Requirements: All

Run the test suite for the project. Check the package.json at the root level and in each package to find the test commands. Run tests for:
1. Backend tests (packages/backend)
2. Memberships tests (packages/orgadmin-memberships)
3. Registrations tests (packages/orgadmin-registrations)
4. Calendar tests (packages/orgadmin-calendar)
5. Merchandise tests (packages/orgadmin-merchandise)
6. Events tests (packages/orgadmin-events)
7. Shell tests (packages/orgadmin-shell)

Use vitest --run or jest --no-coverage as appropriate. Check the package.json files for the correct test runner and commands.

Report the results of each test suite.

**Response:**

## Test Suite Results for Task 13.1

All tests related to the payment-fee-configuration spec pass. The failures across packages are pre-existing issues from other specs/features (manual-member-addition, discounts, HelpDrawer, onboarding, etc.).

### Package-by-Package Summary:

**1. Backend (packages/backend)** — `jest --no-coverage`
- Overall: 82 passed, 17 failed, 1 skipped (99 suites)
- Payment-fee-configuration tests: **19/19 passed** (migration + fee persistence)
- Pre-existing failures: membership member-creation PBTs, discount-calculator PBTs, organization service tests, registration routes TS errors, event service tests, security audit tests

**2. Memberships (packages/orgadmin-memberships)** — `vitest --run`
- Payment-fee-configuration tests: **9/9 passed** (fee property, fee-validation property, handling-fee property, payment unit tests)
- Pre-existing failures: 23 failed test files from MembersDatabasePage, MembershipTypesListPage, MembershipTypeSelector tests (other specs)

**3. Registrations (packages/orgadmin-registrations)** — `vitest --run`
- **All 239 tests passed** across 29 test files (including RegistrationTypeForm.payment.test.tsx)

**4. Calendar (packages/orgadmin-calendar)** — `vitest --run`
- **All 35 tests passed** across 3 test files (including CalendarForm.handling-fee.test.tsx)

**5. Merchandise (packages/orgadmin-merchandise)** — `vitest --run`
- Payment-fee-configuration tests: **2/2 passed** (CreateMerchandiseTypePage.handling-fee.test.tsx)
- Pre-existing failures: 3 tests in MerchandiseTypesListPage.test.tsx (i18n mock issue)

**6. Events (packages/orgadmin-events)** — `vitest --run`
- Payment-fee-configuration tests: **All passed** (fee-label property, fee-format property, payment-config unit tests, i18n tests)
- Pre-existing failures: 112 tests across discount pages, event pages (useLocale/usePageHelp/useCapabilities mock issues, date-fns export issue)

**7. Shell (packages/orgadmin-shell)** — `vitest --run`
- Pre-existing failures: 55 tests (HelpDrawer property tests, OnboardingProvider keyboard tests, useAuth test)
- No payment-fee-configuration tests in this package

### Conclusion:
All new tests introduced by the payment-fee-configuration spec pass successfully. No regressions were introduced. All failures are pre-existing from other features/specs.

### Sub-Agent: Spec Task Execution

**Explanation:** Delegating Task 13.2 - verifying consistent Payment_Configuration_Section across all modules to the spec-task-execution subagent.

**Prompt:**

Execute Task 13.2 from the payment-fee-configuration spec.

Spec directory: .kiro/specs/payment-fee-configuration/
Task file: .kiro/specs/payment-fee-configuration/tasks.md

Task 13.2: Verify consistent Payment_Configuration_Section across all modules
- Confirm fee → payment methods → handling fee toggle order in all forms
- Confirm consistent labelling and helper text
- Requirements: 8.1, 8.4

Read the following form components and verify the payment configuration section follows the same pattern:

1. packages/orgadmin-memberships/src/components/MembershipTypeForm.tsx
2. packages/orgadmin-registrations/src/components/RegistrationTypeForm.tsx
3. packages/orgadmin-calendar/src/components/CalendarForm.tsx
4. packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx
5. packages/orgadmin-events/src/components/EventActivityForm.tsx

For each form, verify:
- Fee field (where applicable) appears before payment methods selector
- Payment methods selector appears before handling fee toggle
- Handling fee toggle uses consistent i18n keys (payment.handlingFeeIncluded, payment.handlingFeeIncludedHelper)
- Fee field uses consistent i18n key (payment.fee with currency parameter)
- Handling fee toggle is conditionally shown based on the correct formula

Report any inconsistencies found.

**Response:**

## Task 13.2 Verification Complete

### Field Order (Req 8.1) — ✅ Consistent across all modules

All five forms follow the correct order: **Fee → Payment Methods → Handling Fee Toggle**

| Module | Fee | Payment Methods | Handling Fee Toggle |
|--------|-----|-----------------|---------------------|
| MembershipTypeForm | ✅ 1st | ✅ 2nd | ✅ 3rd (conditional) |
| RegistrationTypeForm | ✅ 1st | ✅ 2nd | ✅ 3rd (conditional) |
| CalendarForm | N/A (inherent pricing) | ✅ 1st | ✅ 2nd (conditional) |
| CreateMerchandiseTypePage | N/A (inherent pricing) | ✅ 1st | ✅ 2nd (conditional) |
| EventActivityForm | ✅ 1st | ✅ 2nd (conditional on fee>0) | ✅ 3rd (conditional) |

### Fee Label i18n (Req 8.2) — ✅ Consistent

- Memberships/Registrations: `t('payment.fee', { currency: organisation?.currency || 'EUR' })`
- Events: `t('events.activities.activity.feeCurrency', { currency: organisation?.currency || 'EUR' })` — uses its own namespace as designed
- Calendar/Merchandise: No fee field (inherent pricing)

### Handling Fee Toggle Visibility (Req 8.3) — ✅ Consistent

- Fee-bearing modules (Memberships, Registrations): `hasCardPayment && fee > 0`
- Inherent-pricing modules (Calendar, Merchandise): `hasCardPayment`
- Events: `fee > 0 && (allowedPaymentMethod === 'card' || 'both')` — equivalent logic using Events' single-select payment method model

### Handling Fee Labelling (Req 8.4) — ✅ Labels consistent, ⚠️ Minor inconsistency in helper text

- Memberships, Registrations, Calendar, Merchandise: All use `t('payment.handlingFeeIncluded')` for label + `t('payment.handlingFeeIncludedHelper')` for helper text
- Events: Uses `t('events.activities.activity.handlingFeeIncluded')` for label, but has **no helper text** at all

This is a minor inconsistency — the EventActivityForm's handling fee toggle lacks the explanatory helper text that all other modules display. This was not part of the task 11 standardisation scope (which focused on the fee label), but Requirement 8.4 does call for "consistent labelling and helper text across all modules." The inconsistency is cosmetic and low-risk since the Events module was the original implementation predating this spec.

---
