# Event Types and Venues Feature - Requirements

## 1. Overview

Add Event Types and Venues as reusable metadata entities that can be optionally associated with events. This allows organizations to categorize events and associate them with physical locations.

## 2. User Stories

### 2.1 Event Types Management
**As an** organization administrator  
**I want to** create and manage event types  
**So that** I can categorize my events consistently

**Acceptance Criteria:**
- User can view a list of all event types for their organization
- User can create a new event type with name and description
- User can edit an existing event type's name and description
- User can delete an event type if it's not used in any events
- System prevents deletion of event types that are in use
- Event types are organization-specific (not shared across organizations)

### 2.2 Venues Management
**As an** organization administrator  
**I want to** create and manage venues  
**So that** I can associate events with physical locations

**Acceptance Criteria:**
- User can view a list of all venues for their organization
- User can create a new venue with name, address, latitude, and longitude
- User can edit an existing venue's details
- User can delete a venue if it's not used in any events
- System prevents deletion of venues that are in use
- Venues are organization-specific (not shared across organizations)
- Latitude and longitude are optional fields

### 2.3 Event Association
**As an** organization administrator  
**I want to** optionally associate an event with an event type and venue  
**So that** events are properly categorized and located

**Acceptance Criteria:**
- When creating an event, user can optionally select an event type from a dropdown
- When creating an event, user can optionally select a venue from a dropdown
- When editing an event, user can change or remove the event type
- When editing an event, user can change or remove the venue
- Event type and venue selections are optional (not required)
- Selected event type and venue are displayed in event details
- Event list shows event type and venue information when available

## 3. Data Model

### 3.1 Event Types Table
```sql
CREATE TABLE event_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organisation_id, name)
);
```

### 3.2 Venues Table
```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organisation_id, name)
);
```

### 3.3 Events Table Updates
```sql
ALTER TABLE events 
  ADD COLUMN event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL,
  ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
```

## 4. API Endpoints

### 4.1 Event Types
- `GET /api/orgadmin/organisations/:organisationId/event-types` - List all event types
- `GET /api/orgadmin/event-types/:id` - Get event type by ID
- `POST /api/orgadmin/event-types` - Create event type
- `PUT /api/orgadmin/event-types/:id` - Update event type
- `DELETE /api/orgadmin/event-types/:id` - Delete event type (fails if in use)

### 4.2 Venues
- `GET /api/orgadmin/organisations/:organisationId/venues` - List all venues
- `GET /api/orgadmin/venues/:id` - Get venue by ID
- `POST /api/orgadmin/venues` - Create venue
- `PUT /api/orgadmin/venues/:id` - Update venue
- `DELETE /api/orgadmin/venues/:id` - Delete venue (fails if in use)

## 5. UI Requirements

### 5.1 Event Types List Page
- Table showing: Name, Description, Actions
- Search functionality
- "Create Event Type" button
- Edit and Delete actions per row
- Empty state message when no event types exist

### 5.2 Event Types Create/Edit Dialog
- Form fields: Name (required), Description (optional)
- Save and Cancel buttons
- Validation for required fields

### 5.3 Venues List Page
- Table showing: Name, Address, Latitude, Longitude, Actions
- Search functionality
- "Create Venue" button
- Edit and Delete actions per row
- Empty state message when no venues exist

### 5.4 Venues Create/Edit Dialog
- Form fields: Name (required), Address (optional), Latitude (optional), Longitude (optional)
- Save and Cancel buttons
- Validation for required fields
- Validation for latitude/longitude format

### 5.5 Event Creation/Edit Form Updates
- Add "Event Type" dropdown (optional) in Basic Information step
- Add "Venue" dropdown (optional) in Basic Information step
- Dropdowns show organization's event types and venues
- Allow clearing selection (set to null)

## 6. Non-Functional Requirements

### 6.1 Performance
- Event types and venues lists should load in < 1 second
- Dropdown selections should be cached for the session

### 6.2 Security
- All endpoints require authentication
- Users can only access event types and venues for their organization
- Capability check: `event-management` required for all operations

### 6.3 Data Integrity
- Prevent deletion of event types/venues that are in use
- Cascade behavior: When event type/venue is deleted, set event references to NULL
- Unique constraint on name per organization

## 7. Out of Scope
- Sharing event types/venues across organizations
- Importing/exporting event types/venues
- Venue mapping/geolocation features
- Event type hierarchies or categories
