import { db } from '../database/pool';
import { logger } from '../config/logger';
import ExcelJS from 'exceljs';

/**
 * EventEntry interface matching database schema
 */
export interface EventEntry {
  id: string;
  eventId: string;
  eventActivityId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  formSubmissionId?: string;
  quantity: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields from joins
  activityName?: string;
  eventName?: string;
}

/**
 * Filter options for event entries
 */
export interface EventEntryFilters {
  eventActivityId?: string;
  searchName?: string;
}

/**
 * Service for managing event entries
 */
export class EventEntryService {
  /**
   * Convert database row to EventEntry object
   */
  private rowToEventEntry(row: any): EventEntry {
    return {
      id: row.id,
      eventId: row.event_id,
      eventActivityId: row.event_activity_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      formSubmissionId: row.form_submission_id,
      quantity: row.quantity,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      entryDate: row.entry_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activityName: row.activity_name,
      eventName: row.event_name,
    };
  }

  /**
   * Get all entries for an event
   */
  async getEntriesByEvent(eventId: string, filters?: EventEntryFilters): Promise<EventEntry[]> {
    try {
      let query = `
        SELECT 
          ee.*,
          ea.name as activity_name,
          e.name as event_name
        FROM event_entries ee
        JOIN event_activities ea ON ee.event_activity_id = ea.id
        JOIN events e ON ee.event_id = e.id
        WHERE ee.event_id = $1
      `;
      const params: any[] = [eventId];
      let paramCount = 2;

      // Apply activity filter
      if (filters?.eventActivityId) {
        query += ` AND ee.event_activity_id = $${paramCount++}`;
        params.push(filters.eventActivityId);
      }

      // Apply name search filter
      if (filters?.searchName) {
        query += ` AND (
          LOWER(ee.first_name) LIKE LOWER($${paramCount}) OR 
          LOWER(ee.last_name) LIKE LOWER($${paramCount})
        )`;
        params.push(`%${filters.searchName}%`);
        paramCount++;
      }

      query += ' ORDER BY ee.entry_date DESC';

      const result = await db.query(query, params);
      return result.rows.map(row => this.rowToEventEntry(row));
    } catch (error) {
      logger.error('Error getting entries by event:', error);
      throw error;
    }
  }

  /**
   * Get entry by ID
   */
  async getEntryById(id: string): Promise<EventEntry | null> {
    try {
      const result = await db.query(
        `SELECT 
          ee.*,
          ea.name as activity_name,
          e.name as event_name
        FROM event_entries ee
        JOIN event_activities ea ON ee.event_activity_id = ea.id
        JOIN events e ON ee.event_id = e.id
        WHERE ee.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEventEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error getting entry by ID:', error);
      throw error;
    }
  }

  /**
   * Filter entries by activity and name
   */
  async filterEntries(eventId: string, filters: EventEntryFilters): Promise<EventEntry[]> {
    return this.getEntriesByEvent(eventId, filters);
  }

  /**
   * Export entries to Excel with separate tables per activity
   */
  async exportEntriesToExcel(eventId: string): Promise<Buffer> {
    try {
      // Get event details
      const eventResult = await db.query(
        'SELECT name FROM events WHERE id = $1',
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        throw new Error('Event not found');
      }

      const eventName = eventResult.rows[0].name;

      // Get all entries grouped by activity
      const entries = await this.getEntriesByEvent(eventId);

      // Group entries by activity
      const entriesByActivity = entries.reduce((acc, entry) => {
        const activityName = entry.activityName || 'Unknown Activity';
        if (!acc[activityName]) {
          acc[activityName] = [];
        }
        acc[activityName].push(entry);
        return acc;
      }, {} as Record<string, EventEntry[]>);

      // Create workbook
      const workbook = new ExcelJS();
      workbook.creator = 'ItsPlainSailing';
      workbook.created = new Date();

      // Create a worksheet for each activity
      for (const [activityName, activityEntries] of Object.entries(entriesByActivity)) {
        // Sanitize sheet name (Excel has restrictions)
        const sheetName = activityName.substring(0, 31).replace(/[:\\/?*\[\]]/g, '_');
        const worksheet = workbook.addWorksheet(sheetName);

        // Add title
        worksheet.mergeCells('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `${eventName} - ${activityName}`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        // Add headers
        worksheet.addRow([]);
        const headerRow = worksheet.addRow([
          'Entry Date',
          'First Name',
          'Last Name',
          'Email',
          'Quantity',
          'Payment Status',
          'Payment Method',
          'Entry ID',
        ]);

        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        // Add data rows
        activityEntries.forEach(entry => {
          worksheet.addRow([
            entry.entryDate,
            entry.firstName,
            entry.lastName,
            entry.email,
            entry.quantity,
            entry.paymentStatus,
            entry.paymentMethod || 'N/A',
            entry.id,
          ]);
        });

        // Format columns
        worksheet.columns = [
          { key: 'entryDate', width: 20 },
          { key: 'firstName', width: 15 },
          { key: 'lastName', width: 15 },
          { key: 'email', width: 25 },
          { key: 'quantity', width: 10 },
          { key: 'paymentStatus', width: 15 },
          { key: 'paymentMethod', width: 15 },
          { key: 'id', width: 36 },
        ];

        // Format date column
        worksheet.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm:ss';

        // Add borders
        worksheet.eachRow((row: any, rowNumber: number) => {
          if (rowNumber > 2) {
            row.eachCell((cell: any) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            });
          }
        });

        // Add summary row
        worksheet.addRow([]);
        const summaryRow = worksheet.addRow([
          'Total Entries:',
          activityEntries.length,
          '',
          '',
          'Total Quantity:',
          activityEntries.reduce((sum, entry) => sum + entry.quantity, 0),
        ]);
        summaryRow.font = { bold: true };
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      logger.info(`Excel export generated for event: ${eventId}`);
      return buffer as Buffer;
    } catch (error) {
      logger.error('Error exporting entries to Excel:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const eventEntryService = new EventEntryService();
