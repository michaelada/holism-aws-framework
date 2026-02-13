import { ReportingService } from '../reporting.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

// Mock exceljs
jest.mock('exceljs', () => {
  return class MockWorkbook {
    creator = '';
    created = new Date();
    worksheets: any[] = [];

    addWorksheet(name: string) {
      const mockWorksheet = {
        name: name || 'Sheet1',
        columns: [],
        addRow: jest.fn(() => ({
          font: {},
          fill: {},
        })),
        getRow: jest.fn(() => ({
          font: {},
          fill: {},
        })),
        getColumn: jest.fn(() => ({ numFmt: '' })),
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

describe('ReportingService', () => {
  let service: ReportingService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new ReportingService();
    jest.clearAllMocks();
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics for an organisation', async () => {
      const mockEventsResult = {
        rows: [{ total: '10', recent: '3' }],
      };
      const mockMembersResult = {
        rows: [{ total: '50', recent: '5' }],
      };
      const mockRevenueResult = {
        rows: [
          {
            total_revenue: '5000.00',
            total_payments: '25',
            recent_revenue: '500.00',
            recent_payments: '5',
          },
        ],
      };

      mockDb.query
        .mockResolvedValueOnce(mockEventsResult as any)
        .mockResolvedValueOnce(mockMembersResult as any)
        .mockResolvedValueOnce(mockRevenueResult as any);

      const result = await service.getDashboardMetrics('org-1', 30);

      expect(result.totalEvents).toBe(10);
      expect(result.totalMembers).toBe(50);
      expect(result.totalRevenue).toBe(5000.0);
      expect(result.totalPayments).toBe(25);
      expect(result.recentEvents).toBe(3);
      expect(result.recentMembers).toBe(5);
      expect(result.recentRevenue).toBe(500.0);
      expect(result.recentPayments).toBe(5);
    });

    it('should handle zero metrics', async () => {
      const mockEventsResult = {
        rows: [{ total: '0', recent: '0' }],
      };
      const mockMembersResult = {
        rows: [{ total: '0', recent: '0' }],
      };
      const mockRevenueResult = {
        rows: [
          {
            total_revenue: null,
            total_payments: '0',
            recent_revenue: null,
            recent_payments: '0',
          },
        ],
      };

      mockDb.query
        .mockResolvedValueOnce(mockEventsResult as any)
        .mockResolvedValueOnce(mockMembersResult as any)
        .mockResolvedValueOnce(mockRevenueResult as any);

      const result = await service.getDashboardMetrics('org-1');

      expect(result.totalEvents).toBe(0);
      expect(result.totalMembers).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalPayments).toBe(0);
      expect(result.recentEvents).toBe(0);
      expect(result.recentMembers).toBe(0);
      expect(result.recentRevenue).toBe(0);
      expect(result.recentPayments).toBe(0);
    });

    it('should use custom recent days parameter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '10', recent: '2' }] } as any)
        .mockResolvedValueOnce({ rows: [{ total: '50', recent: '3' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              total_revenue: '5000.00',
              total_payments: '25',
              recent_revenue: '300.00',
              recent_payments: '3',
            },
          ],
        } as any);

      await service.getDashboardMetrics('org-1', 7);

      // Verify that the date calculation uses 7 days
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['org-1', expect.any(Date)])
      );
    });
  });

  describe('getEventsReport', () => {
    it('should return events report with activities', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          event_name: 'Summer Camp',
          start_date: new Date('2024-07-01'),
          end_date: new Date('2024-07-05'),
          total_entries: '20',
          total_revenue: '1000.00',
        },
      ];

      const mockActivities = [
        {
          activity_id: 'activity-1',
          activity_name: 'Under 12s',
          entries: '10',
          revenue: '500.00',
        },
        {
          activity_id: 'activity-2',
          activity_name: 'Under 16s',
          entries: '10',
          revenue: '500.00',
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockEvents } as any)
        .mockResolvedValueOnce({ rows: mockActivities } as any);

      const result = await service.getEventsReport('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe('event-1');
      expect(result[0].eventName).toBe('Summer Camp');
      expect(result[0].totalEntries).toBe(20);
      expect(result[0].totalRevenue).toBe(1000.0);
      expect(result[0].activities).toHaveLength(2);
      expect(result[0].activities[0].activityName).toBe('Under 12s');
      expect(result[0].activities[0].entries).toBe(10);
      expect(result[0].activities[0].revenue).toBe(500.0);
    });

    it('should filter events by date range', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.getEventsReport('org-1', { startDate, endDate });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND e.start_date >='),
        expect.arrayContaining(['org-1', startDate, endDate])
      );
    });

    it('should filter events by event ID', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.getEventsReport('org-1', { eventId: 'event-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND e.id ='),
        expect.arrayContaining(['org-1', 'event-1'])
      );
    });

    it('should handle events with no activities', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          event_name: 'Summer Camp',
          start_date: new Date('2024-07-01'),
          end_date: new Date('2024-07-05'),
          total_entries: '0',
          total_revenue: '0.00',
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockEvents } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.getEventsReport('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].activities).toHaveLength(0);
    });
  });

  describe('getMembersReport', () => {
    it('should return members report by membership type', async () => {
      const mockMembers = [
        {
          membership_type_id: 'type-1',
          membership_type_name: 'Adult Membership',
          active_members: '30',
          pending_members: '5',
          elapsed_members: '10',
          total_members: '45',
          total_revenue: '2250.00',
        },
        {
          membership_type_id: 'type-2',
          membership_type_name: 'Child Membership',
          active_members: '20',
          pending_members: '3',
          elapsed_members: '5',
          total_members: '28',
          total_revenue: '700.00',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockMembers } as any);

      const result = await service.getMembersReport('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].membershipTypeId).toBe('type-1');
      expect(result[0].membershipTypeName).toBe('Adult Membership');
      expect(result[0].activeMembers).toBe(30);
      expect(result[0].pendingMembers).toBe(5);
      expect(result[0].elapsedMembers).toBe(10);
      expect(result[0].totalMembers).toBe(45);
      expect(result[0].totalRevenue).toBe(2250.0);
    });

    it('should filter members by date range', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.getMembersReport('org-1', { startDate, endDate });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND m.date_last_renewed >='),
        expect.arrayContaining(['org-1', startDate, endDate])
      );
    });

    it('should filter members by membership type', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getMembersReport('org-1', { membershipTypeId: 'type-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND mt.id ='),
        expect.arrayContaining(['org-1', 'type-1'])
      );
    });

    it('should handle membership types with no members', async () => {
      const mockMembers = [
        {
          membership_type_id: 'type-1',
          membership_type_name: 'Adult Membership',
          active_members: '0',
          pending_members: '0',
          elapsed_members: '0',
          total_members: '0',
          total_revenue: '0.00',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockMembers } as any);

      const result = await service.getMembersReport('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalMembers).toBe(0);
      expect(result[0].totalRevenue).toBe(0);
    });
  });

  describe('getRevenueReport', () => {
    it('should return revenue report by payment type', async () => {
      const mockRevenue = [
        {
          source: 'event_entry',
          currency: 'EUR',
          total_revenue: '5000.00',
          transaction_count: '50',
          average_transaction: '100.00',
        },
        {
          source: 'membership',
          currency: 'EUR',
          total_revenue: '3000.00',
          transaction_count: '60',
          average_transaction: '50.00',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRevenue } as any);

      const result = await service.getRevenueReport('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('event_entry');
      expect(result[0].totalRevenue).toBe(5000.0);
      expect(result[0].transactionCount).toBe(50);
      expect(result[0].averageTransaction).toBe(100.0);
      expect(result[0].currency).toBe('EUR');
    });

    it('should filter revenue by date range', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.getRevenueReport('org-1', { startDate, endDate });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND payment_date >='),
        expect.arrayContaining(['org-1', startDate, endDate])
      );
    });

    it('should only include paid payments', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getRevenueReport('org-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("AND payment_status = 'paid'"),
        ['org-1']
      );
    });

    it('should handle no revenue', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getRevenueReport('org-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('exportReport', () => {
    it('should export events report to Excel', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          event_name: 'Summer Camp',
          start_date: new Date('2024-07-01'),
          end_date: new Date('2024-07-05'),
          total_entries: '20',
          total_revenue: '1000.00',
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockEvents } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.exportReport('org-1', 'events');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should export members report to Excel', async () => {
      const mockMembers = [
        {
          membership_type_id: 'type-1',
          membership_type_name: 'Adult Membership',
          active_members: '30',
          pending_members: '5',
          elapsed_members: '10',
          total_members: '45',
          total_revenue: '2250.00',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockMembers } as any);

      const result = await service.exportReport('org-1', 'members');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should export revenue report to Excel', async () => {
      const mockRevenue = [
        {
          source: 'event_entry',
          currency: 'EUR',
          total_revenue: '5000.00',
          transaction_count: '50',
          average_transaction: '100.00',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRevenue } as any);

      const result = await service.exportReport('org-1', 'revenue');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should throw error for invalid report type', async () => {
      await expect(
        service.exportReport('org-1', 'invalid' as any)
      ).rejects.toThrow('Unknown report type: invalid');
    });

    it('should apply filters when exporting', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.exportReport('org-1', 'events', { startDate, endDate });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND e.start_date >='),
        expect.arrayContaining(['org-1', startDate, endDate])
      );
    });

    it('should handle empty data when exporting', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.exportReport('org-1', 'revenue');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
