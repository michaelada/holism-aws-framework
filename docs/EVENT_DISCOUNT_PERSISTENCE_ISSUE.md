# Event Discount Persistence Issue - RESOLVED

## Issue
When editing an event and selecting discounts to apply, the discounts were not persisted. When the user returned to edit the event, the previously selected discounts were not shown as selected.

## Root Cause
The discount selection feature was implemented in the frontend but the backend persistence layer was incomplete:

1. **Frontend Implementation (Complete)**:
   - `EventFormData` interface includes `discountIds?: string[]` field
   - `DiscountSelector` component allows selecting discounts
   - Form data includes the selected discount IDs

2. **Backend Implementation (Was Incomplete, Now Fixed)**:
   - ✅ Added `discount_ids` JSONB column to `events` table
   - ✅ Updated `Event` interface to include `discountIds?: string[]` field
   - ✅ Updated `CreateEventDto` and `UpdateEventDto` to include `discountIds?: string[]`
   - ✅ Updated `CREATE` SQL query to save discount IDs
   - ✅ Updated `UPDATE` SQL query to save discount IDs
   - ✅ Updated `rowToEvent()` method to parse discount IDs from database
   - ✅ Updated event routes to pass discount IDs from request body

## Implementation Details

### 1. Database Schema
Added JSONB column to store discount IDs as an array:

```sql
-- Migration: packages/backend/src/migrations/add-event-discount-ids.sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_events_discount_ids ON events USING GIN (discount_ids);
COMMENT ON COLUMN events.discount_ids IS 'Array of discount IDs that apply to this event';
```

### 2. Backend Service Updates

**File: `packages/backend/src/services/event.service.ts`**

- Updated `Event` interface to include `discountIds?: string[]`
- Updated `CreateEventDto` to include `discountIds?: string[]`
- Updated `UpdateEventDto` to include `discountIds?: string[]`
- Updated `createEvent()` method to save discount IDs as JSON
- Updated `updateEvent()` method to save discount IDs as JSON
- Updated `rowToEvent()` method to parse discount IDs from database

### 3. API Route Updates

**File: `packages/backend/src/routes/event.routes.ts`**

- Updated POST `/events` route to pass `discountIds` from request body
- Updated PUT `/events/:id` route to pass `discountIds` from request body

## Testing

To verify the fix works:

1. Create a new event and select discounts
2. Save the event
3. Navigate away and return to edit the event
4. Verify the previously selected discounts are shown as selected
5. Change the discount selection
6. Save and verify the changes persist

## Related Files
- Frontend: `packages/orgadmin-events/src/pages/CreateEventPage.tsx`
- Frontend Types: `packages/orgadmin-events/src/types/event.types.ts`
- Backend Service: `packages/backend/src/services/event.service.ts`
- Backend Routes: `packages/backend/src/routes/event.routes.ts`
- Component: `packages/components/src/components/discount/DiscountSelector.tsx`
- Migration: `packages/backend/src/migrations/add-event-discount-ids.sql`

## Status
✅ **RESOLVED** - All backend changes implemented and migration applied successfully.
