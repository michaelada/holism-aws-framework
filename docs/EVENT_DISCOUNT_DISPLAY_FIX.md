# Event Discount Display Fix

## Issue
When discounts were associated with an event, they were not appearing in the "Discounts" column of the Events List Page. Additionally, when cloning an event, the discount associations were not being copied to the cloned event.

## Root Causes

### 1. PostgreSQL JSONB Parsing
The PostgreSQL JSONB column `discount_ids` was returning data that needed proper parsing. The original code assumed the data would always be an array, but JSONB columns can return data as strings that need to be parsed first.

### 2. Clone Event Missing discountIds
The `cloneEvent()` method was not copying the `discountIds` field from the original event to the cloned event, causing discount associations to be lost during cloning.

### 3. Missing organisationId Parameter in getDiscountById
The backend API endpoint `GET /api/orgadmin/discounts/:id` requires an `organisationId` query parameter for authorization and data filtering. The frontend `getDiscountById` method was not passing this parameter, causing 400 errors when trying to fetch discount details for display in the Events List Page.

## Solution

### Backend Fix 1: JSONB Parsing (packages/backend/src/services/event.service.ts)
Enhanced the `rowToEvent()` method to properly parse the `discount_ids` JSONB column:

```typescript
private rowToEvent(row: any): Event {
  // Parse discount_ids from JSONB - it might be a string or already parsed
  let discountIds: string[] = [];
  if (row.discount_ids) {
    if (Array.isArray(row.discount_ids)) {
      discountIds = row.discount_ids;
    } else if (typeof row.discount_ids === 'string') {
      try {
        const parsed = JSON.parse(row.discount_ids);
        discountIds = Array.isArray(parsed) ? parsed : [];
      } catch {
        discountIds = [];
      }
    }
  }
  
  const event: Event = {
    // ... other fields
    discountIds,
    // ... rest of fields
  };
}
```

This ensures that:
1. If `discount_ids` is already an array, use it directly
2. If it's a string (JSON), parse it first
3. If parsing fails or the result isn't an array, default to empty array
4. If the field is null/undefined, default to empty array

### Backend Fix 2: Clone Event (packages/backend/src/services/event.service.ts)
Added `discountIds` to the cloned event data:

```typescript
const cloneData: CreateEventDto = {
  // ... other fields
  discountIds: originalEvent.discountIds || [], // Clone discount IDs
  // ... rest of fields
};
```

### Frontend Enhancement (packages/orgadmin-events/src/pages/EventsListPage.tsx)
Added comprehensive console logging to help diagnose issues:

```typescript
const loadEvents = async () => {
  // ... existing code
  console.log('Events loaded:', response);
  console.log('First event discountIds:', response?.[0]?.discountIds);
  // ... rest of code
};

const loadEventDiscounts = async (eventsList: Event[]) => {
  console.log('Loading discounts for events:', eventsList.map(e => ({ 
    id: e.id, 
    name: e.name, 
    discountIds: e.discountIds 
  })));
  
  // ... existing code with additional logging
  console.log(`Event ${event.name} has discount IDs:`, event.discountIds);
  console.log(`Loaded discounts for event ${event.name}:`, discountsMap[event.id]);
  // ... rest of code
};
```

### Frontend Enhancement 2 (packages/orgadmin-events/src/pages/CreateEventPage.tsx)
Added logging and ensured `discountIds` is always initialized:

```typescript
const eventData = {
  ...response,
  // ... other fields
  discountIds: response.discountIds || [], // Ensure discountIds is always an array
};

console.log('Event response discountIds:', response.discountIds);
console.log('Event data discountIds after processing:', eventData.discountIds);
```

Also removed unused import from EventsListPage:
- Removed `import type { Discount } from '../types/discount.types';` (not used)

### Frontend Fix 3: Add organisationId Parameter (packages/orgadmin-events/src/services/discount.service.ts)
Updated the `getDiscountById` method to accept and pass the required `organisationId` parameter:

```typescript
async getDiscountById(id: string, organisationId: string): Promise<Discount> {
  try {
    const response = await this.api.get(`/api/orgadmin/discounts/${id}?organisationId=${organisationId}`);
    return this.transformDiscount(response.data);
  } catch (error) {
    console.error('Failed to get discount:', error);
    throw this.handleError(error);
  }
}
```

### Frontend Fix 4: Pass organisationId When Fetching Discounts (packages/orgadmin-events/src/pages/EventsListPage.tsx)
Updated the `loadEventDiscounts` function to:
1. Check that organisation ID is available before loading discounts
2. Pass the organisation ID when calling `getDiscountById`:

```typescript
const loadEventDiscounts = async (eventsList: Event[]) => {
  if (!organisation?.id) {
    console.error('Organisation ID not available for loading discounts');
    return;
  }
  
  // ... existing code
  const discount = await discountService.getDiscountById(id, organisation.id);
  // ... rest of code
};
```

## Testing
To verify the fix:

1. **Test Discount Display**:
   - Create or edit an event
   - Select one or more discounts in the "Apply Discounts to Event" field
   - Save the event
   - Navigate back to the Events List Page
   - Verify that the discount names appear as chips in the "Discounts" column

2. **Test Event Cloning**:
   - Create an event with discount associations
   - Clone the event using the Clone button
   - Edit the cloned event
   - Verify that the discount associations were copied to the cloned event
   - Save and verify the discounts appear in the Events List

## Console Logs
When debugging, check the browser console for:
- "Events loaded:" - Shows all events with their discountIds
- "First event discountIds:" - Shows the discountIds of the first event
- "Loading discounts for events:" - Shows which events have discount IDs
- "Event X has discount IDs:" - Shows the specific IDs for each event
- "Loaded discounts for event X:" - Shows the fetched discount details
- "Final discounts map:" - Shows the complete mapping of event IDs to discount summaries
- "Event response discountIds:" - Shows discountIds when loading an event for editing
- "Event data discountIds after processing:" - Shows discountIds after processing

## Files Modified
- `packages/backend/src/services/event.service.ts` - Enhanced JSONB parsing and added discountIds to cloneEvent
- `packages/orgadmin-events/src/pages/EventsListPage.tsx` - Added logging, removed unused import, and added organisationId parameter
- `packages/orgadmin-events/src/pages/CreateEventPage.tsx` - Added logging and ensured discountIds initialization
- `packages/orgadmin-events/src/services/discount.service.ts` - Added organisationId parameter to getDiscountById method

## Related Documentation
- [Event Discount Persistence Issue](./EVENT_DISCOUNT_PERSISTENCE_ISSUE.md)
- [Discount System Implementation Status](./DISCOUNT_SYSTEM_IMPLEMENTATION_STATUS.md)
- [Event Clone Feature](./EVENT_CLONE_FEATURE.md)
