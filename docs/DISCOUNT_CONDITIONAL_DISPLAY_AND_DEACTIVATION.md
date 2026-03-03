# Discount Conditional Display and Deactivation Protection

## Overview
Implemented two improvements to the discount system:
1. Hide discount selector when no active discounts are available
2. Prevent deactivation of discounts that are currently in use

## Problem 1: Discount Selector Always Visible
The discount selector was always displayed in the Create/Edit Event and Activity screens, even when there were no active discounts available. This created unnecessary UI clutter and confusion for users.

## Solution 1: Conditional Display
Added conditional rendering to only show the discount selector when there are active discounts available.

### Implementation

**Event Page** (`CreateEventPage.tsx`):
```typescript
{/* Discount Selection */}
{discounts.length > 0 && (
  <Grid item xs={12}>
    <DiscountSelector
      discounts={discounts}
      selectedDiscounts={formData.discountIds || []}
      onChange={(discountIds) => handleChange('discountIds', discountIds)}
      multiSelect={true}
      disabled={loading}
      label="Apply Discounts to Event"
      loading={loadingDiscounts}
    />
  </Grid>
)}
```

**Activity Form** (`EventActivityForm.tsx`):
```typescript
{/* Discount Selection */}
{discounts.length > 0 && (
  <Grid item xs={12}>
    <DiscountSelector
      discounts={discounts}
      selectedDiscounts={activity.discountIds || []}
      onChange={(discountIds) => handleChange('discountIds', discountIds)}
      multiSelect={true}
      disabled={loading}
      label="Apply Discounts to Activity"
      loading={loadingDiscounts}
    />
  </Grid>
)}
```

## Problem 2: Deactivating In-Use Discounts
Users could deactivate discounts that were currently being used by events or activities, which could cause issues with pricing calculations and user expectations.

## Solution 2: Deactivation Protection
Added backend validation to prevent deactivating discounts that are currently in use by any events or activities.

### Implementation

**Backend Service** (`discount.service.ts`):

Added `isDiscountInUse` method:
```typescript
/**
 * Check if a discount is currently in use by any events or activities
 */
async isDiscountInUse(discountId: string): Promise<boolean> {
  try {
    // Check if discount is referenced in events table
    const eventCheck = await db.query(
      `SELECT COUNT(*) as count FROM events 
       WHERE discount_ids @> $1::jsonb`,
      [JSON.stringify([discountId])]
    );

    if (parseInt(eventCheck.rows[0].count, 10) > 0) {
      return true;
    }

    // Check if discount is referenced in event_activities table
    const activityCheck = await db.query(
      `SELECT COUNT(*) as count FROM event_activities 
       WHERE discount_ids @> $1::jsonb`,
      [JSON.stringify([discountId])]
    );

    return parseInt(activityCheck.rows[0].count, 10) > 0;
  } catch (error) {
    logger.error('Error checking if discount is in use:', error);
    throw error;
  }
}
```

Updated `update` method to check before deactivation:
```typescript
if (data.status !== undefined) {
  // Check if trying to deactivate a discount that's in use
  if (data.status === 'inactive' && existing.status === 'active') {
    const isInUse = await this.isDiscountInUse(id);
    if (isInUse) {
      throw new Error('Cannot deactivate discount that is currently in use by events or activities');
    }
  }
  updates.push(`status = $${paramIndex++}`);
  values.push(data.status);
}
```

### Database Migration
Created migration to add `discount_ids` column to `event_activities` table:

**File**: `packages/backend/src/migrations/add-activity-discount-ids.sql`
```sql
-- Add discount_ids column as JSONB array
ALTER TABLE event_activities ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient querying of discount IDs
CREATE INDEX IF NOT EXISTS idx_event_activities_discount_ids ON event_activities USING GIN (discount_ids);

-- Add comment for documentation
COMMENT ON COLUMN event_activities.discount_ids IS 'Array of discount IDs that apply to this activity';
```

## User Experience

### Before - Discount Selector
- Discount selector always visible, even with no discounts
- Created UI clutter
- Confused users about discount availability

### After - Discount Selector
- Discount selector only appears when active discounts exist
- Cleaner UI when no discounts are available
- Clear indication that discounts are available when selector is shown

### Before - Deactivation
- Users could deactivate any discount
- Could break pricing for events/activities using the discount
- No warning or prevention

### After - Deactivation
- System checks if discount is in use before allowing deactivation
- Clear error message: "Cannot deactivate discount that is currently in use by events or activities"
- Users must remove discount from all events/activities before deactivating
- Protects data integrity and pricing consistency

## Technical Details

### Conditional Rendering Logic
- Checks `discounts.length > 0` before rendering the DiscountSelector component
- Works for both event-level and activity-level discount selectors
- Maintains all existing functionality when discounts are available

### Deactivation Check Logic
1. User attempts to change discount status from 'active' to 'inactive'
2. Backend calls `isDiscountInUse(discountId)` method
3. Method queries both `events` and `event_activities` tables
4. Uses JSONB containment operator (`@>`) for efficient searching
5. Returns true if discount ID found in any record
6. Throws error if discount is in use, preventing the update

### Database Queries
The `isDiscountInUse` method uses PostgreSQL's JSONB containment operator for efficient querying:

```sql
-- Check events table
SELECT COUNT(*) as count FROM events 
WHERE discount_ids @> '["discount-id"]'::jsonb

-- Check event_activities table
SELECT COUNT(*) as count FROM event_activities 
WHERE discount_ids @> '["discount-id"]'::jsonb
```

The GIN indexes on `discount_ids` columns ensure these queries are performant even with large datasets.

## Files Modified

### Frontend
- `packages/orgadmin-events/src/pages/CreateEventPage.tsx` - Added conditional rendering for discount selector
- `packages/orgadmin-events/src/components/EventActivityForm.tsx` - Added conditional rendering for discount selector

### Backend
- `packages/backend/src/services/discount.service.ts` - Added `isDiscountInUse` method and deactivation check
- `packages/backend/src/migrations/add-activity-discount-ids.sql` - New migration for activity discount IDs

## Testing Recommendations

### Conditional Display
1. Create an organization with no discounts
2. Create/edit an event - verify discount selector is not shown
3. Create an active discount
4. Create/edit an event - verify discount selector is now shown
5. Create/edit an activity - verify same behavior

### Deactivation Protection
1. Create an active discount
2. Create an event and apply the discount
3. Try to deactivate the discount - verify error message is shown
4. Remove discount from the event
5. Try to deactivate the discount - verify it succeeds
6. Repeat with activity-level discounts

## Benefits

### User Experience
- Cleaner UI when no discounts are available
- Clear feedback when trying to deactivate in-use discounts
- Prevents accidental data integrity issues

### Data Integrity
- Ensures pricing consistency for events and activities
- Prevents orphaned discount references
- Maintains referential integrity without foreign key constraints

### Performance
- GIN indexes ensure efficient discount usage queries
- Conditional rendering reduces unnecessary component rendering
- Minimal performance impact on discount updates

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Discount Removal**: Add UI to help users remove a discount from all events/activities before deactivation
2. **Usage Count Display**: Show how many events/activities use each discount
3. **Cascade Options**: Allow users to choose whether to remove discount from all items when deactivating
4. **Audit Trail**: Log when deactivation attempts are blocked and by whom
5. **Grace Period**: Allow setting a discount to "expiring" status before full deactivation
