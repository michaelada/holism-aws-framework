# Run all tasks: .kiro/specs/discount-type-integration-fix/tasks.md (Continued) (Continued)

Exported: 17/03/2026, 14:47:46

---

**User:**

## TASK 1: Fix missing translation keys in registration type form
- **STATUS**: done
- **USER QUERIES**: 1 (from previous conversation context transfer)
- **DETAILS**: Added missing translation keys to `packages/orgadmin-shell/src/locales/en-GB/translation.json` including `registrations.sections.registrationInfo`, `formSubmissionData`, `registrationForm`, `duration`, `approval`, `payment`, `registrations.table.createdAt`, `registrations.batch.title`, `error`, `labelPlaceholder`, `registrations.batch.addLabels.labelsToAdd`, `registrations.batch.removeLabels.labelsToRemove`, `registrations.creation.fieldRequired`, `noTypesAvailable`, `invalidEmail`, `invalidNumber`.
- **FILEPATHS**: `packages/orgadmin-shell/src/locales/en-GB/translation.json`, `packages/orgadmin-registrations/src/i18n/en.ts`

## TASK 2: Fix hardcoded currency symbols ($, £) in discount components
- **STATUS**: done
- **USER QUERIES**: 2 ("organisation set to Euro but showing $ symbol in discounts")
- **DETAILS**: Multiple discount components had hardcoded `$` or `£` instead of using the organisation's configured currency. Fixed by:
  - Added `currencySymbol` and `currencyCode` props to `DiscountSelector` component with `Intl.NumberFormat` resolution via `useMemo`
  - Updated all 4 callers to pass `currencyCode={organisation?.currency || 'EUR'}`
  - Fixed `EventDetailsPage.tsx` to use `formatCurrency()` instead of hardcoded `£`
  - Fixed `DiscountsListPage.tsx` `formatDiscountValue` to use `formatCurrency()`
  - Fixed `CreateDiscountPage.tsx` - replaced all `$` in `InputAdornment` elements with dynamic `currencySymbol`, and review display values with `formatCurrency()`
  - All diagnostics passed clean
- **FILEPATHS**:
  - `packages/components/src/components/discount/DiscountSelector.tsx`
  - `packages/orgadmin-registrations/src/components/RegistrationTypeForm.tsx`
  - `packages/orgadmin-memberships/src/pages/CreateSingleMembershipTypePage.tsx`
  - `packages/orgadmin-memberships/src/pages/CreateGroupMembershipTypePage.tsx`
  - `packages/orgadmin-events/src/components/EventActivityForm.tsx`
  - `packages/orgadmin-events/src/pages/EventDetailsPage.tsx`
  - `packages/orgadmin-events/src/pages/DiscountsListPage.tsx`
  - `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx`

## TASK 3: Create spec for standardized payment fee configuration across all modules
- **STATUS**: in-progress
- **USER QUERIES**: 3 ("membership type has no fee field, all modules need fee/payment methods/handling fee"), 4 ("also needs to apply to Event Activities")
- **DETAILS**: User requested a new feature to standardize fee/payment configuration across all modules (Events, Memberships, Registrations, Calendar, Merchandise). Each module needs 3 elements: Fee (in org currency), Supported Payment Methods, and Handling Fee Included toggle. Requirements document created with 10 requirements. Design document created. User approved requirements, then requested Events activities also be included (Requirement 10 added). Design document was created before the Events addition was requested.
- **NEXT STEPS**:
  - The design document at `.kiro/specs/payment-fee-configuration/design.md` needs to be updated to include Requirement 10 (Events activity fee standardization) - it was created before that requirement was added
  - After design is updated and approved by user, create `tasks.md` (the tasks phase)
  - The workflow is requirements-first: Requirements ✅ → Design (needs update for Req 10) → Tasks (not started)
  - The `.kiro/specs/payment-fee-configuration/.config.kiro` has `{"specId": "f406806f-f4ed-4da1-af82-b19d882ff90c", "workflowType": "requirements-first", "specType": "feature"}`
  - Use subagent `feature-requirements-first-workflow` with preset `"design"` to update design, then preset `"tasks"` for tasks
