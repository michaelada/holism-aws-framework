# Save Button on Each Step - Implementation

## Overview
Added save buttons to each step of the multi-step wizards for editing events and discounts, allowing users to save changes without navigating to the final step.

## Problem
When editing an existing event or discount, users had to navigate through all wizard steps to reach the final "Review & Confirm" step before they could save their changes. This was inconvenient when making quick edits to early steps like the event name or basic discount information.

## Solution
Added a "Save" button on each step (except the final review step) when in edit mode. This allows users to:
- Make quick edits to any step
- Save immediately without navigating through all steps
- Continue editing other steps if needed

## Implementation Details

### Event Edit Page (`CreateEventPage.tsx`)
- Added conditional "Save" button that appears on steps 0-3 when `isEditMode` is true
- The save button calls `handleSave(formData.status || 'draft')` to preserve the current event status
- Button is positioned between the "Back" and "Next" buttons
- Uses the existing `handleSave` function with proper validation

```typescript
{/* Show Save button on all steps when editing */}
{isEditMode && activeStep < steps.length - 1 && (
  <Button
    variant="outlined"
    startIcon={<SaveIcon />}
    onClick={() => handleSave(formData.status || 'draft')}
    disabled={loading}
  >
    {t('common.actions.save')}
  </Button>
)}
```

### Discount Edit Page (`CreateDiscountPage.tsx`)
- Added conditional "Save" button that appears on steps 0-3 when `isEditMode` is true
- The save button calls the existing `handleSave` function
- Button is positioned between the "Back" and "Next" buttons
- Uses the same validation logic as the final step

```typescript
{/* Show Save button on all steps when editing */}
{isEditMode && activeStep < steps.length - 1 && (
  <Button
    variant="outlined"
    startIcon={<SaveIcon />}
    onClick={handleSave}
    disabled={loading}
  >
    Save
  </Button>
)}
```

## User Experience

### Before
1. User opens event/discount for editing
2. User changes the name on step 1
3. User must click "Next" 3 times to reach the final step
4. User clicks "Save" or "Update"

### After
1. User opens event/discount for editing
2. User changes the name on step 1
3. User clicks "Save" button immediately
4. Changes are saved without navigating through other steps

## Behavior

### Create Mode
- No save button on intermediate steps (only on final step)
- Users must complete all required fields and reach the final step
- This ensures proper validation and complete data entry

### Edit Mode
- Save button appears on all steps except the final review step
- Clicking save validates and saves the current form data
- Users can save at any step and continue editing or exit
- The final step still shows the original save/update button

## Validation
- The save button uses the same validation logic as the final step
- If validation fails, appropriate error messages are displayed
- Users are notified of any issues before the save completes

## Files Modified
- `packages/orgadmin-events/src/pages/CreateEventPage.tsx`
- `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx`

## Testing Recommendations
1. Edit an existing event and save from step 1 (Basic Info)
2. Edit an existing event and save from step 2 (Event Dates)
3. Edit an existing discount and save from step 1 (Basic Information)
4. Edit an existing discount and save from step 3 (Eligibility Criteria)
5. Verify that validation errors are shown appropriately
6. Verify that the save button does not appear in create mode
7. Verify that the save button does not appear on the final review step

## Benefits
- Improved user experience for quick edits
- Reduced clicks required to save changes
- Maintains data integrity with proper validation
- Consistent behavior across event and discount editing
