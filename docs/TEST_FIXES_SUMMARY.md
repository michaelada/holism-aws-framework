# Test Fixes Summary

## Problem
36 tests were failing with database schema errors after implementing the separate test database. The main issues were:

1. **Schema Mismatch**: The test database setup script was creating tables with incorrect schema - using `field_short_name` instead of `field_id` in the `object_fields` table
2. **Jest Setup File**: The `jest.setup.ts` file was being treated as a test file and failing because it contained no tests
3. **Module Syntax**: The jest setup file was using ES6 import syntax which Jest couldn't parse in setup files
4. **Auth Middleware Tests**: Tests were failing because they didn't explicitly disable the `DISABLE_AUTH` environment variable

## Root Cause
The test database setup script (`packages/backend/scripts/setup-test-db.sh`) was manually creating tables with an outdated schema that didn't match the actual migration files. The code expected:
- `object_fields.field_id` (UUID foreign key to `field_definitions.id`)

But the test database had:
- `object_fields.field_short_name` (VARCHAR field name)

This caused all queries joining `object_fields` with `field_definitions` to fail with "column 'field_id' does not exist" errors.

## Solution

### 1. Fixed Test Database Schema
Updated `packages/backend/scripts/setup-test-db.sh` to create tables matching the actual migration schema:

**Key Changes:**
- Changed `field_short_name VARCHAR(255)` to `field_id UUID` with proper foreign key constraint
- Changed `field_order INTEGER` to `display_order INTEGER` to match code expectations
- Added proper `REFERENCES field_definitions(id) ON DELETE RESTRICT` constraint
- Fixed all column types and constraints to match `migrations/1707000000000_create-metadata-tables.js`
- Removed the `mandatory` column from `field_definitions` (per migration 1707000000001)

### 2. Fixed Jest Setup File
- Renamed `src/__tests__/jest.setup.ts` to `src/__tests__/jest.setup.js`
- Converted ES6 imports to CommonJS `require()` syntax
- Updated `jest.config.js` to reference the new `.js` file

### 3. Fixed Auth Middleware Tests
Added explicit cleanup of `DISABLE_AUTH` environment variable in test setup:
```typescript
beforeEach(() => {
  // ... other setup
  delete process.env.DISABLE_AUTH;
});
```

### 4. Recreated Test Database
Dropped and recreated the test database with correct schema:
```bash
PGPASSWORD="framework_password" psql -h localhost -p 5432 -U framework_user -d aws_framework_test \
  -c "DROP TABLE IF EXISTS object_fields CASCADE; DROP TABLE IF EXISTS object_definitions CASCADE; DROP TABLE IF EXISTS field_definitions CASCADE;"

bash packages/backend/scripts/setup-test-db.sh
```

## Results
✅ All 211 tests now pass
✅ Test database properly isolated from development database
✅ Schema matches production migration files
✅ No data loss in development database

## Files Modified
1. `packages/backend/scripts/setup-test-db.sh` - Fixed schema creation
2. `packages/backend/src/__tests__/jest.setup.js` - Renamed and converted to CommonJS
3. `packages/backend/jest.config.js` - Updated setup file reference
4. `packages/backend/src/middleware/__tests__/auth.middleware.test.ts` - Added DISABLE_AUTH cleanup

## Test Output
```
Test Suites: 20 passed, 20 total
Tests:       211 passed, 211 total
Snapshots:   0 total
Time:        7.045 s
```

## Lessons Learned
1. Always use actual migration files as the source of truth for schema
2. Test database setup should mirror production schema exactly
3. Jest setup files must use CommonJS syntax, not ES6 modules
4. Environment variables can leak between tests and must be explicitly cleaned up
