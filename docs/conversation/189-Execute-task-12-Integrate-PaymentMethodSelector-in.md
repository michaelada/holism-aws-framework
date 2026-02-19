# Execute task: 12. Integrate PaymentMethodSelector into EditOrganizationPage

Exported: 19/02/2026, 09:07:45

---

**User:**

Execute Task: 12. Integrate PaymentMethodSelector into EditOrganizationPage

---

**Assistant:**

I'll implement task 12 by completing its subtasks. Let me start by reading the relevant files to understand the current implementation.

Now let me check the organization types to understand the structure better:

Now let me check the payment method types:

Now let me update the task status and start implementing subtask 12.1:

Now I need to update the UpdateOrganizationDto to include enabledPaymentMethods:

Now I need to update the Organization interface to include paymentMethods:

Now let me update the EditOrganizationPage component to integrate payment methods:

Now I need to add the PaymentMethodSelector component to the form:

Now let me verify the changes by reading the updated file:

Perfect! Now let me check for any diagnostics:

Great! Now let me mark subtask 12.1 as complete and move to subtask 12.2:

Now let me check if there's an existing test file for EditOrganizationPage:

Let me check the CreateOrganizationPage test for reference:

Now let me create the integration test for EditOrganizationPage:

Now let me run the test to verify it works:

Perfect! All tests pass. The warnings about `act()` are common in React testing and don't affect the test results. Now let me mark the subtask as complete and complete the parent task:

Perfect! Task 12 has been successfully completed. Let me provide a summary:

## Task 12 Completed Successfully

I've successfully integrated the PaymentMethodSelector component into the EditOrganizationPage. Here's what was implemented:

### Subtask 12.1: Update EditOrganizationPage component ✓
- Added `getPaymentMethods` import to load available payment methods
- Added `paymentMethods` state to store the list of payment methods
- Added `enabledPaymentMethods` field to the form data
- Updated `loadData()` to fetch payment methods and extract current organization's payment method names
- Added PaymentMethodSelector component to the form UI
- The component now loads current payment methods and pre-selects them in the UI

### Subtask 12.2: Write integration test ✓
Created comprehensive integration tests covering:
- Loading and displaying payment methods with current selections pre-selected
- Selecting/deselecting payment methods and including them in update submission
- Persisting payment method selections when updating organization
- Displaying current payment methods correctly when organization has multiple payment methods

All 4 tests pass successfully, validating that:
- Payment methods are loaded and displayed correctly
- Current payment methods are pre-selected based on organization data
- Users can select/deselect payment methods
- Form submission includes the updated payment methods in the API call
- The component handles organizations with multiple payment methods

The implementation follows the same patterns used in CreateOrganizationPage and maintains consistency with the existing codebase.

---
