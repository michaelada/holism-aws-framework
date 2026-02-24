# Organization Type Details Page - Error Fix

## Issue
When viewing an Organization Type details page with organizations, the page showed "Something Went Wrong" error with the following console error:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
at OrganizationList.tsx:115:45
```

## Root Cause
There was a mismatch between the backend and frontend data formats:

- **Backend** (packages/backend/src/types/organization.types.ts): Uses camelCase field names
  - `enabledCapabilities`
  - `displayName`
  - `createdAt`
  - `organizationTypeId`

- **Frontend** (packages/admin/src/types/admin.types.ts): Was using snake_case field names
  - `enabled_capabilities`
  - `display_name`
  - `created_at`
  - `organization_type_id`

This caused `org.enabled_capabilities` to be undefined, leading to the error when trying to access `.length`.

## Solution
Updated the frontend Organization type definition and OrganizationList component to use camelCase field names matching the backend:

### 1. Updated Organization Type (`packages/admin/src/types/admin.types.ts`)
Changed from snake_case to camelCase:
```typescript
export interface Organization {
  id: string;
  organizationTypeId: string;        // was: organization_type_id
  name: string;
  displayName: string;               // was: display_name
  domain?: string;
  status: 'active' | 'inactive' | 'blocked';
  enabledCapabilities: string[];     // was: enabled_capabilities
  currency?: string;
  language?: string;
  createdAt: string;                 // was: created_at
  updatedAt: string;                 // was: updated_at
  createdBy?: string;                // was: created_by
  updatedBy?: string;                // was: updated_by
}
```

### 2. Updated OrganizationList Component (`packages/admin/src/components/OrganizationList.tsx`)
Changed field references to use camelCase:
- `org.display_name` → `org.displayName`
- `org.enabled_capabilities` → `org.enabledCapabilities`
- `org.created_at` → `org.createdAt`

Added optional chaining for safety:
- `org.enabledCapabilities?.length || 0`

## Files Modified
1. `packages/admin/src/types/admin.types.ts` - Updated Organization interface
2. `packages/admin/src/components/OrganizationList.tsx` - Updated field references

## Testing
After these changes:
1. Navigate to Organization Types in Super Admin UI
2. Click on any organization type with organizations
3. The page should now display correctly with the organizations table
4. No console errors should appear

## Technical Notes
- The backend consistently uses camelCase for all field names in the API responses
- The frontend should always match the backend's data format
- Added optional chaining (`?.`) as a defensive measure against undefined values
- No backend changes were required as it was already correct
