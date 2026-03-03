# Event Types and Venues Feature - Design

## 1. Architecture Overview

This feature adds two new metadata entities (Event Types and Venues) with full CRUD operations, and updates the Events module to support optional associations with these entities.

### 1.1 Components
- **Backend**: Services, routes, and database migrations
- **Frontend**: List pages, create/edit dialogs, and event form updates
- **Database**: New tables and foreign key relationships

## 2. Database Design

### 2.1 Migration File
Create `002_create_event_types_and_venues.sql`:

```sql
-- Create event_types table
CREATE TABLE IF NOT EXISTS event_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_event_type_per_org UNIQUE(organisation_id, name)
);

CREATE INDEX idx_event_types_organisation ON event_types(organisation_id);

-- Create venues table
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_venue_per_org UNIQUE(organisation_id, name)
);

CREATE INDEX idx_venues_organisation ON venues(organisation_id);

-- Add foreign keys to events table
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
```

## 3. Backend Implementation

### 3.1 Event Type Service (`event-type.service.ts`)

```typescript
export interface EventType {
  id: string;
  organisationId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventTypeDto {
  organisationId: string;
  name: string;
  description?: string;
}

export interface UpdateEventTypeDto {
  name?: string;
  description?: string;
}

class EventTypeService {
  async getByOrganisation(organisationId: string): Promise<EventType[]>
  async getById(id: string): Promise<EventType | null>
  async create(data: CreateEventTypeDto): Promise<EventType>
  async update(id: string, data: UpdateEventTypeDto): Promise<EventType>
  async delete(id: string): Promise<void>
  async isInUse(id: string): Promise<boolean>
}
```

### 3.2 Venue Service (`venue.service.ts`)

```typescript
export interface Venue {
  id: string;
  organisationId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVenueDto {
  organisationId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateVenueDto {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

class VenueService {
  async getByOrganisation(organisationId: string): Promise<Venue[]>
  async getById(id: string): Promise<Venue | null>
  async create(data: CreateVenueDto): Promise<Venue>
  async update(id: string, data: UpdateVenueDto): Promise<Venue>
  async delete(id: string): Promise<void>
  async isInUse(id: string): Promise<boolean>
}
```

### 3.3 Event Service Updates

Update `Event` interface and queries to include:
```typescript
export interface Event {
  // ... existing fields
  eventTypeId?: string;
  venueId?: string;
  // Populated fields
  eventType?: EventType;
  venue?: Venue;
}
```

Update queries to LEFT JOIN event_types and venues tables.

### 3.4 Routes

**Event Types Routes** (`event-type.routes.ts`):
- `GET /api/orgadmin/organisations/:organisationId/event-types`
- `GET /api/orgadmin/event-types/:id`
- `POST /api/orgadmin/event-types`
- `PUT /api/orgadmin/event-types/:id`
- `DELETE /api/orgadmin/event-types/:id`

**Venues Routes** (`venue.routes.ts`):
- `GET /api/orgadmin/organisations/:organisationId/venues`
- `GET /api/orgadmin/venues/:id`
- `POST /api/orgadmin/venues`
- `PUT /api/orgadmin/venues/:id`
- `DELETE /api/orgadmin/venues/:id`

All routes require:
- `authenticateToken()` middleware
- `requireOrgAdminCapability('event-management')` middleware

## 4. Frontend Implementation

### 4.1 Event Types List Page

**File**: `packages/orgadmin-events/src/pages/EventTypesListPage.tsx`

Components:
- Page header with "Create Event Type" button
- Search bar
- Data table with columns: Name, Description, Actions
- Edit and Delete action buttons
- Create/Edit dialog component

### 4.2 Event Types Dialog

**File**: `packages/orgadmin-events/src/components/EventTypeDialog.tsx`

Form fields:
- Name (TextField, required)
- Description (TextField, multiline, optional)

Validation:
- Name is required
- Name must be unique per organization

### 4.3 Venues List Page

**File**: `packages/orgadmin-events/src/pages/VenuesListPage.tsx`

Components:
- Page header with "Create Venue" button
- Search bar
- Data table with columns: Name, Address, Latitude, Longitude, Actions
- Edit and Delete action buttons
- Create/Edit dialog component

### 4.4 Venues Dialog

**File**: `packages/orgadmin-events/src/components/VenueDialog.tsx`

Form fields:
- Name (TextField, required)
- Address (TextField, multiline, optional)
- Latitude (TextField, number, optional, range: -90 to 90)
- Longitude (TextField, number, optional, range: -180 to 180)

