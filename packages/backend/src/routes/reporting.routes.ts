import { Router, Request, Response } from 'express';
import { reportingService } from '../services/reporting.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/reports/dashboard:
 *   get:
 *     summary: Get dashboard metrics for an organisation
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: recentDays
 *         schema:
 *           type: number
 *           default: 30
 *         description: Number of days for recent metrics
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
router.get(
  '/organisations/:organisationId/reports/dashboard',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { recentDays } = req.query;

      const metrics = await reportingService.getDashboardMetrics(
        organisationId,
        recentDays ? parseInt(recentDays as string, 10) : 30
      );

      res.json(metrics);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/reports/dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/reports/events:
 *   get:
 *     summary: Get events report for an organisation
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by specific event
 *     responses:
 *       200:
 *         description: Events report data
 */
router.get(
  '/organisations/:organisationId/reports/events',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { startDate, endDate, eventId } = req.query;

      // Build filters
      const filters: any = {};

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      if (eventId) {
        filters.eventId = eventId as string;
      }

      const report = await reportingService.getEventsReport(organisationId, filters);

      res.json(report);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/reports/events:', error);
      res.status(500).json({ error: 'Failed to fetch events report' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/reports/members:
 *   get:
 *     summary: Get members report for an organisation
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: membershipTypeId
 *         schema:
 *           type: string
 *         description: Filter by specific membership type
 *     responses:
 *       200:
 *         description: Members report data
 */
router.get(
  '/organisations/:organisationId/reports/members',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { startDate, endDate, membershipTypeId } = req.query;

      // Build filters
      const filters: any = {};

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      if (membershipTypeId) {
        filters.membershipTypeId = membershipTypeId as string;
      }

      const report = await reportingService.getMembersReport(organisationId, filters);

      res.json(report);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/reports/members:', error);
      res.status(500).json({ error: 'Failed to fetch members report' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/reports/revenue:
 *   get:
 *     summary: Get revenue report for an organisation
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: Revenue report data
 */
router.get(
  '/organisations/:organisationId/reports/revenue',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { startDate, endDate } = req.query;

      // Build filters
      const filters: any = {};

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const report = await reportingService.getRevenueReport(organisationId, filters);

      res.json(report);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/reports/revenue:', error);
      res.status(500).json({ error: 'Failed to fetch revenue report' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/reports/export:
 *   get:
 *     summary: Export report to Excel
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: reportType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [events, members, revenue]
 *         description: Type of report to export
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by specific event (events report only)
 *       - in: query
 *         name: membershipTypeId
 *         schema:
 *           type: string
 *         description: Filter by specific membership type (members report only)
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid report type
 */
router.get(
  '/organisations/:organisationId/reports/export',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { reportType, startDate, endDate, eventId, membershipTypeId } = req.query;

      // Validate report type
      if (!reportType || !['events', 'members', 'revenue'].includes(reportType as string)) {
        return res.status(400).json({ 
          error: 'Invalid report type. Must be one of: events, members, revenue' 
        });
      }

      // Build filters
      const filters: any = {};

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      if (eventId) {
        filters.eventId = eventId as string;
      }

      if (membershipTypeId) {
        filters.membershipTypeId = membershipTypeId as string;
      }

      const buffer = await reportingService.exportReport(
        organisationId,
        reportType as 'events' | 'members' | 'revenue',
        filters
      );

      // Set headers for file download
      const filename = `${reportType}_report_${organisationId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      return res.send(buffer);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/reports/export:', error);
      return res.status(500).json({ error: 'Failed to export report' });
    }
  }
);

export default router;
