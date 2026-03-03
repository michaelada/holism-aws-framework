# Event Types and Venues Feature - Tasks

## 1. Database Setup
- [ ] 1.1 Create migration file `002_create_event_types_and_venues.sql`
- [ ] 1.2 Run migration to create event_types and venues tables
- [ ] 1.3 Verify tables and indexes are created correctly

## 2. Backend - Event Type Service
- [ ] 2.1 Create `event-type.service.ts` with interfaces and class
- [ ] 2.2 Implement `getByOrganisation()` method
- [ ] 2.3 Implement `getById()` method
- [ ] 2.4 Implement `create()` method with validation
- [ ] 2.5 Implement `update()` method with validation
- [ ] 2.6 Implement `delete()` method with usage check
- [ ] 2.7 Implement `isInUse()` helper method

## 3. Backend - Venue Service
- [ ] 3.1 Create `venue.service.ts` with interfaces and class
- [ ] 3.2 Implement `getByOrganisation()` method
- [ ] 3.3 Implement `getById()` method
- [ ] 3.4 Implement `create()` method with validation
- [ ] 3.5 Implement `update()` method with validation
- [ ] 3.6 Implement `delete()` method with usage check
- [ ] 3.7 Implement `isInUse()` helper method

## 4. Backend - Event Type Routes
- [ ] 4.1 Create `event-type.routes.ts` file
- [ ] 4.2 Implement GET /organisations/:organisationId/event-types
- [ ] 4.3 Implement GET /event-types/:id
- [ ] 4.4 Implement POST /event-types
- [ ] 4.5 Implement PUT /event-types/:id
- [ ] 4.6 Implement DELETE /event-types/:id
- [ ] 4.7 Add Swagger documentation for all endpoints
- [ ] 4.8 Register routes in main app

## 5. Backend - Venue Routes
- [ ] 5.1 Create `venue.routes.ts` file
- [ ] 5.2 Implement GET /organisations/:organisationId/venues
- [ ] 5.3 Implement GET /venues/:id
- [ ] 5.4 Implement POST /venues
- [ ] 5.5 Implement PUT /venues/:id
- [ ] 5.6 Implement DELETE /venues/:id
- [ ] 5.7 Add Swagger documentation for all endpoints
- [ ] 5.8 Register routes in main app

## 6. Backend - Update Event Service
- [ ] 6.1 Add eventTypeId and venueId to Event interface
- [ ] 6.2 Update getEventById() to LEFT JOIN event_types and venues
- [ ] 6.3 Update getEventsByOrganisation() to LEFT JOIN event_types and venues
- [ ] 6.4 Update createEvent() to accept eventTypeId and venueId
- [ ] 6.5 Update updateEvent() to accept eventTypeId and venueId
- [ ] 6.6 Add validation for foreign key references

## 7. Frontend - Event Type Dialog Component
- [ ] 7.1 Create `EventTypeDialog.tsx` component
- [ ] 7.2 Implement form with name and description fields
- [ ] 7.3 Add form validation
- [ ] 7.4 Implement create mode
- [ ] 7.5 Implement edit mode
- [ ] 7.6 Add API integration for create/update
- [ ] 7.7 Add error handling and user feedback

## 8. Frontend - Event Types List Page
- [ ] 8.1 Update `EventTypesListPage.tsx` with full implementation
- [ ] 8.2 Add API integration to load event types
- [ ] 8.3 Implement search functionality
- [ ] 8.4 Add create button and dialog integration
- [ ] 8.5 Add edit action and dialog integration
- [ ] 8.6 Add delete action with confirmation
- [ ] 8.7 Handle delete errors (in use)
- [ ] 8.8 Add empty state message

## 9. Frontend - Venue Dialog Component
- [ ] 9.1 Create `VenueDialog.tsx` component
- [ ] 9.2 Implement form with name, address, lat, long fields
- [ ] 9.3 Add form validation (including lat/long ranges)
- [ ] 9.4 Implement create mode
- [ ] 9.5 Implement edit mode
- [ ] 9.6 Add API integration for create/update
- [ ] 9.7 Add error handling and user feedback

## 10. Frontend - Venues List Page
- [ ] 10.1 Update `VenuesListPage.tsx` with full implementation
- [ ] 10.2 Add API integration to load venues
- [ ] 10.3 Implement search functionality
- [ ] 10.4 Add create button and dialog integration
- [ ] 10.5 Add edit action and dialog integration
- [ ] 10.6 Add delete action with confirmation
- [ ] 10.7 Handle delete errors (in use)
- [ ] 10.8 Add empty state message

## 11. Frontend - Update Event Creation Form
- [ ] 11.1 Add Event Type dropdown to Basic Information step
- [ ] 11.2 Add Venue dropdown to Basic Information step
- [ ] 11.3 Load event types from API on mount
- [ ] 11.4 Load venues from API on mount
- [ ] 11.5 Implement dropdown selection handling
- [ ] 11.6 Allow clearing selections (set to null)
- [ ] 11.7 Update form submission to include eventTypeId and venueId
- [ ] 11.8 Update event edit mode to populate selections

## 12. Frontend - Update Event Display
- [ ] 12.1 Update EventDetailsPage to show event type
- [ ] 12.2 Update EventDetailsPage to show venue
- [ ] 12.3 Update EventsListPage to show event type in table
- [ ] 12.4 Update EventsListPage to show venue in table

## 13. Translations
- [ ] 13.1 Add event types translations to en-GB/translation.json
- [ ] 13.2 Add venues translations to en-GB/translation.json
- [ ] 13.3 Add event form field translations

## 14. Testing
- [ ] 14.1 Write unit tests for event-type.service.ts
- [ ] 14.2 Write unit tests for venue.service.ts
- [ ] 14.3 Write integration tests for event-type routes
- [ ] 14.4 Write integration tests for venue routes
- [ ] 14.5 Write component tests for EventTypeDialog
- [ ] 14.6 Write component tests for VenueDialog
- [ ] 14.7 Write component tests for EventTypesListPage
- [ ] 14.8 Write component tests for VenuesListPage
- [ ] 14.9 Manual testing of full workflow

## 15. Documentation
- [ ] 15.1 Update API documentation
- [ ] 15.2 Update user guide with event types and venues features
- [ ] 15.3 Add developer notes for future enhancements
