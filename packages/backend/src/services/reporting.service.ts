import { db } from '../database/pool';
import { logger } from '../config/logger';
import ExcelJS from 'exceljs';

/**
 * Dashboard metrics interface
 */
export interface DashboardMetrics {
  totalEvents: number;
  totalMembers: number;
  totalRevenue: number;
  totalPayments: number;
  recentEvents: number;
  recentMembers: number;
  recentRevenue: number;
  recentPayments: number;
}

/**
 * Events report data interface
 */
export interface EventsReportData {
  eventId: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  totalEntries: number;
  totalRevenue: number;
  activities: EventActivityReport[];
}

export interface EventActivityReport {
  activityId: string;
  activityName: string;
  entries: number;
  revenue: number;
}

/**
 * Members report data interface
 */
export interface MembersReportData {
  membershipTypeId: string;
  membershipTypeName: string;
  activeMembers: number;
  pendingMembers: number;
  elapsedMembers: number;
  totalMembers: number;
  totalRevenue: number;
}

/**
 * Revenue report data interface
 */
export interface RevenueReportData {
  source: string;
  totalRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  currency: string;
}

/**
 * Report filters interface
 */
export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  eventId?: string;
  membershipTypeId?: string;
  paymentStatus?: string[];
}

/**
 * Service for generating reports and analytics
 */
