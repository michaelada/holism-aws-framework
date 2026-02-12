import { EventService } from '../event.service';
import { EventActivityService } from '../event-activity.service';
import { EventEntryService } from '../event-entry.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

// Mock exceljs with a factory function
jest.mock('exceljs', () => {
  return class MockWorkbook {
    creator = '';
    created = new Date();
    worksheets: any[] = [];

    addWorksheet(name: string) {
      const mockWorksheet = {
        name: name || 'Sheet1',
        mergeCells: jest.fn(),
        getCell: jest.fn(() => ({
          value: '',
          font: {},
          alignment: {},
        })),
        addRow: jest.fn(() => ({
          font: {},
          fill: {},
          eachCell: jest.fn(),
        })),
        columns: [],
        getColumn: jest.fn(() => ({ numFmt: '' })),
        eachRow: jest.fn((callback: any) => {
          for (let i = 1; i <= 5; i++) {
            const mockRow = {
              eachCell: jest.fn((cellCallback: any) => {
                cellCallback({ border: {} });
              }),
            };
            callback(mockRow, i);
          }
        }),
      };
      this.worksheets.push(mockWorksheet);
      return mockWorksheet;
    }

    get xlsx() {
      return {
        writeBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
      };
    }
  };
});

describe('EventService', () => {
  let service: EventService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new EventService();
    jest.clearAllMocks();
  });

  describe('getEventsByOrganisation', () => {
    it('should return all events for an organisation', async () => {
      const mockEvents = [
        {
          id: '1',
          organisation_id: 'org-1',
          name: 'Summer Camp',
          description: 'Annual summer camp',
          event_owner: 'user-1',
          email_notifications: 'admin@example.com',
          start_date: new Date('2024-07-01'),
          end_date: new Date('2024-07-05'),
          open_date_entries: null,
          entries_closing_date: null,
          limit_entries: false,
          entries_limit: null,
          add_confirmation_message: false,
          confirmation_message: null,
          status: 'published',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockEvents } as any);

      const result = await service.getEventsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Summer Camp');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });
  });

  describe('getEventById', () => {
    it('should return event by ID', async () => {
      const mockEvent = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Summer Camp',
        description: 'Annual summer camp',
        event_owner: 'user-1',
        email_notifications: 'admin@example.com',
        start_date: new Date('2024-07-01'),
        end_date: new Date('2024-07-05'),
        open_date_entries: null,
        entries_closing_date: null,
        limit_entries: false,
        entries_limit: null,
        add_confirmation_message: false,
        confirmation_message: null,
        status: 'published',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockEvent] } as any);

      const result = await service.getEventById('1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Summer Camp');
    });

    it('should return null when event not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getEventById('999');

      expect(result).toBeNull();
    });
  });

  describe('createEvent', () => {
    it('should create event with all attributes', async () => {
      const newEvent = {
        organisationId: 'org-1',
        name: 'Summer Camp',
        description: 'Annual summer camp',
        eventOwner: 'user-1',
        emailNotifications: 'admin@example.com',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        limitEntries: true,
        entriesLimit: 100,
        addConfirmationMessage: true,
        confirmationMessage: 'Thank you for registering!',
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Summer Camp',
        description: 'Annual summer camp',
        event_owner: 'user-1',
        email_notifications: 'admin@example.com',
        start_date: new Date('2024-07-01'),
        end_date: new Date('2024-07-05'),
        open_date_entries: null,
        entries_closing_date: null,
        limit_entries: true,
        entries_limit: 100,
        add_confirmation_message: true,
        confirmation_message: 'Thank you for registering!',
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createEvent(newEvent);

      expect(result.name).toBe('Summer Camp');
      expect(result.limitEntries).toBe(true);
      expect(result.entriesLimit).toBe(100);
    });

    it('should throw error when end date is before start date', async () => {
      const invalidEvent = {
        organisationId: 'org-1',
        name: 'Test Event',
        description: 'Test',
        eventOwner: 'user-1',
        startDate: new Date('2024-07-05'),
        endDate: new Date('2024-07-01'),
      };

      await expect(service.createEvent(invalidEvent)).rejects.toThrow(
        'End date must be after start date'
      );
    });

    it('should throw error when limit is enabled but no limit value', async () => {
      const invalidEvent = {
        organisationId: 'org-1',
        name: 'Test Event',
        description: 'Test',
        eventOwner: 'user-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        limitEntries: true,
      };

      await expect(service.createEvent(invalidEvent)).rejects.toThrow(
        'Entries limit must be greater than 0 when limit is enabled'
      );
    });

    it('should throw error when confirmation message enabled but no message', async () => {
      const invalidEvent = {
        organisationId: 'org-1',
        name: 'Test Event',
        description: 'Test',
        eventOwner: 'user-1',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        addConfirmationMessage: true,
      };

      await expect(service.createEvent(invalidEvent)).rejects.toThrow(
        'Confirmation message is required when add confirmation message is enabled'
      );
    });
  });

  describe('updateEvent', () => {
    it('should update event fields', async () => {
      const mockExisting = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Summer Camp',
        description: 'Annual summer camp',
        event_owner: 'user-1',
        email_notifications: 'admin@example.com',
        start_date: new Date('2024-07-01'),
        end_date: new Date('2024-07-05'),
        open_date_entries: null,
        entries_closing_date: null,
        limit_entries: false,
        entries_limit: null,
        add_confirmation_message: false,
        confirmation_message: null,
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdated = {
        ...mockExisting,
        name: 'Updated Camp',
        status: 'published',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockExisting] } as any) // getEventById
        .mockResolvedValueOnce({ rows: [mockUpdated] } as any); // update

      const result = await service.updateEvent('1', {
        name: 'Updated Camp',
        status: 'published',
      });

      expect(result.name).toBe('Updated Camp');
      expect(result.status).toBe('published');
    });

    it('should throw error when event not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateEvent('999', { name: 'Test' })).rejects.toThrow(
        'Event not found'
      );
    });
  });

  describe('deleteEvent', () => {
    it('should delete event', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteEvent('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM events WHERE id = $1',
        ['1']
      );
    });

    it('should throw error when event not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(service.deleteEvent('999')).rejects.toThrow('Event not found');
    });
  });
});

