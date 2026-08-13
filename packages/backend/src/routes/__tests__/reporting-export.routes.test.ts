import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

/**
 * Exporting a report.
 *
 * This endpoint has existed and worked since reporting was built, but nothing
 * called it: every export button in the org-admin UI logged to the console.
 * Now that the buttons are wired to it, what it answers with is a contract —
 * hence a test at the route, not only at the service.
 */

jest.mock('../../config/logger');

jest.mock('../../services/reporting.service', () => ({
  reportingService: {
    exportReport: jest.fn(),
    getDashboardMetrics: jest.fn(),
    getEventsReport: jest.fn(),
    getMembersReport: jest.fn(),
    getRevenueReport: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-admin', email: 'a@example.com', roles: [], groups: [] };
    return next();
  },
}));

import { reportingService } from '../../services/reporting.service';
import reportingRoutes from '../reporting.routes';

const mockReporting = reportingService as jest.Mocked<typeof reportingService>;

const app = express();
app.use(express.json());
app.use('/api/orgadmin', reportingRoutes);

let server: Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

const ORG = 'org-1';
const url = `/api/orgadmin/organisations/${ORG}/reports/export`;

beforeEach(() => {
  jest.clearAllMocks();
  mockReporting.exportReport.mockResolvedValue(Buffer.from('workbook'));
});

describe('GET /organisations/:organisationId/reports/export', () => {
  it.each(['events', 'members', 'revenue'] as const)(
    'builds the %s report for the organisation',
    async (reportType) => {
      const response = await request(server).get(url).query({ reportType });

      expect(response.status).toBe(200);
      expect(mockReporting.exportReport).toHaveBeenCalledWith(ORG, reportType, expect.any(Object));
    }
  );

  /** Otherwise the browser shows the workbook's bytes instead of saving it. */
  it('answers as a spreadsheet attachment, named for the report and the day', async () => {
    const response = await request(server).get(url).query({ reportType: 'events' });

    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="events_report_.*\.xlsx"/
    );
  });

  it('passes the date range the page is showing', async () => {
    await request(server)
      .get(url)
      .query({ reportType: 'revenue', startDate: '2026-01-01', endDate: '2026-03-31' });

    const filters = mockReporting.exportReport.mock.calls[0][2] as {
      startDate: Date;
      endDate: Date;
    };
    expect(filters.startDate.toISOString()).toContain('2026-01-01');
    expect(filters.endDate.toISOString()).toContain('2026-03-31');
  });

  it('passes the narrower filters a report offers', async () => {
    await request(server)
      .get(url)
      .query({ reportType: 'members', membershipTypeId: 'type-7', eventId: 'event-3' });

    expect(mockReporting.exportReport).toHaveBeenCalledWith(
      ORG,
      'members',
      expect.objectContaining({ membershipTypeId: 'type-7', eventId: 'event-3' })
    );
  });

  /** The dashboard is a summary of three reports, not a fourth one. */
  it('refuses a report type it does not have', async () => {
    const response = await request(server).get(url).query({ reportType: 'dashboard' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/events, members, revenue/);
    expect(mockReporting.exportReport).not.toHaveBeenCalled();
  });

  it('refuses a request that names no report at all', async () => {
    const response = await request(server).get(url);

    expect(response.status).toBe(400);
    expect(mockReporting.exportReport).not.toHaveBeenCalled();
  });

  /**
   * The screen tells the user the export failed; it can only do that if the
   * failure arrives as a status rather than as a half-written file.
   */
  it('reports a failure rather than sending a broken file', async () => {
    mockReporting.exportReport.mockRejectedValue(new Error('database is away'));

    const response = await request(server).get(url).query({ reportType: 'events' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to export report');
  });
});
