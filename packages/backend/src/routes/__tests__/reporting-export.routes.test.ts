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

/*
 * The real `byParam('organisationId')` runs here, so the membership lookup it
 * makes has to answer. This administrator has `ORG` and nothing else — which
 * also lets the last test below check that another club's id is refused rather
 * than exported.
 */
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

import { reportingService } from '../../services/reporting.service';
import { db } from '../../database/pool';
import reportingRoutes from '../reporting.routes';

const mockReporting = reportingService as jest.Mocked<typeof reportingService>;
const mockQuery = db.query as jest.Mock;

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

/** A uuid, because the scope guard reads a malformed id as "not yours". */
const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const url = `/api/orgadmin/organisations/${ORG}/reports/export`;

beforeEach(() => {
  jest.clearAllMocks();
  mockReporting.exportReport.mockResolvedValue(Buffer.from('workbook'));
  mockQuery.mockImplementation(async (sql: string, params: any[] = []) => {
    if (/organization_users/.test(sql)) {
      const asked = params.length > 1 ? params[1] : ORG;
      return {
        rows:
          asked === ORG
            ? [{ user_id: 'ou-1', organization_id: ORG, enabled_capabilities: [], org_status: 'active' }]
            : [],
      };
    }
    return { rows: [] };
  });
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
   * An export is a bulk read of a club's data, so it is exactly the request
   * that must not be answerable for somebody else's club. The route trusted
   * `:organisationId` until `byParam` was added to it — see
   * docs/CROSS_ORGANISATION_ACCESS_FIX.md.
   */
  it('refuses to export a club the caller does not administer', async () => {
    const response = await request(server)
      .get(`/api/orgadmin/organisations/${OTHER_ORG}/reports/export`)
      .query({ reportType: 'members' });

    expect(response.status).toBe(403);
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