describe('EventActivityService', () => {
  let service: EventActivityService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new EventActivityService();
    jest.clearAllMocks();
  });

  describe('getActivitiesByEvent', () => {
    it('should return all activities for an event', async () => {
      const mockActivities = [
        {
          id: '1',
          event_id: 'event-1',
          name: 'Under 12s',
          description: 'For children under 12',
          show_publicly: true,
          application_form_id: 'form-1',
          limit_applicants: false,
          applicants_limit: null,
          allow_specify_quantity: false,
          use_terms_and_conditions: false,
          terms_and_conditions: null,
          fee: '10.00',
          allowed_payment_method: 'card',
          handling_fee_included: false,
          cheque_payment_instructions: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockActivities } as any);

      const result = await service.getActivitiesByEvent('event-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Under 12s');
      expect(result[0].fee).toBe(10.0);
    });
  });

  describe('createActivity', () => {
    it('should create activity with enhanced attributes', async () => {
      const newActivity = {
        eventId: 'event-1',
        name: 'Under 12s',
        description: 'For children under 12',
        showPublicly: true,
        applicationFormId: 'form-1',
        limitApplicants: true,
        applicantsLimit: 50,
        allowSpecifyQuantity: true,
        useTermsAndConditions: true,
        termsAndConditions: 'You must agree to the terms',
        fee: 10.0,
        allowedPaymentMethod: 'both' as const,
        handlingFeeIncluded: true,
        chequePaymentInstructions: 'Make cheque payable to...',
      };

      const mockCreated = {
        id: '1',
        event_id: 'event-1',
        name: 'Under 12s',
        description: 'For children under 12',
        show_publicly: true,
        application_form_id: 'form-1',
        limit_applicants: true,
        applicants_limit: 50,
        allow_specify_quantity: true,
        use_terms_and_conditions: true,
        terms_and_conditions: 'You must agree to the terms',
        fee: '10.00',
        allowed_payment_method: 'both',
        handling_fee_included: true,
        cheque_payment_instructions: 'Make cheque payable to...',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createActivity(newActivity);

      expect(result.name).toBe('Under 12s');
      expect(result.limitApplicants).toBe(true);
      expect(result.applicantsLimit).toBe(50);
    });

    it('should throw error when payment method required but not provided', async () => {
      const invalidActivity = {
        eventId: 'event-1',
        name: 'Test Activity',
        fee: 10.0,
      };

      await expect(service.createActivity(invalidActivity)).rejects.toThrow(
        'Payment method is required for paid activities'
      );
    });

    it('should throw error when cheque payment allowed but no instructions', async () => {
      const invalidActivity = {
        eventId: 'event-1',
        name: 'Test Activity',
        fee: 10.0,
        allowedPaymentMethod: 'cheque' as const,
      };

      await expect(service.createActivity(invalidActivity)).rejects.toThrow(
        'Cheque payment instructions are required when cheque payment is allowed'
      );
    });
  });

  describe('updateActivity', () => {
    it('should update activity fields', async () => {
      const mockExisting = {
        id: '1',
        event_id: 'event-1',
        name: 'Under 12s',
        description: 'For children under 12',
        show_publicly: true,
        application_form_id: 'form-1',
        limit_applicants: false,
        applicants_limit: null,
        allow_specify_quantity: false,
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        fee: '10.00',
        allowed_payment_method: 'card',
        handling_fee_included: false,
        cheque_payment_instructions: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdated = {
        ...mockExisting,
        fee: '15.00',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockExisting] } as any)
        .mockResolvedValueOnce({ rows: [mockUpdated] } as any);

      const result = await service.updateActivity('1', { fee: 15.0 });

      expect(result.fee).toBe(15.0);
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteActivity('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM event_activities WHERE id = $1',
        ['1']
      );
    });
  });
});

