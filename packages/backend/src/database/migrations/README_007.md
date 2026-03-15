# Migration 007: Rollback Membership Numbering Configuration

## Overview

This rollback migration completely reverses all database changes made by the membership numbering configuration feature, restoring the database to its state before the feature was implemented.

## Purpose

This migration provides a safe rollback path for the membership numbering configuration feature. It removes:

1. All sequence initialization data
2. The `membership_number_sequences` table
3. Configuration columns from `organization_types` table

**Critical**: This rollback preserves all existing member data and their membership numbers.

## Requirements

- **Requirement NFR4**: Backward Compatibility - Existing functionality continues to work during migration

## What Gets Rolled Back

### 1. Sequence Initialization (Migration 006)
- Deletes all records from `membership_number_sequences` table
- Removes sequence tracking for all organizations

### 2. Sequences Table (Migration 005)
- Drops indexes: `idx_sequences_org_type`, `idx_sequences_org`
- Drops table: `membership_number_sequences`
- Removes all foreign key constraints

### 3. Organization Types Columns (Migration 004/025)
- Drops constraints: `check_membership_numbering`, `check_membership_number_uniqueness`, `check_initial_membership_number`
- Drops columns: `membership_numbering`, `membership_number_uniqueness`, `initial_membership_number`

## What Gets Preserved

### Member Data (100% Preserved)
- All member records remain intact
- All membership numbers remain unchanged
- All member relationships preserved
- No data loss occurs

### Organization Data (100% Preserved)
- All organization records remain intact
- All organization type records remain intact (minus the three configuration columns)
- All relationships preserved

## Safety Guarantees

1. **Idempotent**: Safe to run multiple times
2. **No Data Loss**: Member data and membership numbers preserved
3. **Proper Cleanup**: All constraints and indexes removed before tables/columns
4. **Cascade Handling**: Foreign key constraints properly handled with CASCADE
5. **IF EXISTS Checks**: Prevents errors if objects already removed

## Rollback Order

The migration follows the correct dependency order:

```
1. DELETE sequence data (no dependencies)
   ↓
2. DROP indexes (depend on table)
   ↓
3. DROP sequences table (depends on indexes)
   ↓
4. DROP constraints (depend on columns)
   ↓
5. DROP columns (depend on constraints)
```

## Running the Rollback

### Using psql

```bash
# Connect to database and run rollback
psql -d aws_framework -f packages/backend/src/database/migrations/007_rollback_membership_numbering_configuration.sql
```

### Using node-pg-migrate

The rollback is also available via the `down` function in the node-pg-migrate migration file:

```bash
# Rollback using node-pg-migrate
npm run migrate down 1707000000025
```

## Verification

After running the rollback, verify the changes:

### 1. Verify Sequences Table Removed

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'membership_number_sequences'
) as sequences_table_exists;
```

**Expected**: `false`

### 2. Verify Columns Removed

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'organization_types' 
AND column_name IN (
  'membership_numbering', 
  'membership_number_uniqueness', 
  'initial_membership_number'
);
```

**Expected**: 0 rows

### 3. Verify Member Data Preserved