Validation:
- Name is required
- Latitude must be between -90 and 90
- Longitude must be between -180 and 180

### 4.5 Event Form Updates

**File**: `packages/orgadmin-events/src/pages/CreateEventPage.tsx`

Add to Basic Information step:
- Event Type dropdown (Autocomplete, optional)
- Venue dropdown (Autocomplete, optional)

Both dropdowns:
- Load options from API on mount
- Allow clearing selection
- Show "None" or empty state when no selection

## 5. Translation Keys

Add to `packages/orgadmin-shell/src/locales/en-GB/translation.json`:

```json
{
  "events": {
    "eventTypes": {
      "title": "Event Types",
      "createEventType": "Create Event Type",
      "editEventType": "Edit Event Type",
      "deleteEventType": "Delete Event Type",
      "searchPlaceholder": "Search event types...",
      "noEventTypesFound": "No event types yet. Create your first event type to get started.",
      "table": {
        "name": "Name",
        "description": "Description",
        "actions": "Actions"
      },
      "form": {
        "name": "Name",
        "nameHelper": "Event type name (e.g., 'Competition', 'Training', 'Social')",
        "description": "Description",
        "descriptionHelper": "Optional description of this event type"
      },
      "validation": {
        "nameRequired": "Event type name is required",
        "nameExists": "An event type with this name already exists"
      },
      "delete": {
        "title": "Delete Event Type",
        "message": "Are you sure you want to delete \"{{name}}\"?",
        "inUseError": "Cannot delete event type that is used in events"
      }
    },
    "venues": {
      "title": "Venues",
      "createVenue": "Create Venue",
      "editVenue": "Edit Venue",
      "deleteVenue": "Delete Venue",
      "searchPlaceholder": "Search venues...",
      "noVenuesFound": "No venues yet. Create your first venue to get started.",
      "table": {
        "name": "Name",
        "address": "Address",
        "latitude": "Latitude",
        "longitude": "Longitude",
        "actions": "Actions"
      },
      "form": {
        "name": "Name",
        "nameHelper": "Venue name (e.g., 'Main Arena', 'Training Ground')",
        "address": "Address",
        "addressHelper": "Full address of the venue",
        "latitude": "Latitude",
        "latitudeHelper": "Latitude coordinate (-90 to 90)",
        "longitude": "Longitude",
        "longitudeHelper": "Longitude coordinate (-180 to 180)"
      },
      "validation": {
        "nameRequired": "Venue name is required",
        "nameExists": "A venue with this name already exists",
        "latitudeRange": "Latitude must be between -90 and 90",
        "longitudeRange": "Longitude must be between -180 and 180"
      },
      "delete": {
        "title": "Delete Venue",
        "message": "Are you sure you want to delete \"{{name}}\"?",
        "inUseError": "Cannot delete venue that is used in events"
      }
    },
    "basicInfo": {
      "eventType": "Event Type",
      "eventTypeHelper": "Optional event type classification",
      "venue": "Venue",
      "venueHelper": "Optional venue location"
    }
  }
}
```

## 6. Error Handling

### 6.1 Backend Errors
- 400: Validation errors (missing required fields, invalid formats)
- 404: Entity not found
- 409: Duplicate name within organization
- 422: Cannot delete entity that is in use
- 500: Database or server errors

### 6.2 Frontend Error Display
- Show error messages in snackbar/toast
- Highlight invalid form fields
- Display specific error messages for each validation failure

## 7. Testing Strategy

### 7.1 Backend Tests
- Unit tests for services (CRUD operations)
- Integration tests for routes
- Test deletion prevention when in use
- Test unique constraint enforcement

### 7.2 Frontend Tests
- Component rendering tests
- Form validation tests
- API integration tests
- User interaction tests

## 8. Implementation Order

1. Database migration
2. Backend services (event-type, venue)
3. Backend routes
4. Update event service to include associations
5. Frontend dialogs (EventTypeDialog, VenueDialog)
6. Frontend list pages (EventTypesListPage, VenuesListPage)
7. Update event creation form
8. Add translations
9. Testing
10. Documentation

## 9. Rollback Plan

If issues arise:
1. Remove foreign key columns from events table
2. Drop event_types and venues tables
3. Revert frontend changes
4. Revert route registrations

Migration rollback:
```sql
ALTER TABLE events DROP COLUMN IF EXISTS event_type_id;
ALTER TABLE events DROP COLUMN IF EXISTS venue_id;
DROP TABLE IF EXISTS event_types CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
```
