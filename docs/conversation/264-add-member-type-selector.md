# Add Member - Membership Type Selector Fix

## Issue
When clicking the "Add Member" button with multiple membership types configured, the page showed an error "No membership type selected" instead of prompting the user to select which membership type to use.

## Root Cause
The `CreateMemberPage` component required a `typeId` URL parameter and would show an error if it wasn't provided. The original logic in `MembersDatabasePage` was:
- 1 membership type: Navigate with `typeId` parameter (auto-select)
- Multiple membership types: Navigate without `typeId` parameter (should show selector)

However, `CreateMemberPage` didn't handle the case when no `typeId` was provided.

## Changes Made

### 1. Updated CreateMemberPage Component
**File**: `packages/orgadmin-memberships/src/pages/CreateMemberPage.tsx`

Added logic to handle three scenarios:
1. **No typeId provided + No membership types**: Show error "No membership types available"
2. **No typeId provided + 1 membership type**: Auto-select the single type
3. **No typeId provided + Multiple membership types**: Show membership type selector dialog

#### New State
```typescript
const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
const [showTypeSelector, setShowTypeSelector] = useState(false);
```

#### New Functions
- `loadMembershipTypes()` - Loads all membership types and determines which scenario to handle
- `handleTypeSelect(selectedTypeId)` - Handles type selection from dialog, updates URL, and loads the form
- `handleTypeSelectorClose()` - Handles dialog close and navigates back to members database

#### Updated useEffect
```typescript
useEffect(() => {
  if (typeId && organisation?.id) {
    // TypeId provided - load the specific membership type
    loadMembershipTypeAndForm(typeId);
  } else if (organisation?.id) {
    // No typeId - load all membership types to show selector
    loadMembershipTypes();
  }
}, [typeId, organisation?.id]);
```

### 2. Added MembershipTypeSelector Component
Imported and rendered the existing `MembershipTypeSelector` component at the end of the page:

```typescript
<MembershipTypeSelector
  open={showTypeSelector}
  onClose={handleTypeSelectorClose}
  onSelect={handleTypeSelect}
  membershipTypes={membershipTypes}
/>
```

## User Flow

### Scenario 1: Single Membership Type
1. User clicks "Add Member" button
2. `MembersDatabasePage` navigates to `/members/create?typeId=<id>`
3. `CreateMemberPage` loads the membership type and form directly
4. User fills out the form

### Scenario 2: Multiple Membership Types
1. User clicks "Add Member" button
2. `MembersDatabasePage` navigates to `/members/create` (no typeId)
3. `CreateMemberPage` loads all membership types
4. Membership type selector dialog appears
5. User selects a membership type
6. URL updates to `/members/create?typeId=<selected-id>`
7. Form loads for the selected membership type
8. User fills out the form

### Scenario 3: No Membership Types
1. "Add Member" button is hidden (handled by `MembersDatabasePage`)
2. If somehow accessed directly, shows error "No membership types available"

## API Endpoint Used
- `GET /api/orgadmin/membership-types` - Returns array of membership types

## Components Involved
- `MembersDatabasePage` - Determines navigation based on membership type count
- `CreateMemberPage` - Handles type selection and form loading
- `MembershipTypeSelector` - Dialog component for selecting membership type

## Testing
- Tested with 2 membership types - selector dialog appears correctly
- Tested with 1 membership type - auto-selects and loads form
- URL updates correctly when type is selected
- Navigation back to members database works correctly

## Related Files
- `packages/orgadmin-memberships/src/pages/CreateMemberPage.tsx` - Main changes
- `packages/orgadmin-memberships/src/components/MembershipTypeSelector.tsx` - Existing component used
- `packages/orgadmin-memberships/src/pages/MembersDatabasePage.tsx` - Navigation logic (already correct)