export class ReportingService {
  /**
   * Get dashboard metrics for an organisation
   */
  async getDashboardMetrics(
    organisationId: string,
    recentDays: number = 30
  ): Promise<DashboardMetrics> {
    try {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - recentDays);

      // Get total events
      const eventsResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN created_at >= $2 THEN 1 END) as recent
         FROM events
         WHERE organisation_id = $1`,
        [organisationId, recentDate]
      );

      // Get total members
      const membersResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN created_at >= $2 THEN 1 END) as recent
         FROM members
         WHERE organisation_id = $1`,
        [organisationId, recentDate]
      );

      // Get revenue and payment counts
      const revenueResult = await db.query(
        `SELECT 
          SUM(amount) as total_revenue,
          COUNT(*) as total_payments,
          SUM(CASE WHEN payment_date >= $2 THEN amount ELSE 0 END) as recent_revenue,
          COUNT(CASE WHEN payment_date >= $2 THEN 1 END) as recent_payments
         FROM payments
         WHERE organisation_id = $1 AND payment_status = 'paid'`,
        [organisationId, recentDate]
      );

      return {
        totalEvents: parseInt(eventsResult.rows[0]?.total || '0', 10),
        totalMembers: parseInt(membersResult.rows[0]?.total || '0', 10),
        totalRevenue: parseFloat(revenueResult.rows[0]?.total_revenue || '0'),
        totalPayments: parseInt(revenueResult.rows[0]?.total_payments || '0', 10),
        recentEvents: parseInt(eventsResult.rows[0]?.recent || '0', 10),
        recentMembers: parseInt(membersResult.rows[0]?.recent || '0', 10),
        recentRevenue: parseFloat(revenueResult.rows[0]?.recent_revenue || '0'),
        recentPayments: parseInt(revenueResult.rows[0]?.recent_payments || '0', 10),
      };
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get events report for an organisation
   */
  async getEventsReport(
    organisationId: string,
    filters?: ReportFilters
  ): Promise<EventsReportData[]> {
    try {
      let query = `
        SELECT 
          e.id as event_id,
          e.name as event_name,
          e.start_date,
          e.end_date,
          COUNT(DISTINCT ee.id) as total_entries,
          COALESCE(SUM(p.amount), 0) as total_revenue
        FROM events e
        LEFT JOIN event_entries ee ON e.id = ee.event_id
        LEFT JOIN payments p ON ee.id = p.context_id 
          AND p.payment_type = 'event_entry' 
          AND p.payment_status = 'paid'
        WHERE e.organisation_id = $1
      `;
      const params: any[] = [organisationId];
      let paramCount = 2;

      // Apply filters
      if (filters) {
        if (filters.startDate) {
          query += ` AND e.start_date >= $${paramCount}`;
          params.push(filters.startDate);
          paramCount++;
        }

        if (filters.endDate) {
          query += ` AND e.end_date <= $${paramCount}`;
          params.push(filters.endDate);
          paramCount++;
        }

        if (filters.eventId) {
          query += ` AND e.id = $${paramCount}`;
          params.push(filters.eventId);
          paramCount++;
        }
      }

      query += `
        GROUP BY e.id, e.name, e.start_date, e.end_date
        ORDER BY e.start_date DESC
      `;

      const result = await db.query(query, params);

      // Get activity details for each event
      const eventsData: EventsReportData[] = [];
      for (const row of result.rows) {
        const activitiesResult = await db.query(
          `SELECT 
            ea.id as activity_id,
            ea.name as activity_name,
            COUNT(DISTINCT ee.id) as entries,
            COALESCE(SUM(p.amount), 0) as revenue
           FROM event_activities ea
           LEFT JOIN event_entries ee ON ea.id = ee.event_activity_id
           LEFT JOIN payments p ON ee.id = p.context_id 
             AND p.payment_type = 'event_entry' 
             AND p.payment_status = 'paid'
           WHERE ea.event_id = $1
           GROUP BY ea.id, ea.name
           ORDER BY ea.name`,
          [row.event_id]
        );

        eventsData.push({
          eventId: row.event_id,
          eventName: row.event_name,
          startDate: row.start_date,
          endDate: row.end_date,
          totalEntries: parseInt(row.total_entries, 10),
          totalRevenue: parseFloat(row.total_revenue),
          activities: activitiesResult.rows.map(actRow => ({
            activityId: actRow.activity_id,
            activityName: actRow.activity_name,
            entries: parseInt(actRow.entries, 10),
            revenue: parseFloat(actRow.revenue),
          })),
        });
      }

      return eventsData;
    } catch (error) {
      logger.error('Error getting events report:', error);
      throw error;
    }
  }

  /**
   * Get members report for an organisation
   */
  async getMembersReport(
    organisationId: string,
    filters?: ReportFilters
  ): Promise<MembersReportData[]> {
    try {
      let query = `
        SELECT 
          mt.id as membership_type_id,
          mt.name as membership_type_name,
          COUNT(CASE WHEN m.status = 'active' THEN 1 END) as active_members,
          COUNT(CASE WHEN m.status = 'pending' THEN 1 END) as pending_members,
          COUNT(CASE WHEN m.status = 'elapsed' THEN 1 END) as elapsed_members,
          COUNT(m.id) as total_members,
          COALESCE(SUM(p.amount), 0) as total_revenue
        FROM membership_types mt
        LEFT JOIN members m ON mt.id = m.membership_type_id
        LEFT JOIN payments p ON m.id = p.context_id 
          AND p.payment_type = 'membership' 
          AND p.payment_status = 'paid'
        WHERE mt.organisation_id = $1
      `;
      const params: any[] = [organisationId];
      let paramCount = 2;

      // Apply filters
      if (filters) {
        if (filters.startDate) {
          query += ` AND m.date_last_renewed >= $${paramCount}`;
          params.push(filters.startDate);
          paramCount++;
        }

        if (filters.endDate) {
          query += ` AND m.date_last_renewed <= $${paramCount}`;
          params.push(filters.endDate);
          paramCount++;
        }

        if (filters.membershipTypeId) {
          query += ` AND mt.id = $${paramCount}`;
          params.push(filters.membershipTypeId);
          paramCount++;
        }
      }

      query += `
        GROUP BY mt.id, mt.name
        ORDER BY mt.name
      `;

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        membershipTypeId: row.membership_type_id,
        membershipTypeName: row.membership_type_name,
        activeMembers: parseInt(row.active_members, 10),
        pendingMembers: parseInt(row.pending_members, 10),
        elapsedMembers: parseInt(row.elapsed_members, 10),
        totalMembers: parseInt(row.total_members, 10),
        totalRevenue: parseFloat(row.total_revenue),
      }));
    } catch (error) {
      logger.error('Error getting members report:', error);
      throw error;
    }
  }

  /**
   * Get revenue report for an organisation
   */
  async getRevenueReport(
    organisationId: string,
    filters?: ReportFilters
  ): Promise<RevenueReportData[]> {
    try {
      let query = `
        SELECT 
          payment_type as source,
          currency,
          SUM(amount) as total_revenue,
          COUNT(*) as transaction_count,
          AVG(amount) as average_transaction
        FROM payments
        WHERE organisation_id = $1 AND payment_status = 'paid'
      `;
      const params: any[] = [organisationId];
      let paramCount = 2;

      // Apply filters
      if (filters) {
        if (filters.startDate) {
          query += ` AND payment_date >= $${paramCount}`;
          params.push(filters.startDate);
          paramCount++;
        }

        if (filters.endDate) {
          query += ` AND payment_date <= $${paramCount}`;
          params.push(filters.endDate);
          paramCount++;
        }
      }

      query += `
        GROUP BY payment_type, currency
        ORDER BY total_revenue DESC
      `;

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        source: row.source,
        totalRevenue: parseFloat(row.total_revenue),
        transactionCount: parseInt(row.transaction_count, 10),
        averageTransaction: parseFloat(row.average_transaction),
        currency: row.currency,
      }));
    } catch (error) {
      logger.error('Error getting revenue report:', error);
      throw error;
    }
  }

  /**
   * Export report to Excel
   */
  async exportReport(
    organisationId: string,
    reportType: 'events' | 'members' | 'revenue',
    filters?: ReportFilters
  ): Promise<Buffer> {
    try {
      const workbook = new ExcelJS();

      switch (reportType) {
        case 'events':
          await this.exportEventsReport(workbook, organisationId, filters);
          break;
        case 'members':
          await this.exportMembersReport(workbook, organisationId, filters);
          break;
        case 'revenue':
          await this.exportRevenueReport(workbook, organisationId, filters);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.error('Error exporting report:', error);
      throw error;
    }
  }

  /**
   * Export events report to Excel workbook
   */
  private async exportEventsReport(
    workbook: any,
    organisationId: string,
    filters?: ReportFilters
  ): Promise<void> {
    const eventsData = await this.getEventsReport(organisationId, filters);
    const worksheet = workbook.addWorksheet('Events Report');

    // Define columns
    worksheet.columns = [
      { header: 'Event Name', key: 'eventName', width: 30 },
      { header: 'Start Date', key: 'startDate', width: 20 },
      { header: 'End Date', key: 'endDate', width: 20 },
      { header: 'Total Entries', key: 'totalEntries', width: 15 },
      { header: 'Total Revenue', key: 'totalRevenue', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    eventsData.forEach(event => {
      worksheet.addRow({
        eventName: event.eventName,
        startDate: new Date(event.startDate).toLocaleDateString(),
        endDate: new Date(event.endDate).toLocaleDateString(),
        totalEntries: event.totalEntries,
        totalRevenue: event.totalRevenue,
      });

      // Add activity details
      event.activities.forEach(activity => {
        worksheet.addRow({
          eventName: `  - ${activity.activityName}`,
          startDate: '',
          endDate: '',
          totalEntries: activity.entries,
          totalRevenue: activity.revenue,
        });
      });
    });

    // Format revenue column as currency
    worksheet.getColumn('totalRevenue').numFmt = '#,##0.00';
  }

  /**
   * Export members report to Excel workbook
   */
  private async exportMembersReport(
    workbook: any,
    organisationId: string,
    filters?: ReportFilters
  ): Promise<void> {
    const membersData = await this.getMembersReport(organisationId, filters);
    const worksheet = workbook.addWorksheet('Members Report');

    // Define columns
    worksheet.columns = [
      { header: 'Membership Type', key: 'membershipTypeName', width: 30 },
      { header: 'Active Members', key: 'activeMembers', width: 15 },
      { header: 'Pending Members', key: 'pendingMembers', width: 15 },
      { header: 'Elapsed Members', key: 'elapsedMembers', width: 15 },
      { header: 'Total Members', key: 'totalMembers', width: 15 },
      { header: 'Total Revenue', key: 'totalRevenue', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    membersData.forEach(memberType => {
      worksheet.addRow({
        membershipTypeName: memberType.membershipTypeName,
        activeMembers: memberType.activeMembers,
        pendingMembers: memberType.pendingMembers,
        elapsedMembers: memberType.elapsedMembers,
        totalMembers: memberType.totalMembers,
        totalRevenue: memberType.totalRevenue,
      });
    });

    // Format revenue column as currency
    worksheet.getColumn('totalRevenue').numFmt = '#,##0.00';
  }

  /**
   * Export revenue report to Excel workbook
   */
  private async exportRevenueReport(
    workbook: any,
    organisationId: string,
    filters?: ReportFilters
  ): Promise<void> {
    const revenueData = await this.getRevenueReport(organisationId, filters);
    const worksheet = workbook.addWorksheet('Revenue Report');

    // Define columns
    worksheet.columns = [
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Total Revenue', key: 'totalRevenue', width: 15 },
      { header: 'Transaction Count', key: 'transactionCount', width: 18 },
      { header: 'Average Transaction', key: 'averageTransaction', width: 20 },
      { header: 'Currency', key: 'currency', width: 12 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    revenueData.forEach(revenue => {
      worksheet.addRow({
        source: revenue.source,
        totalRevenue: revenue.totalRevenue,
        transactionCount: revenue.transactionCount,
        averageTransaction: revenue.averageTransaction,
        currency: revenue.currency,
      });
    });

    // Format currency columns
    worksheet.getColumn('totalRevenue').numFmt = '#,##0.00';
    worksheet.getColumn('averageTransaction').numFmt = '#,##0.00';
  }
}

// Create singleton instance
export const reportingService = new ReportingService();
