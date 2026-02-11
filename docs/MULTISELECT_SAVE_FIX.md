# Multi-Select Field Save Error Fix

## Issue

When editing an object instance and selecting two values in a multi-select field, clicking save resulted in errors:
1. First error: "multiple assignments to same column 'updated_at'"
2. After fixing that: "invalid input syntax for type json"

## Root Causes

### Issue 1: Multiple Assignments to updated_at

When the frontend loaded an existing instance for editing, it included all fields including system fields like `id`, `created_at`, `updated_at`, etc. When the form was submitted, these system fields were included in the update data. The UPDATE query was then trying to set `updated_at` both from the data AND explicitly with `updated_at = CURRENT_TIMESTAMP`, causing PostgreSQL to throw an error.

### Issue 2: Invalid JSON Syntax for Multi-Select

Multi-select fields are stored as JSONB in PostgreSQL. When the frontend sends an array like `["option1", "option2"]`, PostgreSQL's JSONB column expects it to be a JSON string. The backend wasn't converting the JavaScript array to a JSON string before inserting/updating.

## Solutions

### Solution 1: Filter System Fields

Modified both `updateInstance` and `createInstance` methods to filter out system fields before building queries:

```typescript
// Filter out system fields that shouldn't be updated
const systemFields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
const updateData = Object.keys(data)
  .filter(key => !systemFields.includes(key))
  .reduce((obj, key) => {
    obj[key] = data[key];
    return obj;
  }, {} as Record<string, any>);
```

### Solution 2: Convert Arrays to JSON for JSONB Columns

Added data processing to convert multi-select arrays to JSON strings:

```typescript
// Process data to handle special field types
const processedData = Object.keys(data).reduce((obj, key) => {
  const field = fieldDefinitions.find(f => f.shortName === key);
  let value = data[key];
  
  // Convert arrays to JSON for JSONB columns (multi_select fields)
  if (field && field.datatype === 'multi_select' && Array.isArray(value)) {
    value = JSON.stringify(value);
  }
  
  obj[key] = value;
  return obj;
}, {} as Record<string, any>);
```

## Files Modified

1. `packages/backend/src/services/generic-crud.service.ts`
   - Added system field filtering in `updateInstance` method
   - Added multi-select array to JSON conversion in both `createInstance` and `updateInstance` methods

## Testing

All 211 backend tests pass successfully.

To verify the fix:
1. Navigate to an object instance edit page
2. Select multiple values in a multi-select field
3. Click Save
4. The instance should save successfully without errors
5. The multi-select values should be properly stored and displayed

## Impact

This fix ensures that:
- All instance updates work correctly, not just multi-select fields
- System fields are never accidentally updated
- Multi-select fields are properly stored as JSONB in PostgreSQL
- Both create and update operations handle multi-select fields correctly
