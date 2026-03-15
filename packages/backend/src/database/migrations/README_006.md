# Migration 006: Initialize Membership Number Sequences

## Overview

This migration initializes the `membership_number_sequences` table with appropriate starting values for existing organizations that use internal membership numbering.

## Purpose

When implementing the membership numbering configuration feature, existing organizations need their sequences initialized to prevent duplicate membership numbers. This migration:

1. Finds the highest existing membership number for each organization
2. Sets the `next_number` to that value + 1
3. Falls back to the configured `initial_membership_number` if no members exist
4. Handles both organization-level and organization type-level uniqueness scopes

## Requirements

- **Requirement 6.1**: Existing organization types default to internal numbering
- **Requirement 6.2**: Existing members retain their numbers; new rules apply to new members

## Migration Logic

### Organization-Level Uniqueness

For organizations with `membership_number_uniqueness = 'organization'`:

```sql
INSERT INTO membership_number_sequences (organization_type_id, organization_id, next_number)
SELECT 
  o.organization_type_id,
  o.id as organization_id,
  COALESCE(
    (SELECT MAX(...) + 1 FROM members WHERE organisation_id = o.id),
    COALESCE(ot.initial_membership_number, 1000000)
  )
FROM organizations o
JOIN organization_types ot ON ot.id = o.organization_type_id
WHERE ot.membership_numbering = 'internal'
  AND ot.membership_number_uniqueness = 'organization'
```

**Result**: One sequence record per organization, with `organization_id` set.

### Organization Type-Level Uniqueness

For organizations with `membership_number_uniqueness = 'organization_type'`:

```sql
INSERT INTO membership_number_sequences (organization_type_id, organization_id, next_number)
SELECT 
  ot.id as organization_type_id,
  NULL as organization_id,
  COALESCE(
    (SELECT MAX(...) + 1 FROM members m JOIN organizations o ...),
    COALESCE(ot.initial_membership_number, 1000000)
  )
FROM organization_types ot
WHERE ot.membership_numbering = 'internal'
  AND ot.membership_number_uniqueness = 'organization_type'
```

**Result**: One sequence record per organization type, with `organization_id = NULL`.

## Number Extraction Logic

The migration handles various membership number formats:

1. **Purely numeric** (e.g., `1000000`): Used directly
2. **Prefixed** (e.g., `PREFIX-1000`): Extracts numeric portion (`1000`)
3. **Mixed format** (e.g., `ORG-2024-123`): Extracts all digits (`2024123`)
4. **Non-numeric** (e.g., `ABC`): Ignored, uses default

### Regex Patterns

- `^\d+$`: Matches purely numeric strings
- `\d+`: Matches strings containing at least one digit
- `REGEXP_REPLACE(membership_number, '[^\d]', '', 'g')`: Extracts all digits

## Default Values

The migration uses a cascading default strategy:

1. **Highest existing number + 1**: If numeric membership numbers exist
2. **Configured initial_membership_number**: From `organization_types.initial_membership_number`
3. **Hardcoded default (1000000)**: If no configuration exists

## Conflict Handling

The migration uses `ON CONFLICT (organization_type_id, organization_id) DO NOTHING` to:

- Allow safe re-running of the migration
- Preserve manually adjusted sequence values
- Prevent overwriting existing sequences

## Rollback

The rollback migration (`006_initialize_membership_number_sequences_rollback.sql`) removes all sequence records:

```sql
DELETE FROM membership_number_sequences;
```

**Note**: Rollback is safe as it only removes sequence tracking, not actual member data.

## Testing

### Unit Tests

Location: `src/__tests__/migrations/sequence-initialization.test.ts`

Tests cover:
- Numeric extraction logic
- Default value handling
- Regex pattern matching
- Edge cases (large numbers, leading zeros, etc.)
- COALESCE logic
- ON CONFLICT behavior

### Integration Tests

Location: `src/__tests__/migrations/sequence-initialization-integration.test.ts`

Tests cover:
- SQL logic validation
- Real-world migration scenarios
- Conflict handling
- Uniqueness scope handling
- Organization type filtering

## Running the Migration

### Forward Migration

```bash
# Apply the migration
psql -d aws_framework -f packages/backend/src/database/migrations/006_initialize_membership_number_sequences.sql
```

### Rollback

```bash
# Rollback the migration
psql -d aws_framework -f packages/backend/src/database/migrations/006_initialize_membership_number_sequences_rollback.sql
```

## Verification

After running the migration, verify the results:

```sql
-- Check sequences were created
SELECT 
  mns.organization_type_id,
  mns.organization_id,
  mns.next_number,
  ot.name as org_type_name
FROM membership_number_sequences mns
JOIN organization_types ot ON ot.id = mns.organization_type_id
ORDER BY ot.name, mns.organization_id;

-- Verify next_number is higher than existing membership numbers
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  MAX(CAST(m.membership_number AS INTEGER)) as highest_member_number,
  mns.next_number as sequence_next_number,
  (mns.next_number > MAX(CAST(m.membership_number AS INTEGER))) as is_valid
FROM organizations o
JOIN members m ON m.organisation_id = o.id
JOIN membership_number_sequences mns ON mns.organization_id = o.id
WHERE m.membership_number ~ '^\d+$'
GROUP BY o.id, o.name, mns.next_number;
```

## Edge Cases Handled

1. **Empty organizations**: Uses configured or default initial number
2. **Non-numeric membership numbers**: Ignored, uses default
3. **Mixed format numbers**: Extracts numeric portion
4. **Gaps in numbering**: Continues from highest, doesn't fill gaps
5. **Legacy formats**: Extracts all digits and uses as numeric value
6. **Very large numbers**: Handles integers up to PostgreSQL's INTEGER limit
7. **Duplicate migration runs**: ON CONFLICT prevents overwrites

## Dependencies

This migration depends on:
- Migration 004: `organization_types` table with new columns
- Migration 005: `membership_number_sequences` table creation
- Existing `organizations` and `members` tables

## Impact

- **Data modification**: Inserts new records into `membership_number_sequences`
- **Performance**: O(n) where n = number of organizations (typically fast)
- **Downtime**: None required (read-only queries on existing data)
- **Reversibility**: Fully reversible via rollback script

## Notes

- This migration is idempotent (safe to run multiple times)
- Existing member records are not modified
- Sequence values can be manually adjusted after migration if needed
- External numbering mode organizations are skipped (no sequences created)