```sql
-- Check member count unchanged
SELECT COUNT(*) as member_count FROM members;

-- Check membership numbers intact
SELECT id, membership_number, first_name, last_name 
FROM members 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected**: All members and membership numbers intact

### 4. Verify Constraints Removed

```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'organization_types' 
AND constraint_name IN (
  'check_membership_numbering',
  'check_membership_number_uniqueness',
  'check_initial_membership_number'
);
```

**Expected**: 0 rows

### 5. Verify Indexes Removed

```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'membership_number_sequences';
```

**Expected**: 0 rows (or error if table doesn't exist)

## Impact Analysis

### Database Changes
- **Tables Dropped**: 1 (`membership_number_sequences`)
- **Columns Dropped**: 3 (from `organization_types`)
- **Constraints Dropped**: 3 (check constraints)
- **Indexes Dropped**: 2
- **Data Deleted**: All sequence records

### Application Impact
- **Member Creation**: Will revert to previous membership number generation logic
- **Organization Type Management**: Configuration fields no longer available
- **Existing Members**: No impact - all data preserved
- **API Endpoints**: May need to handle missing columns gracefully

### Performance Impact
- **Rollback Duration**: < 1 second (typically)
- **Downtime Required**: None (but application should be stopped to prevent errors)
- **Database Locks**: Brief locks on `organization_types` table during column drops

## Rollback Scenarios

### Scenario 1: Feature Not Working as Expected
If the membership numbering configuration feature has issues, this rollback safely removes it while preserving all member data.

### Scenario 2: Testing/Development
In development environments, this rollback allows clean removal of the feature for testing purposes.

### Scenario 3: Production Rollback
In production, this rollback can be used if the feature needs to be removed, but coordination with application deployment is required.

## Post-Rollback Steps

After running the rollback:

1. **Update Application Code**: Remove or disable code that references the removed columns
2. **Restart Services**: Restart backend services to clear any cached schema information
3. **Verify Functionality**: Test member creation to ensure it works with previous logic
4. **Monitor Logs**: Check for any errors related to missing columns
5. **Update Documentation**: Mark the feature as rolled back in documentation

## Re-applying the Feature

If you need to re-apply the feature after rollback:

1. Run migration 004/025: Add columns to organization_types
2. Run migration 005: Create membership_number_sequences table
3. Run migration 006: Initialize sequences for existing organizations

```bash
# Re-apply using node-pg-migrate
npm run migrate up
```

## Dependencies

### Required Tables (Must Exist)
- `organization_types` (for column removal)
- `membership_number_sequences` (for table drop - created by migration 005)

### Optional Tables (Preserved)
- `members` (preserved, not modified)
- `organizations` (preserved, not modified)

## Testing

### Unit Tests
Location: `src/__tests__/migrations/membership-numbering-configuration-migration.test.ts`

The test suite includes rollback validation:
- Verifies columns are removed
- Verifies constraints are removed
- Verifies data preservation

### Manual Testing Checklist
- [ ] Run rollback migration
- [ ] Verify sequences table dropped
- [ ] Verify columns removed from organization_types
- [ ] Verify member data preserved
- [ ] Verify membership numbers intact
- [ ] Test member creation with previous logic
- [ ] Verify no application errors

## Troubleshooting

### Error: Table "membership_number_sequences" does not exist
**Cause**: Table already dropped or never created  
**Solution**: Safe to ignore - rollback already complete for this part

### Error: Column "membership_numbering" does not exist
**Cause**: Columns already dropped or never created  
**Solution**: Safe to ignore - rollback already complete for this part

### Error: Constraint "check_membership_numbering" does not exist
**Cause**: Constraints already dropped or never created  
**Solution**: Safe to ignore - rollback already complete for this part

### Error: Cannot drop table due to dependent objects
**Cause**: Other objects depend on the sequences table  
**Solution**: Use CASCADE option (already included in script)

## Notes

- This rollback is **idempotent** - safe to run multiple times
- All `IF EXISTS` checks prevent errors on repeated runs
- Member data is **never modified** during rollback
- The rollback can be run on any environment (dev, staging, production)
- No manual data cleanup required after rollback
- The rollback completes in < 1 second typically

## Related Migrations

- **Migration 004/025**: `add-membership-numbering-configuration` (adds columns)
- **Migration 005**: `create_membership_number_sequences` (creates table)
- **Migration 006**: `initialize_membership_number_sequences` (populates data)
- **Migration 007**: `rollback_membership_numbering_configuration` (this rollback)

## References

- Requirements Document: `.kiro/specs/membership-numbering-configuration/requirements.md`
- Design Document: `.kiro/specs/membership-numbering-configuration/design.md`
- Tasks Document: `.kiro/specs/membership-numbering-configuration/tasks.md`
- NFR4: Backward Compatibility requirement
