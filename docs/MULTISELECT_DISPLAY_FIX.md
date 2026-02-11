# Multi-Select Field Display Fix

## Issue

Multi-select fields were displaying as `[Object Object]` in table views instead of showing their actual values.

## Root Cause

The `formatCellValue` function in both `MetadataTable` and `VirtualizedMetadataTable` components was not properly handling multi-select values when they were stored as objects (e.g., JSONB from PostgreSQL database).

The original code:
```typescript
case 'multi_select':
  return Array.isArray(value) ? value.join(', ') : String(value);
```

When `value` was an object, `String(value)` would convert it to `[Object Object]`.

## Solution

Updated the `formatCellValue` function in both components to properly handle different value types:

```typescript
case 'multi_select':
  if (Array.isArray(value)) {
    return value.join(', ');
  } else if (typeof value === 'object') {
    // Handle object case (e.g., JSONB from database)
    return JSON.stringify(value);
  } else {
    return String(value);
  }
```

Also added object handling to the default case to prevent `[Object Object]` display for any other field types:

```typescript
default:
  // Handle any other object types
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
```

## Files Modified

1. `packages/components/src/components/MetadataTable/MetadataTable.tsx`
2. `packages/components/src/components/MetadataTable/VirtualizedMetadataTable.tsx`

## Testing

All tests pass (122 tests):
- Unit tests: ✓
- Property-based tests: ✓
- Integration tests: ✓

## Behavior

Now multi-select fields will display correctly:
- **Array values**: Joined with comma-space separator (e.g., "Option1, Option2, Option3")
- **Object values**: JSON stringified (e.g., `{"key": "value"}`)
- **Primitive values**: Converted to string as before

This ensures that regardless of how the data is stored in the database, it will be displayed in a readable format in the table view.
