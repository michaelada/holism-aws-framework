# Remove Mandatory Property from Field Definitions - Summary

## Overview

Successfully removed the `mandatory` property from `FieldDefinition` interface. The `mandatory` property now only exists at the `ObjectFieldReference` level, where it belongs conceptually - when a field is assigned to an object definition.

## Rationale

The `mandatory` property should not be part of the field definition itself, as whether a field is mandatory or optional is determined when the field is assigned to a specific object definition, not when the field is defined. This change makes the data model more flexible and semantically correct.

## Changes Made

### 1. Type Definitions Updated

**Files Modified:**
- `packages/backend/src/types/metadata.types.ts`
- `packages/components/src/types/metadata.types.ts`

**Change:**
Removed `mandatory: boolean` from `FieldDefinition` interface.

**Before:**
```typescript
export interface FieldDefinition {
  shortName: string;
  displayName: string;
  description: string;
  datatype: FieldDatatype;
  datatypeProperties: Record<string, any>;
  mandatory: boolean;  // REMOVED
  validationRules?: ValidationRule[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

**After:**
```typescript
export interface FieldDefinition {
  shortName: string;
  displayName: string;
  description: string;
  datatype: FieldDatatype;
  datatypeProperties: Record<string, any>;
  validationRules?: ValidationRule[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

**Note:** `ObjectFieldReference` still has `mandatory: boolean` - this is correct!

### 2. Database Migration

**File Created:**
- `packages/backend/migrations/1707000000001_remove-field-mandatory.js`

**Migration:**
```sql
ALTER TABLE field_definitions DROP COLUMN mandatory;
```

**Status:** Migration successfully applied to database.

### 3. Backend Service Updated

**File Modified:**
- `packages/backend/src/services/metadata.service.ts`

**Changes:**
- Removed `mandatory` from all SQL queries for field_definitions table
- Removed `mandatory` from `registerField()` INSERT statement
- Removed `mandatory` from `getAllFields()` SELECT statement
- Removed `mandatory` from `getFieldByShortName()` SELECT statement
- Removed `mandatory` from `updateField()` UPDATE statement
- Removed `mandatory` from `mapFieldRow()` mapping function

### 4. Validation Service Updated

**File Modified:**
- `packages/backend/src/services/validation.service.ts`

**Changes:**
- Updated `buildFieldSchema()` to no longer check `field.mandatory`
- All field schemas are now optional by default
- Updated `buildObjectSchema()` to apply mandatory constraint from `ObjectFieldReference.mandatory` instead of `FieldDefinition.mandatory`

**Before:**
```typescript
const fieldWithOverride: FieldDefinition = {
  ...field,
  mandatory: fieldRef.mandatory
};
shape[field.shortName] = this.buildFieldSchema(fieldWithOverride);
```

**After:**
```typescript
let fieldSchema = this.buildFieldSchema(field);
if (fieldRef.mandatory) {
  fieldSchema = fieldSchema.required(`${field.displayName} is required`);
}
shape[field.shortName] = fieldSchema;
```

### 5. Frontend UI Updated

**File Modified:**
- `packages/frontend/src/pages/FieldDefinitionsPage.tsx`

**Changes:**
- Removed `mandatory` from form data state
- Removed "Mandatory" dropdown from create/edit dialog
- Removed "Mandatory" column from field definitions table
- Updated table colspan from 6 to 5

**UI Changes:**
- Field definitions page no longer shows or allows setting mandatory property
- Users now set mandatory when assigning fields to objects (in ObjectDefinitionsPage)

### 6. Test Data Generator Updated

**File Modified:**
- `scripts/generate-test-data.ts`

**Changes:**
- Removed `mandatory: boolean` from `FieldDefinition` interface
- Removed all `mandatory` properties from field definition objects
- Object definitions still correctly specify `mandatory` in field assignments

### 7. Test Files Updated

**Files Modified:**
- All test files in `packages/backend/src/__tests__/services/`
- Removed `mandatory` property from all `FieldDefinition` test objects
- Updated test assertions to not check `field.mandatory`
- Fixed validation service test to reflect new behavior (fields are optional by default)

## Test Results

All tests passing:
- ✅ Backend tests: 211 passed
- ✅ Components tests: 122 passed (24 test files)
- ✅ Frontend tests: 16 passed (3 test files)
- **Total: 349 tests passed**

## Behavior Changes

### Field Definition Creation
**Before:** Users had to specify if a field was mandatory when creating the field definition.

**After:** Users only specify field properties (name, type, validation rules). Mandatory is not set at this level.

### Object Definition Creation
**Before:** Users could override the field's mandatory setting when assigning it to an object.

**After:** Users specify mandatory when assigning the field to an object (this is the only place it's set).

### Validation
**Before:** Field schemas included mandatory constraint from field definition, which could be overridden at object level.

**After:** Field schemas are optional by default. Mandatory constraint is applied only at the object field reference level.

## Backward Compatibility

**Breaking Change:** This is a breaking change for:
1. Existing code that reads `field.mandatory`
2. Database schema (column removed)
3. API contracts expecting `mandatory` in field definitions

**Migration Path:**
1. Run database migration: `npm run migrate:up` in packages/backend
2. Update any custom code that references `field.mandatory`
3. Regenerate test data: `npm run generate-test-data`

## Benefits

1. **Clearer semantics:** Mandatory is a property of how a field is used in an object, not an intrinsic property of the field itself
2. **More flexible:** The same field can be mandatory in one object and optional in another
3. **Simpler field definitions:** Field definitions are now purely about the field's data type and validation rules
4. **Better separation of concerns:** Field definition vs. field usage are now clearly separated

## Next Steps

To use the updated system:

1. **Create field definitions** without specifying mandatory:
   ```typescript
   {
     shortName: 'email',
     displayName: 'Email Address',
     datatype: 'email',
     datatypeProperties: {}
   }
   ```

2. **Assign fields to objects** and specify mandatory at that level:
   ```typescript
   {
     shortName: 'customer',
     fields: [
       { fieldShortName: 'email', mandatory: true, order: 1 }
     ]
   }
   ```

3. **Validation** will automatically enforce mandatory constraints based on the object field reference.
