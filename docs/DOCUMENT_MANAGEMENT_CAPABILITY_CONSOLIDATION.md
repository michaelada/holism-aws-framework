# Document Management Capability Consolidation

## Overview

This document describes the consolidation of three separate document management capabilities into a single unified capability.

## Changes

### Before
- `membership-document-management` - Membership Document Management
- `event-document-management` - Event Document Management  
- `registration-document-management` - Registration Document Management

### After
- `document-management` - Document Management (unified capability for all modules)

## Migration

A database migration has been created to consolidate the capabilities:

**Migration File**: `packages/backend/migrations/1707000000024_consolidate-document-management-capabilities.js`

### Running the Migration

To apply the migration to your database:

```bash
cd packages/backend
npm run migrate:up
```

This will:
1. Create the new `document-management` capability
2. Migrate all organizations that had any of the old capabilities to have `document-management`
3. Migrate organization type default capabilities similarly
4. Remove the three old capability records from the database

### Rollback

If you need to rollback the migration:

```bash
cd packages/backend
npm run migrate:down
```

This will restore the three original capabilities and reverse all changes.

### Verification

After running the migration, you can verify the changes:

```sql
-- Check that the new capability exists
SELECT name, display_name, description, category 
FROM capabilities 
WHERE name = 'document-management';

-- Check that old capabilities are gone
SELECT name, display_name 
FROM capabilities 
WHERE name IN ('membership-document-management', 'event-document-management', 'registration-document-management');
-- Should return 0 rows

-- Check organizations with the new capability
SELECT id, name, enabled_capabilities 
FROM organizations 
WHERE enabled_capabilities::jsonb ? 'document-management';

-- Verify no organizations have old capabilities
SELECT id, name, enabled_capabilities 
FROM organizations 
WHERE enabled_capabilities::jsonb ? 'membership-document-management'
   OR enabled_capabilities::jsonb ? 'event-document-management'
   OR enabled_capabilities::jsonb ? 'registration-document-management';
-- Should return 0 rows
```

## Impact

### Super Admin UI

After running the migration, the Super Admin UI will display:
- ✅ Single "Document Management" capability option
- ❌ No more separate "Membership Document Management", "Event Document Management", or "Registration Document Management" options

### Organization Admin UI

The form builder will:
- Show file/image field types only when the organization has the `document-management` capability
- Hide file/image field types when the capability is not present
- Preserve existing document upload fields (they continue to work)

### Backend API

The backend enforces:
- HTTP 403 error when attempting to create/update file or image fields without the `document-management` capability
- Validation middleware on field creation and update endpoints

## Testing

All tests have been implemented and pass:
- ✅ 232 tests for the capability consolidation feature
- ✅ Migration property tests (100 iterations each)
- ✅ Frontend capability filtering tests
- ✅ Backend validation tests
- ✅ Data preservation tests
- ✅ Integration tests

## Files Modified

### Backend
- `packages/backend/migrations/1707000000024_consolidate-document-management-capabilities.js` (new)
- `packages/backend/src/middleware/field-capability.middleware.ts` (new)
- `packages/backend/src/routes/metadata.routes.ts` (modified)

### Frontend
- `packages/orgadmin-core/src/forms/hooks/useFilteredFieldTypes.ts` (new)
- `packages/orgadmin-core/src/forms/pages/CreateFieldPage.tsx` (modified)
- `packages/orgadmin-core/src/forms/pages/EditFieldPage.tsx` (modified)

### Tests
- Multiple test files for property-based testing, unit testing, and integration testing

## Notes

- The migration is idempotent and can be run multiple times safely
- Existing document upload fields are preserved and continue to work
- Organizations that had any of the old capabilities will automatically get the new unified capability
- The rollback migration is available if needed
