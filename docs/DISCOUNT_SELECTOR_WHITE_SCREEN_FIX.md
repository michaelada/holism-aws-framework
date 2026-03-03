# Discount Selector White Screen Fix

## Issue
When editing an event and clicking the "Apply Discounts to Event" field, the page showed a white screen with the console error:
```
Uncaught TypeError: discounts.filter is not a function
at DiscountSelector (DiscountSelector.tsx:171:18)
```

## Root Cause
The backend API endpoint `/api/orgadmin/organisations/{orgId}/discounts/events` returns a paginated response with the structure:
```json
{
  "discounts": [...],
  "total": 1
}
```

However, the frontend code in two places was treating the entire response object as an array:
1. `CreateEventPage.tsx` - `setDiscounts(response || [])`
2. `EventActivityForm.tsx` - `setDiscounts(response || [])`

When the DiscountSelector component tried to call `.filter()` on the response object (which is not an array), it threw a TypeError causing the white screen.

## Solution
Updated both files to extract the `discounts` array from the response object before setting state.

### Files Modified

1. **packages/orgadmin-events/src/pages/CreateEventPage.tsx**
   ```tsx
   // Before:
   setDiscounts(response || []);
   
   // After:
   setDiscounts(response?.discounts || []);
   ```

2. **packages/orgadmin-events/src/components/EventActivityForm.tsx**
   ```tsx
   // Before:
   setDiscounts(response || []);
   
   // After:
   setDiscounts(response?.discounts || []);
   ```

## Pattern
This is the same issue that was fixed earlier in `DiscountsListPage.tsx`. The backend consistently returns paginated responses with `{discounts: [...], total: number}` structure, so any code loading discounts must extract the `discounts` array from the response.

## Verification
After this fix:
1. Navigate to edit an existing event
2. Scroll to the "Apply Discounts to Event" section
3. Click the checkbox to enable discount selection
4. The discount selector dropdown should appear without errors
5. Active discounts should be listed in the dropdown

## Related Issues
- This fix follows the same pattern as the DiscountsListPage fix documented in the context transfer summary
- The backend discount API consistently returns paginated responses across all endpoints

## Prevention
When implementing new features that load discounts from the API:
- Always extract the `discounts` array from the response: `response?.discounts || []`
- Never use the response directly as an array: `response || []`
- The backend returns: `{discounts: Discount[], total: number}`
