/**
 * Preservation Property Test
 * Feature: event-ticketing-save-fix
 *
 * Property 2: Preservation — Non-Ticketing Updates Leave Config Unchanged
 *
 * For any UpdateEventDto payload where NO ticketing field is defined
 * (isBugCondition returns false), updateEvent() SHALL:
 *   - Persist non-ticketing fields to the events table as before
 *   - NOT call any TicketingService methods
 *   - Continue to handle activities via eventActivityService
 *
 * On UNFIXED code: Tests PASS (confirms baseline behavior)
 * After fix: Tests PASS (confirms no regressions)
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import * as fc from 'fast-check';
import { EventService } from '../event.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

// Mock ticketing service methods
const mockGetTicketingConfigByEvent = jest.fn();
const mockCreateTicketedEvent = jest.fn();
const mockUpdateTicketedEvent = jest.fn();

jest.mock('../ticketing.service', () => ({
  ticketingService: {
    getTicketingConfigByEvent: (...args: any[]) => mockGetTicketingConfigByEvent(...args),
    createTicketedEvent: (...args: any[]) => mockCreateTicketedEvent(...args),
    updateTicketedEvent: (...args: any[]) => mockUpdateTicketedEvent(...args),
  },
}));

// Mock event-activity service
const mockReplaceActivitiesForEvent = jest.fn();
const mockGetActivitiesByEvent = jest.fn();

jest.mock('../event-activity.service', () => ({
  eventActivityService: {
    getActivitiesByEvent: (...args: any[]) => mockGetActivitiesByEvent(...args),
    replaceActivitiesForEvent: (...args: any[]) => mockReplaceActivitiesForEvent(...args),
  },
}));

// Helper: build a mock event row for getEventById
function mockEventRow(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    organisation_id: 'org-1',
    name: 'Test Event',
    description: 'A test event',
    event_owner: 'user-1',
    email_notifications: null,
    start_date: new Date('2025-06-01'),
    end_date: new Date('2025-06-02'),
    open_date_entries: null,
    entries_closing_date: null,
    limit_entries: false,
    entries_limit: null,
    add_confirmation_message: false,
    confirmation_message: null,
    status: 'draft',
    event_type_id: null,
    venue_id: null,
    discount_ids: '[]',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Arbitrary for a single EventActivity (non-ticketing)
const activityArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 0, maxLength: 50 }),
  showPublicly: fc.boolean(),
  limitApplicants: fc.boolean(),
  applicantsLimit: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }),
  allowSpecifyQuantity: fc.boolean(),
  useTermsAndConditions: fc.boolean(),
  termsAndConditions: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  fee: fc.integer({ min: 0, max: 10000 }),
  supportedPaymentMethods: fc.array(fc.constantFrom('card', 'cash', 'cheque', 'eft'), { minLength: 0, maxLength: 3 }),
  handlingFeeIncluded: fc.boolean(),
  chequePaymentInstructions: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

/**
 * Arbitrary for UpdateEventDto payloads where isBugCondition is FALSE.
 * Only non-ticketing fields are generated. Ticketing fields are never included.
 */
const nonTicketingPayloadArb = fc.record({
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  status: fc.option(fc.constantFrom('draft' as const, 'published' as const, 'cancelled' as const, 'completed' as const), { nil: undefined }),
  eventTypeId: fc.option(fc.uuid(), { nil: undefined }),
  venueId: fc.option(fc.uuid(), { nil: undefined }),
  discountIds: fc.option(fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }), { nil: undefined }),
  activities: fc.option(fc.array(activityArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
}).filter(payload => {
  // Ensure at least one field is defined so the update is meaningful
  return payload.name !== undefined
    || payload.description !== undefined
    || payload.status !== undefined
    || payload.eventTypeId !== undefined
    || payload.venueId !== undefined
    || payload.discountIds !== undefined
    || payload.activities !== undefined;
});

