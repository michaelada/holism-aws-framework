# Discount Code Field Relocation

## Overview
Relocated the "Discount Code" field from Step 1 (Basic Information) to Step 3 (Eligibility Criteria) in the Create/Edit Discount form, and made it conditional based on the "Requires code entry" checkbox.

## Changes Made

### 1. Removed Discount Code from Step 1
**File**: `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx`

Removed the discount code TextField from the `renderBasicInformation()` function (Step 1). The field was previously displayed as an optional field for all discounts.

### 2. Added Conditional Discount Code to Step 3
**File**: `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx`

Added the discount code TextField to the `renderEligibilityCriteria()` function (Step 3), immediately after the "Requires code entry" checkbox. The field is now:
- Only visible when `formData.requiresCode` is `true`
- Marked as required when visible
- Includes appropriate help text and validation

```typescript
{/* Discount Code - Only shown when requiresCode is checked */}
{formData.requiresCode && (
  <Grid item xs={12}>
    <TextField
      fullWidth
      required
      label="Discount Code"
      value={formData.code}
      onChange={(e) => handleChange('code', e.target.value)}
      error={!!fieldErrors.code}
      helperText={fieldErrors.code || 'Enter the code that users must provide to activate this discount (3-50 characters)'}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title="The alphanumeric code (3-50 characters) that users must enter to apply this discount" arrow placement="top">
              <IconButton size="small" edge="end">
                <HelpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  </Grid>
)}
```

### 3. Updated Validation Logic

**Step 1 Validation** (`validateStep1`):
- Removed discount code validation since the field is no longer in Step 1

**Step 3 Validation** (`validateStep3`):
- Added validation for discount code when `requiresCode` is checked:
  - Code is required when checkbox is enabled
  - Code must be between 3 and 50 characters
  - Validation only runs when `requiresCode` is `true`

```typescript
// Validate discount code when requiresCode is checked
if (formData.requiresCode) {
  if (!formData.code || !formData.code.trim()) {
    errors.code = 'Discount code is required when "Requires code entry" is enabled';
  } else if (formData.code.length < 3 || formData.code.length > 50) {
    errors.code = 'Discount code must be between 3 and 50 characters';
  }
}
```

## User Experience Improvements

1. **Better Context**: The discount code field now appears in the same step as the "Requires code entry" checkbox, making the relationship between these two fields clearer.

2. **Conditional Display**: Users only see the code field when they've indicated they want to require a code, reducing form clutter for discounts that don't need codes.

3. **Required Field**: When the checkbox is enabled, the code field becomes required, ensuring users don't accidentally enable code requirement without providing a code.

4. **Validation Feedback**: Clear error messages guide users to provide a valid code when required.

## Testing Checklist

- [ ] Create a new discount without enabling "Requires code entry" - code field should not appear
- [ ] Create a new discount and enable "Requires code entry" - code field should appear
- [ ] Try to proceed to Step 4 without entering a code when checkbox is enabled - should show validation error
- [ ] Enter a code less than 3 characters - should show validation error
- [ ] Enter a code more than 50 characters - should show validation error
- [ ] Enter a valid code (3-50 characters) - should proceed to Step 4
- [ ] Edit an existing discount with a code - checkbox should be checked and code should be visible
- [ ] Edit an existing discount without a code - checkbox should be unchecked and code field should be hidden
- [ ] Uncheck "Requires code entry" on an existing discount with a code - code field should disappear
- [ ] Review & Confirm step should still display the code correctly

## Files Modified

- `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx` - Relocated discount code field and updated validation

## Related Documentation

- [Discount System Implementation Status](./DISCOUNT_SYSTEM_IMPLEMENTATION_STATUS.md)
- [Discount System Proposal](./DISCOUNT_SYSTEM_PROPOSAL.md)
