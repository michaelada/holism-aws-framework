/**
 * Bug Condition Exploration Property Test
 * Feature: event-ticketing-save-fix
 *
 * Property 1: Bug Condition — Ticketing Fields Silently Dropped
 *
 * This test encodes the EXPECTED behavior for ticketing fields on Events.
 * On UNFIXED code, these tests MUST FAIL — failure confirms the bug exists.
 * After the fix is applied, these tests should PASS.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
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

// Mock the dynamic import of ticketing.service
jest.mock('../ticketing.service', () => ({
  ticketingService: {
    getTicketingConfigByEvent: (...args: any[]) => mockGetTicketingConfigByEvent(...args),
    createTicketedEvent: (...args: any[]) => mockCreateTicketedEvent(...args),
    updateTicketedEvent: (...args: any[]) => mockUpdateTicketedEvent(...args),
  },
}));

// Mock the dynamic import of event-activity.service
jest.mock('../event-activity.service', () => ({
  eventActivityService: {
    getActivitiesByEvent: jest.fn().mockResolvedValue([]),
    replaceActivitiesForEvent: jest.fn().mockResolvedValue([]),
  },
}));

// Helper: build a mock event row for getEventById
function mockEventRow(id: string) {
  return {
    id,
    organisation_id: 'org-1',
    name: 'Test Event',
    description: 'A test event',
    event_owner: 'user-1',
    email_notifications: null,
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-01-02'),
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
  };
}

// fast-check arbitrary for optional ticketing fields where at least one is defined
const ticketingPayloadArb = fc.record({
  generateElectronicTickets: fc.option(fc.boolean(), { nil: undefined }),
  ticketHeaderText: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  ticketInstructions: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  ticketFooterText: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  ticketValidityPeriod: fc.option(fc.integer({ min: 1, max: 365 }), { nil: undefined }),
  includeEventLogo: fc.option(fc.boolean(), { nil: undefined }),
  ticketBackgroundColor: fc.option(
    fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`),
    { nil: undefined }
  ),
}).filter(payload => {
  // isBugCondition: at least one ticketing field must be defined
  return payload.generateElectronicTickets !== undefined
    || payload.ticketHeaderText !== undefined
    || payload.ticketInstructions !== undefined
    || payload.ticketFooterText !== undefined
    || payload.ticketValidityPeriod !== undefined
    || payload.includeEventLogo !== undefined
    || payload.ticketBackgroundColor !== undefined;
});

describe('Property 1: Bug Condition — Ticketing Fields Silently Dropped', () => {
  let service: EventService;
  const eventId = 'event-123';

  beforeEach(() => {
    service = new EventService();
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
   *
   * Property: For any UpdateEventDto payload where isBugCondition is true,
   * updateEvent() must call either createTicketedEvent() or updateTicketedEvent()
   * with the ticketing fields from the payload.
   *
   * On unfixed code: FAILS because updateEvent() never delegates to TicketingService.
   */
  it('should call TicketingService when ticketing fields are present (no existing config)', async () => {
    await fc.assert(
      fc.asyncProperty(
        ticketingPayloadArb,
        async (ticketingFields) => {
          jest.clearAllMocks();

          const row = mockEventRow(eventId);

          // Mock getEventById (SELECT)
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          // Mock UPDATE events RETURNING *
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

          // No existing ticketing config
          mockGetTicketingConfigByEvent.mockResolvedValue(null);
          mockCreateTicketedEvent.mockResolvedValue({
            id: 'config-1',
            eventId,
            ...ticketingFields,
          });

          await service.updateEvent(eventId, ticketingFields);

          // Assert: either createTicketedEvent or updateTicketedEvent was called
          const createCalled = mockCreateTicketedEvent.mock.calls.length > 0;
          const updateCalled = mockUpdateTicketedEvent.mock.calls.length > 0;

          expect(createCalled || updateCalled).toBe(true);

          if (createCalled) {
            const callArgs = mockCreateTicketedEvent.mock.calls[0][0];
            expect(callArgs.eventId).toBe(eventId);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should call updateTicketedEvent when ticketing fields are present and config exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        ticketingPayloadArb,
        async (ticketingFields) => {
          jest.clearAllMocks();

          const row = mockEventRow(eventId);

          // Mock getEventById (SELECT)
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
          // Mock UPDATE events RETURNING *
          mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

          // Existing ticketing config
          mockGetTicketingConfigByEvent.mockResolvedValue({
            id: 'config-1',
            eventId,
            generateElectronicTickets: true,
            ticketHeaderText: 'Old Header',
            ticketInstructions: null,
            ticketFooterText: null,
            ticketValidityPeriod: null,
            includeEventLogo: false,
            ticketBackgroundColor: null,
          });
          mockUpdateTicketedEvent.mockResolvedValue({
            id: 'config-1',
            eventId,
            ...ticketingFields,
          });

          await service.updateEvent(eventId, ticketingFields);

          // Assert: updateTicketedEvent was called
          expect(mockUpdateTicketedEvent).toHaveBeenCalled();
          expect(mockUpdateTicketedEvent.mock.calls[0][0]).toBe(eventId);
        }
      ),
      { numRuns: 30 }
    );
  });

  // --- Concrete scoped cases ---

  /**
   * **Validates: Requirement 2.1**
   * Scoped case 1: New config with generateElectronicTickets = true
   */
  it('should create ticketing config when enabling ticketing on event with no config', async () => {
    const row = mockEventRow(eventId);

    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

    mockGetTicketingConfigByEvent.mockResolvedValue(null);
    mockCreateTicketedEvent.mockResolvedValue({
      id: 'config-1',
      eventId,
      generateElectronicTickets: true,
      ticketHeaderText: 'Welcome',
    });

    await service.updateEvent(eventId, {
      generateElectronicTickets: true,
      ticketHeaderText: 'Welcome',
    });

    expect(mockCreateTicketedEvent).toHaveBeenCalled();
    const callArgs = mockCreateTicketedEvent.mock.calls[0][0];
    expect(callArgs.eventId).toBe(eventId);
    expect(callArgs.generateElectronicTickets).toBe(true);
    expect(callArgs.ticketHeaderText).toBe('Welcome');
  });

  /**
   * **Validates: Requirement 2.2**
   * Scoped case 2: Update existing config with modified ticketHeaderText
   */
  it('should update ticketing config when modifying ticketHeaderText on event with existing config', async () => {
    const row = mockEventRow(eventId);

    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

    mockGetTicketingConfigByEvent.mockResolvedValue({
      id: 'config-1',
      eventId,
      generateElectronicTickets: true,
      ticketHeaderText: 'Old Header',
    });
    mockUpdateTicketedEvent.mockResolvedValue({
      id: 'config-1',
      eventId,
      generateElectronicTickets: true,
      ticketHeaderText: 'New Header',
    });

    await service.updateEvent(eventId, {
      ticketHeaderText: 'New Header',
    });

    expect(mockUpdateTicketedEvent).toHaveBeenCalled();
    expect(mockUpdateTicketedEvent.mock.calls[0][0]).toBe(eventId);
  });

  /**
   * **Validates: Requirement 2.3**
   * Scoped case 3: Disable ticketing with generateElectronicTickets = false
   */
  it('should update ticketing config when disabling ticketing on event with existing config', async () => {
    const row = mockEventRow(eventId);

    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

    mockGetTicketingConfigByEvent.mockResolvedValue({
      id: 'config-1',
      eventId,
      generateElectronicTickets: true,
    });
    mockUpdateTicketedEvent.mockResolvedValue({
      id: 'config-1',
      eventId,
      generateElectronicTickets: false,
    });

    await service.updateEvent(eventId, {
      generateElectronicTickets: false,
    });

    expect(mockUpdateTicketedEvent).toHaveBeenCalled();
    expect(mockUpdateTicketedEvent.mock.calls[0][0]).toBe(eventId);
    expect(mockUpdateTicketedEvent.mock.calls[0][1]).toEqual(
      expect.objectContaining({ generateElectronicTickets: false })
    );
  });

  /**
   * **Validates: Requirements 1.1, 2.1**
   * Scoped case 4: Only optional field like ticketBackgroundColor
   */
  it('should persist ticketing config when only optional field ticketBackgroundColor is set', async () => {
    const row = mockEventRow(eventId);

    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);
    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

    mockGetTicketingConfigByEvent.mockResolvedValue(null);
    mockCreateTicketedEvent.mockResolvedValue({
      id: 'config-1',
      eventId,
      ticketBackgroundColor: '#FF0000',
    });

    await service.updateEvent(eventId, {
      ticketBackgroundColor: '#FF0000',
    });

    const createCalled = mockCreateTicketedEvent.mock.calls.length > 0;
    const updateCalled = mockUpdateTicketedEvent.mock.calls.length > 0;

    expect(createCalled || updateCalled).toBe(true);
  });
});