describe('Property 2: Preservation — Non-Ticketing Updates Leave Config Unchanged', () => {
  let service: EventService;
  const eventId = 'event-456';

  beforeEach(() => {
    service = new EventService();
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * Property: For any UpdateEventDto payload where isBugCondition is false,
   * updateEvent() must NOT call any TicketingService methods.
   * The event_ticketing_config table must remain completely untouched.
   */
  it('should never call TicketingService methods when no ticketing fields are present', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonTicketingPayloadArb,
        async (payload) => {
          jest.clearAllMocks();

          const row = mockEventRow(eventId);

          // Mock getEventById (SELECT with JOINs)
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          // Mock getActivitiesByEvent inside getEventById
          mockGetActivitiesByEvent.mockResolvedValue([]);
          // Mock UPDATE events RETURNING *
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          // Mock replaceActivitiesForEvent if activities are provided
          mockReplaceActivitiesForEvent.mockResolvedValue([]);

          await service.updateEvent(eventId, payload);

          // Assert: NO ticketing service methods were called
          expect(mockGetTicketingConfigByEvent).not.toHaveBeenCalled();
          expect(mockCreateTicketedEvent).not.toHaveBeenCalled();
          expect(mockUpdateTicketedEvent).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * Property: For any non-ticketing payload, the events table UPDATE query
   * is still executed with the correct non-ticketing fields.
   */
  it('should persist non-ticketing fields to the events table', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonTicketingPayloadArb,
        async (payload) => {
          jest.clearAllMocks();

          const row = mockEventRow(eventId);

          // Mock getEventById (SELECT)
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          mockGetActivitiesByEvent.mockResolvedValue([]);
          // Mock UPDATE events RETURNING *
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          mockReplaceActivitiesForEvent.mockResolvedValue([]);

          await service.updateEvent(eventId, payload);

          // The UPDATE query should have been called (second db.query call)
          // First call is getEventById, second is the UPDATE
          expect(mockDb.query).toHaveBeenCalledTimes(2);

          const updateCall = mockDb.query.mock.calls[1];
          const updateQuery = updateCall[0] as string;
          const updateValues = updateCall[1] as any[];

          // Verify the UPDATE targets the events table
          expect(updateQuery).toContain('UPDATE events');
          expect(updateQuery).toContain('RETURNING *');

          // Verify the event ID is in the values (always the last param)
          expect(updateValues[updateValues.length - 1]).toBe(eventId);

          // Verify specific fields are in the UPDATE when provided
          if (payload.name !== undefined) {
            expect(updateValues).toContain(payload.name);
          }
          if (payload.description !== undefined) {
            expect(updateValues).toContain(payload.description);
          }
          if (payload.status !== undefined) {
            expect(updateValues).toContain(payload.status);
          }
          if (payload.discountIds !== undefined) {
            expect(updateValues).toContain(JSON.stringify(payload.discountIds));
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirement 3.3**
   *
   * Property: When activities are provided in a non-ticketing payload,
   * replaceActivitiesForEvent() is called and ticketing is still untouched.
   */
  it('should handle activity updates via eventActivityService without touching ticketing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(activityArb, { minLength: 1, maxLength: 3 }),
        async (activities) => {
          jest.clearAllMocks();

          const row = mockEventRow(eventId);

          // Mock getEventById (SELECT)
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          mockGetActivitiesByEvent.mockResolvedValue([]);
          // Mock UPDATE events RETURNING *
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          mockReplaceActivitiesForEvent.mockResolvedValue(activities);

          await service.updateEvent(eventId, { activities });

          // Assert: activities were handled
          expect(mockReplaceActivitiesForEvent).toHaveBeenCalledWith(
            eventId,
            activities.map(a => ({ ...a, eventId }))
          );

          // Assert: ticketing was NOT touched
          expect(mockGetTicketingConfigByEvent).not.toHaveBeenCalled();
          expect(mockCreateTicketedEvent).not.toHaveBeenCalled();
          expect(mockUpdateTicketedEvent).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 30 }
    );
  });
});
