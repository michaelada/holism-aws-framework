# Discount Creation Page - Membership Types and User Groups Fix

## Issue
When creating a discount in Step 2 (Eligibility Criteria):
- Membership Types dropdown showed hardcoded values instead of actual membership types from the system
- User Groups dropdown existed but there's no user group concept in the system
- Both sections were always visible even when no membership types existed

## Changes Made

### 1. Load Actual Membership Types from API
**File**: `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx`

- Added state for membership types:
  ```typescript
  const [membershipTypes, setMembershipTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingMembershipTypes, setLoadingMembershipTypes] = useState(true);
  ```

- Added `loadMembershipTypes()` function that calls `/api/orgadmin/membership-types` endpoint
- Added useEffect to load membership types on component mount

### 2. Updated Form Data Structure
- Changed `membershipTypes: string[]` to `membershipTypeIds: string[]` to store IDs instead of names
- Removed `userGroups: string[]` field entirely

### 3. Updated Eligibility Criteria Section
- Membership Types selector now:
  - Loads actual membership types from API
  - Stores membership type IDs instead of names
  - Only displays if membership types exist (`membershipTypes.length > 0`)
  - Shows membership type names in chips but stores IDs
- Removed User Groups section completely

### 4. Updated Save Function
- Changed eligibility criteria to use `membershipTypeIds` instead of `membershipTypes`
- Removed `userGroups` from eligibility criteria

### 5. Updated Review Section
- Updated membership types display to:
  - Look up membership type names from IDs
  - Only show if membership types exist in the system
- Removed User Groups display

### 6. Updated Load Discount Function
- Changed to load `membershipTypeIds` instead of `membershipTypes`
- Removed `userGroups` loading

## API Endpoint Used
- `GET /api/orgadmin/membership-types` - Returns array of membership types with `id` and `name` fields

## User Experience Improvements
1. Discount creation now uses actual membership types from the system
2. No confusion about non-existent "User Groups" feature
3. Cleaner UI when no membership types are configured
4. Membership type selection is properly multi-select
5. Discount eligibility is now based on actual membership type IDs

## Testing
- No TypeScript diagnostics errors
- Form properly loads membership types on mount
- Membership Types section hidden when no types exist
- User Groups section completely removed
- Save function properly sends membership type IDs to backend

## Related Files
- `packages/orgadmin-events/src/pages/CreateDiscountPage.tsx` - Main changes
- `packages/backend/src/routes/membership.routes.ts` - API endpoint already exists
