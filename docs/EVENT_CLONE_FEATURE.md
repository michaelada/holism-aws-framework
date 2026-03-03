# Event Clone Feature Implementation

## Overview
Added the ability to clone events with all their activities. When a user clones an event, a new copy is created with "(Copy)" appended to the name, and the user is immediately taken to the edit page to make any necessary changes.

## Implementation Details

### Backend Changes

#### 1. Event Service (`packages/backend/src/services/event.service.ts`)
Added `cloneEvent()` method that:
- Fetches the original event with all its activities
- Creates a new event with "(Copy)" appended to the name
- Clones all activities (without their IDs)
- Sets the cloned event status to 'draft'
- Returns the newly created event

Key features:
- No entries are copied (the cloned event is brand new)
- All event properties are copied (dates, settings, ticketing config, etc.)
- All activities are cloned with their full configuration
- Event type and venue associations are preserved

#### 2. Event Routes (`packages/backend/src/routes/event.routes.ts`)
Added new endpoint:
- `POST /api/orgadmin/events/:id/clone`
- Requires authentication and event-management capability
- Returns 201 with the cloned event on success
- Returns 404 if original event not found

### Frontend Changes

#### 1. Events List Page (`packages/orgadmin-events/src/pages/EventsListPage.tsx`)
Added clone functionality:
- Imported `ContentCopy` icon as `CloneIcon`
- Added `handleCloneEvent()` function that:
  - Calls the clone API endpoint
  - Navigates to the edit page of the cloned event
- Added clone button to the actions column in the events table

## User Flow

1. User views the events list
2. User clicks the clone icon (copy icon) next to an event
3. System creates a new event with:
   - Name: "[Original Name] (Copy)"
   - All original event settings and configuration
   - All activities cloned
   - Status: draft
   - No entries
4. User is automatically redirected to the edit page of the cloned event
5. User can modify dates, name, or any other settings as needed
6. User saves the cloned event

## Benefits

- Quick way to create similar events without re-entering all information
- Useful for recurring events (e.g., annual conferences, monthly meetups)
- Saves time when creating events with similar structure
- All activities are preserved, reducing setup time

## Testing

To test the feature:
1. Restart the backend server to load the new clone method
2. Navigate to the events list page
3. Click the clone icon (copy icon) next to any event
4. Verify you're redirected to the edit page
5. Verify the event name has "(Copy)" appended
6. Verify all activities are present
7. Verify you can modify and save the cloned event

## Files Modified

- `packages/backend/src/services/event.service.ts` - Added cloneEvent method
- `packages/backend/src/routes/event.routes.ts` - Added clone endpoint
- `packages/orgadmin-events/src/pages/EventsListPage.tsx` - Added clone button and handler

## API Endpoint

```
POST /api/orgadmin/events/:id/clone
```

**Request:**
- No body required
- Event ID in URL path

**Response:**
```json
{
  "id": "new-event-id",
  "name": "Original Event Name (Copy)",
  "description": "...",
  "status": "draft",
  "activities": [...],
  ...
}
```

**Status Codes:**
- 201: Event cloned successfully
- 404: Original event not found
- 500: Server error