- **FILEPATHS**:
  - `.kiro/specs/payment-fee-configuration/requirements.md`
  - `.kiro/specs/payment-fee-configuration/design.md`
  - `.kiro/specs/payment-fee-configuration/.config.kiro`

## USER CORRECTIONS AND INSTRUCTIONS:
- User is testing locally at `localhost:5175` with PostgreSQL at `127.0.0.1:5432` (user: `framework_user`, pass: `framework_password`, db: `aws_framework`)
- Migrations are manual SQL files, not auto-run on startup
- The `en.ts` file in `orgadmin-registrations/src/i18n/` is a reference catalogue only; actual runtime translations come from `orgadmin-shell/src/locales/en-GB/translation.json`
- The translation JSON uses nested object structure, not flat dot-notation keys
- Organisation currency is stored as ISO code (e.g., 'EUR') in `organisation.currency`
- `formatCurrency(amount, currencyCode, locale)` is available from `@aws-web-framework/orgadmin-shell`
- Events already have fee/paymentMethod/handlingFeeIncluded on EventActivityForm - use as reference implementation
- The user wants the Events activity fee to ALSO be standardized (use org currency in label, formatCurrency for display)

## Files to read
- `.kiro/specs/payment-fee-configuration/requirements.md`
- `.kiro/specs/payment-fee-configuration/design.md`
- `.kiro/specs/payment-fee-configuration/.config.kiro`
- `packages/orgadmin-events/src/components/EventActivityForm.tsx`
- `packages/orgadmin-memberships/src/pages/CreateSingleMembershipTypePage.tsx`
- `packages/orgadmin-registrations/src/components/RegistrationTypeForm.tsx`

USER QUERIES(most recent first):
1. <implicit-rules>## Implicit Rules
You are working on the design document. 

IMPORTANT: If you just created the design document in this same turn, do NOT ask for review yet. Wait for the user to see it first.

Check if requirements.md exists in the same directory:
- If requirements.md does NOT exist (design-first workflow): Proceed to create requirements.md based on the design.
- If requirements.md exists (requirements-first workflow): Proceed to create tasks.md.</implicit-rules>
2. <implicit-rules>## Implicit Rules
You are working on the requirements document. 
Make sure the requirements include clear user stories and acceptance criteria. 
If following the requirements-first workflow (no design.md exists yet), proceed to create design.md.
If following the design-first workflow (design.md already exists), proceed to create tasks.md.</implicit-rules>
3. I am happy please move on
4. I just realised that the membership type has no field where the user can enter the fee for that specific membership type, can you add this. Also, when it comes to defining an Event Entry fee, a Membership Type application, a registration type application, Calendar booking and Merchandise purchase needs to all include the following 3 main elements:- The fee based on the organisation’s currency setting- The Supported Payment Methods- Handling Fee Included - Yes or No The Handing Fee Included set to Yes means that if someone is paying by card online, then the credit card handling fee is included in the fee and the person paying does not see it, they just pay the specified fee, however if Handling Fee Included is set to No, then this means that the person when paying by card will pay the fee plus the calculated handling fee.
5. continue plpease, my network should be fine
6. continue
7. I have an organisation that is set up to use Language “English (UK)” and I have the Currency set to “Euro (€)” in the Super Admin UI, however when I go to the Org Admin -> Registrations -> Discounts section to add a discount it is showing the $ symbol instead when creating and viewing discount.
8. <implicit-rules>## Implicit Rules
Focus on creating a new spec file or identifying an existing spec to update. 
If starting a new spec, first present the entry point choice to the user (Start with Requirements or Start with Design). 
Do not create any spec files until the user has made their choice.
If working with an existing spec, review the current spec files and suggest improvements if needed. 
Do not make direct code changes yet. First establish or review the spec file that will guide our implementation.</implicit-rules>