describe('EventEntryService', () => {
  let service: EventEntryService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new EventEntryService();
    jest.clearAllMocks();
  });

  describe('getEntriesByEvent', () => {
    it('should return all entries for an event', async () => {
      const mockEntries = [
        {
          id: '1',
          event_id: 'event-1',
          event_activity_id: 'activity-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          form_submission_id: 'submission-1',
          quantity: 1,
          payment_status: 'paid',
          payment_method: 'card',
          entry_date: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          activity_name: 'Under 12s',
          event_name: 'Summer Camp',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockEntries } as any);

      const result = await service.getEntriesByEvent('event-1');

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('John');
      expect(result[0].activityName).toBe('Under 12s');
    });

    it('should filter entries by activity', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getEntriesByEvent('event-1', {
        eventActivityId: 'activity-1',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND ee.event_activity_id = $2'),
        expect.arrayContaining(['event-1', 'activity-1'])
      );
    });

    it('should filter entries by name search', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getEntriesByEvent('event-1', {
        searchName: 'John',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(ee.first_name) LIKE LOWER'),
        expect.arrayContaining(['event-1', '%John%'])
      );
    });
  });

  describe('getEntryById', () => {
    it('should return entry by ID', async () => {
      const mockEntry = {
        id: '1',
        event_id: 'event-1',
        event_activity_id: 'activity-1',
        user_id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        form_submission_id: 'submission-1',
        quantity: 1,
        payment_status: 'paid',
        payment_method: 'card',
        entry_date: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        activity_name: 'Under 12s',
        event_name: 'Summer Camp',
      };

      mockDb.query.mockResolvedValue({ rows: [mockEntry] } as any);

      const result = await service.getEntryById('1');

      expect(result).not.toBeNull();
      expect(result?.firstName).toBe('John');
    });

    it('should return null when entry not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getEntryById('999');

      expect(result).toBeNull();
    });
  });

  describe('exportEntriesToExcel', () => {
    it('should generate Excel file with entries grouped by activity', async () => {
      const mockEvent = {
        name: 'Summer Camp',
      };

      const mockEntries = [
        {
          id: '1',
          event_id: 'event-1',
          event_activity_id: 'activity-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          form_submission_id: 'submission-1',
          quantity: 1,
          payment_status: 'paid',
          payment_method: 'card',
          entry_date: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          activity_name: 'Under 12s',
          event_name: 'Summer Camp',
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockEvent] } as any) // getEvent
        .mockResolvedValueOnce({ rows: mockEntries } as any); // getEntries

      // The Excel export functionality is mocked, so we just verify it returns a buffer
      const result = await service.exportEntriesToExcel('event-1');

      // Verify we got a buffer back from the mock
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error when event not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.exportEntriesToExcel('999')).rejects.toThrow(
        'Event not found'
      );
    });
  });
});
