# Bugfix Requirements Document

## Introduction

When editing an event via the Edit Event Page and enabling or modifying ticketing settings (e.g., `generateElectronicTickets`, `ticketHeaderText`, `ticketInstructions`, etc.), the changes appear to save successfully but are lost after page reload. The root cause is that the backend `updateEvent()` method in `event.service.ts` accepts ticketing fields in its `UpdateEventDto` but only persists columns on the `events` table — it never writes to the `event_ticketing_config` table where ticketing configuration is stored. The existing `TicketingService` already provides `createTicketedEvent()` and `updateTicketedEvent()` methods capable of persisting this data.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user edits an event and enables ticketing (`generateElectronicTickets = true`) and saves via `PUT /api/orgadmin/events/{id}` THEN the system silently discards the ticketing fields and no row is created in the `event_ticketing_config` table

1.2 WHEN a user edits an event that already has a ticketing configuration and modifies ticketing settings (e.g., changes `ticketHeaderText` or `ticketInstructions`) and saves via `PUT /api/orgadmin/events/{id}` THEN the system silently discards the updated ticketing fields and the existing `event_ticketing_config` row remains unchanged

1.3 WHEN a user edits an event and disables ticketing (`generateElectronicTickets = false`) on an event that previously had ticketing enabled and saves via `PUT /api/orgadmin/events/{id}` THEN the system silently discards the change and the `event_ticketing_config` row retains `generate_electronic_tickets = true`

### Expected Behavior (Correct)

2.1 WHEN a user edits an event and enables ticketing (`generateElectronicTickets = true`) and saves via `PUT /api/orgadmin/events/{id}` THEN the system SHALL create a new row in the `event_ticketing_config` table with the provided ticketing fields using the existing `TicketingService.createTicketedEvent()` method

2.2 WHEN a user edits an event that already has a ticketing configuration and modifies ticketing settings and saves via `PUT /api/orgadmin/events/{id}` THEN the system SHALL update the existing `event_ticketing_config` row with the modified ticketing fields using the existing `TicketingService.updateTicketedEvent()` method

2.3 WHEN a user edits an event and disables ticketing (`generateElectronicTickets = false`) on an event that previously had ticketing enabled and saves via `PUT /api/orgadmin/events/{id}` THEN the system SHALL update the existing `event_ticketing_config` row to set `generate_electronic_tickets = false`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user edits an event and modifies only non-ticketing fields (e.g., name, description, dates, activities) and saves via `PUT /api/orgadmin/events/{id}` THEN the system SHALL CONTINUE TO persist those fields to the `events` table as before without affecting any existing `event_ticketing_config` row

3.2 WHEN a user edits an event and no ticketing fields are present in the update payload THEN the system SHALL CONTINUE TO skip ticketing persistence entirely, preserving the current behavior for non-ticketing updates

3.3 WHEN a user edits an event and modifies activities alongside other fields THEN the system SHALL CONTINUE TO persist activity changes via `eventActivityService.replaceActivitiesForEvent()` as before

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type UpdateEventDto
  OUTPUT: boolean

  // Returns true when any ticketing field is present in the update payload
  RETURN X.generateElectronicTickets IS DEFINED
      OR X.ticketHeaderText IS DEFINED
      OR X.ticketInstructions IS DEFINED
      OR X.ticketFooterText IS DEFINED
      OR X.ticketValidityPeriod IS DEFINED
      OR X.includeEventLogo IS DEFINED
      OR X.ticketBackgroundColor IS DEFINED
END FUNCTION
```

## Fix Checking Property

```pascal
// Property: Fix Checking — Ticketing fields are persisted
FOR ALL X WHERE isBugCondition(X) DO
  result ← updateEvent'(id, X)
  config ← getTicketingConfigByEvent(id)
  ASSERT config IS NOT NULL
  ASSERT config reflects the ticketing fields from X
END FOR
```

## Preservation Checking Property

```pascal
// Property: Preservation Checking — Non-ticketing updates are unaffected
FOR ALL X WHERE NOT isBugCondition(X) DO
  configBefore ← getTicketingConfigByEvent(id)
  result ← updateEvent'(id, X)
  configAfter ← getTicketingConfigByEvent(id)
  ASSERT configBefore = configAfter
  ASSERT F(X) = F'(X)  // event table fields are persisted identically
END FOR
```