---

**Assistant:**



Let me pick up where we left off. The design document needs updating to include Requirement 10 (Events activity fee standardization), then we move to tasks. Let me read the current state of the spec files first.

Good, I can see the state. The design document was created before Requirement 10 was added, so it needs updating to include the Event Activity fee standardization. Then we need to create tasks.md.

Let me delegate to the subagent to update the design and then proceed to tasks.

### Sub-Agent: Feature Requirements First Workflow

**Explanation:** Delegating to the feature-requirements-first-workflow subagent to update the design document to include Requirement 10 (Events activity fee standardization) and then create the tasks.md implementation plan.

**Prompt:**

We are continuing work on the "payment-fee-configuration" spec. The spec is located at `.kiro/specs/payment-fee-configuration/`.

The requirements document (requirements.md) has been approved by the user and contains 10 requirements. The design document (design.md) already exists but was created BEFORE Requirement 10 was added. 

Requirement 10 is: "Standardise Event Activity Fee Display" — the EventActivityForm needs to display the fee field with the organisation's currency code, use formatCurrency for display, follow the same Payment_Configuration_Section layout as other modules, and use i18n translation keys with currency placeholders.

The design document needs to be UPDATED to incorporate Requirement 10. Specifically:
1. The Overview section should mention that the Events module's EventActivityForm also needs standardization (currently it says Events is the "reference implementation" but Req 10 says its fee label needs to use org currency and follow the same pattern)
2. The Architecture section should include EventActivityForm in the frontend components
3. The Frontend Form Changes section should include changes needed for EventActivityForm (update fee label to use org currency from i18n, use formatCurrency for display)
4. The i18n section should include the Events module translation keys
5. The Correctness Properties should cover Requirement 10's acceptance criteria
6. The Testing Strategy should cover EventActivityForm

The existing reference implementation file is at: `packages/orgadmin-events/src/components/EventActivityForm.tsx`

The config is: {"specId": "f406806f-f4ed-4da1-af82-b19d882ff90c", "workflowType": "requirements-first", "specType": "feature"}

After updating the design document, proceed to create the tasks.md file since the user has already approved the requirements and said "I am happy please move on".

**Response:**

Updated the design document to incorporate Requirement 10 (Standardise Event Activity Fee Display) across all relevant sections:

- **Overview**: Clarified that EventActivityForm itself needs standardisation (currency label, formatCurrency usage)
- **Architecture**: Added EventActivityForm to the frontend components diagram with display-only change annotation
- **Frontend Form Changes**: Added new "EventActivityForm Standardisation" subsection covering fee label update, formatCurrency usage, layout order, and i18n key changes
- **i18n**: Added Events module translation key `events.activities.activity.feeCurrency` with `{{currency}}` placeholder
- **Correctness Properties**: Expanded Property 1 to include EventActivityForm, added new Property 6 (EventActivityForm fee display uses formatCurrency)
- **Testing Strategy**: Added EventActivityForm-specific unit tests and Property 6 test description

Created tasks.md with 13 top-level tasks covering database migration, backend service changes (4 modules), frontend type changes, frontend form changes (5 modules including EventActivityForm), i18n, and final checkpoint. Task 11 specifically covers the EventActivityForm standardisation from Requirement 10.

The design document has been updated to include Requirement 10 (Events activity fee standardization) and the tasks.md implementation plan has been created.

The design now covers the EventActivityForm changes: updating the fee label to include the org currency code, using `formatCurrency` for display, and adding the new `feeCurrency` i18n key. The implementation plan has 13 top-level tasks spanning database migration, backend services for all 4 modules, frontend types, form changes for all 5 modules (including EventActivityForm in task 11), i18n keys, and a final checkpoint.

Take a look at the updated design and tasks, and let me know if you'd like any adjustments before we start implementing.

---
