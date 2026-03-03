# Event Soft Delete Implementation

## Overview
Implemented soft delete functionality for events, allowing events to be marked as deleted without actually removing data from the database. This preserves historical data while hiding deleted events from the UI.

## Database Changes

### Migration: `add-event-deleted-flag.sql`
Added three new columns to the `events` table:
- `deleted` (BOOLEAN, default FALSE): Flag indicating if event is deleted
- `deleted_at` (TIMESTAMP): When the event was deleted
- `deleted_by` (VARCHAR(255)): User ID who deleted the event

Created an index on the `deleted` column for efficient querying of non-deleted events.

## Backend Changes

### Event Service (`packages/backend/src/services/event.service.ts`)

#### Updated Interface
```typescript
export interface Event {
  // ... existing fields
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}
```

#### Modified Methods

1. **`getEventsByOrganisation()`**
   - Added `WHERE e.deleted = FALSE` filter to exclude deleted events from list
   - Only shows active (non-deleted) events to users

2. **`deleteEvent(id: string, deletedBy: string)`**
   - Changed from hard delete to soft delete
   - Updates `deleted = TRUE`, `deleted_at = NOW()`, and `deleted_by = $2`
   - Preserves all event data in database
   - Requires `deletedBy` parameter to track who deleted the event

3. **`rowToEvent()`**
   - Added mapping for `deleted`, `deletedAt`, and `deletedBy` fields

### Event Routes (`packages/backend/src/routes/event.routes.ts`)

Updated DELETE endpoint:
- Extracts `organisationUserId` from authenticated request
- Passes user ID to `deleteEvent()` method for audit trail
- Returns 400 error if user ID not found

## Frontend Changes

### Events List Page (`packages/orgadmin-events/src/pages/EventsListPage.tsx`)

#### New UI Components
1. **Delete Button**: Added delete icon button to each event row
2. **Confirmation Dialog**: Shows before deletion with event name
3. **State Management**: Added `deleteDialogOpen` and `eventToDelete` state

#### New Functions
- `handleDeleteClick(event)`: Opens confirmation dialog
- `handleDeleteConfirm()`: Executes delete API call and reloads list
- `handleDeleteCancel()`: Closes dialog without deleting

#### Imports Added
- `Dialog`, `DialogTitle`, `DialogContent`, `DialogContentText`, `DialogActions` from MUI
- `Delete as DeleteIcon` from MUI icons

### Translations (`packages/orgadmin-shell/src/locales/en-GB/translation.json`)

Added new translation keys:
```json
{
  "events": {
    "tooltips": {
      "delete": "Delete Event"
    },
    "deleteDialog": {
      "title": "Delete Event",
      "message": "Are you sure you want to delete \"{{eventName}}\"? This action will hide the event from the list but preserve all data."
    }
  }
}
```

## User Experience

1. User clicks delete icon on an event in the list
2. Confirmation dialog appears showing event name
3. User can cancel or confirm deletion
4. On confirmation:
   - Event is marked as deleted in database
   - Event disappears from the list
   - All event data is preserved for historical/audit purposes

## Benefits

1. **Data Preservation**: All event data remains in database for reporting and auditing
2. **Audit Trail**: Tracks who deleted the event and when
3. **Reversible**: Could implement "restore" functionality in future if needed
4. **Clean UI**: Deleted events don't clutter the events list
5. **Performance**: Index on `deleted` column ensures efficient queries

## Testing

To test the implementation:
1. Navigate to Events list page
2. Click delete icon on any event
3. Confirm deletion in dialog
4. Verify event disappears from list
5. Check database to confirm event still exists with `deleted = TRUE`

## Database Query Examples

### View all events (including deleted)
```sql
SELECT * FROM events WHERE organisation_id = 'org-id';
```

### View only deleted events
```sql
SELECT * FROM events WHERE organisation_id = 'org-id' AND deleted = TRUE;
```

### Restore a deleted event (if needed)
```sql
UPDATE events 
SET deleted = FALSE, deleted_at = NULL, deleted_by = NULL 
WHERE id = 'event-id';
```

## Future Enhancements

Potential improvements:
1. Add "Restore" functionality for admins
2. Add "Permanently Delete" option for super admins
3. Show deleted events in a separate "Trash" view
4. Auto-purge deleted events after X days/months
5. Add bulk delete functionality
