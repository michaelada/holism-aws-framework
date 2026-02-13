import { db } from '../database/pool';
import { logger } from '../config/logger';
import ExcelJS from 'exceljs';

/**
 * Payment interface matching database schema
 */
export interface Payment {
  id: string;
  organisationId: string;
  userId: string;
  paymentType: string;
  contextId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentProvider?: string;
  providerTransactionId?: string;
  paymentDate?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Refund interface matching database schema
 */
export interface Refund {
  id: string;
  paymentId: string;
  organisationId: string;
  refundAmount: number;
  refundReason?: string;
  refundStatus: string;
  refundProvider?: string;
  providerRefundId?: string;
  refundDate?: Date;
  requestedBy: string;
  requestedAt: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lodgement summary interface
 */
export interface Lodgement {
  date: Date;
  paymentMethod: string;
  totalAmount: number;
  transactionCount: number;
  currency: string;
}

/**
 * DTO for requesting a refund
 */
export interface RequestRefundDto {
  paymentId: string;
  organisationId: string;
  refundAmount: number;
  refundReason?: string;
  requestedBy: string;
}

/**
 * Filter options for payments
 */
export interface PaymentFilters {
  paymentStatus?: string[];
  paymentMethod?: string[];
  paymentType?: string[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

/**
 * Service for managing payments and refunds
 */
export class PaymentService {
  /**
   * Convert database row to Payment object
   */
  private rowToPayment(row: any): Payment {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      userId: row.user_id,
      paymentType: row.payment_type,
      contextId: row.context_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      paymentProvider: row.payment_provider,
      providerTransactionId: row.provider_transaction_id,
      paymentDate: row.payment_date,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to Refund object
   */
  private rowToRefund(row: any): Refund {
    return {
      id: row.id,
      paymentId: row.payment_id,
      organisationId: row.organisation_id,
      refundAmount: parseFloat(row.refund_amount),
      refundReason: row.refund_reason,
      refundStatus: row.refund_status,
      refundProvider: row.refund_provider,
      providerRefundId: row.provider_refund_id,
      refundDate: row.refund_date,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all payments for an organisation with optional filters
   */
  async getPaymentsByOrganisation(
    organisationId: string,
    filters?: PaymentFilters
  ): Promise<Payment[]> {
    try {
      let query = `
        SELECT p.*, 
               ou.first_name || ' ' || ou.last_name as user_name,
               ou.email as user_email
        FROM payments p
        LEFT JOIN organization_users ou ON p.user_id = ou.id
        WHERE p.organisation_id = $1
      `;
      const params: any[] = [organisationId];
      let paramCount = 2;

      // Apply filters
      if (filters) {
        if (filters.paymentStatus && filters.paymentStatus.length > 0) {
          query += ` AND p.payment_status = ANY($${paramCount})`;
          params.push(filters.paymentStatus);
          paramCount++;
        }

        if (filters.paymentMethod && filters.paymentMethod.length > 0) {
          query += ` AND p.payment_method = ANY($${paramCount})`;
          params.push(filters.paymentMethod);
          paramCount++;
        }

        if (filters.paymentType && filters.paymentType.length > 0) {
          query += ` AND p.payment_type = ANY($${paramCount})`;
          params.push(filters.paymentType);
          paramCount++;
        }

        if (filters.startDate) {
          query += ` AND p.payment_date >= $${paramCount}`;
          params.push(filters.startDate);
          paramCount++;
        }

        if (filters.endDate) {
          query += ` AND p.payment_date <= $${paramCount}`;
          params.push(filters.endDate);
          paramCount++;
        }

        if (filters.searchTerm) {
          query += ` AND (
            ou.first_name ILIKE $${paramCount} OR 
            ou.last_name ILIKE $${paramCount} OR 
            ou.email ILIKE $${paramCount} OR
            p.provider_transaction_id ILIKE $${paramCount}
          )`;
          params.push(`%${filters.searchTerm}%`);
          paramCount++;
        }
      }

      query += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

      const result = await db.query(query, params);

      return result.rows.map(row => this.rowToPayment(row));
    } catch (error) {
      logger.error('Error getting payments by organisation:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment | null> {
    try {
      const result = await db.query(
        `SELECT p.*, 
                ou.first_name || ' ' || ou.last_name as user_name,
                ou.email as user_email
         FROM payments p
         LEFT JOIN organization_users ou ON p.user_id = ou.id
         WHERE p.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToPayment(result.rows[0]);
    } catch (error) {
      logger.error('Error getting payment by ID:', error);
      throw error;
    }
  }

  /**
   * Request a refund for a payment
   */
  async requestRefund(data: RequestRefundDto): Promise<Refund> {
    try {
      // Validate payment exists and belongs to organisation
      const payment = await this.getPaymentById(data.paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.organisationId !== data.organisationId) {
        throw new Error('Payment does not belong to this organisation');
      }

      // Validate payment status
      if (payment.paymentStatus !== 'paid') {
        throw new Error('Can only refund paid payments');
      }

      // Validate refund amount
      if (data.refundAmount <= 0) {
        throw new Error('Refund amount must be greater than 0');
      }

      if (data.refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      // Check for existing refunds
      const existingRefunds = await db.query(
        `SELECT SUM(refund_amount) as total_refunded
         FROM refunds
         WHERE payment_id = $1 AND refund_status IN ('pending', 'completed')`,
        [data.paymentId]
      );

      const totalRefunded = parseFloat(existingRefunds.rows[0]?.total_refunded || '0');
      const remainingAmount = payment.amount - totalRefunded;

      if (data.refundAmount > remainingAmount) {
        throw new Error(
          `Refund amount exceeds remaining refundable amount (${remainingAmount} ${payment.currency})`
        );
      }

      // Create refund record
      const result = await db.query(
        `INSERT INTO refunds 
         (payment_id, organisation_id, refund_amount, refund_reason, 
          refund_status, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.paymentId,
          data.organisationId,
          data.refundAmount,
          data.refundReason || null,
          'pending',
          data.requestedBy,
        ]
      );

      logger.info(`Refund requested: ${result.rows[0].id} for payment ${data.paymentId}`);
      return this.rowToRefund(result.rows[0]);
    } catch (error) {
      logger.error('Error requesting refund:', error);
      throw error;
    }
  }

  /**
   * Export payments to Excel
   */
  async exportPayments(
    organisationId: string,
    filters?: PaymentFilters
  ): Promise<Buffer> {
    try {
      // Get payments with filters
      const payments = await this.getPaymentsByOrganisation(organisationId, filters);

      // Create workbook
      const workbook = new ExcelJS();
      const worksheet = workbook.addWorksheet('Payments');

      // Define columns
      worksheet.columns = [
        { header: 'Payment ID', key: 'id', width: 36 },
        { header: 'Date', key: 'paymentDate', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Status', key: 'paymentStatus', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 20 },
        { header: 'Payment Type', key: 'paymentType', width: 20 },
        { header: 'Provider', key: 'paymentProvider', width: 15 },
        { header: 'Transaction ID', key: 'providerTransactionId', width: 30 },
        { header: 'User ID', key: 'userId', width: 36 },
        { header: 'Context ID', key: 'contextId', width: 36 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      payments.forEach(payment => {
        worksheet.addRow({
          id: payment.id,
          paymentDate: payment.paymentDate 
            ? new Date(payment.paymentDate).toLocaleString() 
            : 'N/A',
          amount: payment.amount,
          currency: payment.currency,
          paymentStatus: payment.paymentStatus,
          paymentMethod: payment.paymentMethod,
          paymentType: payment.paymentType,
          paymentProvider: payment.paymentProvider || 'N/A',
          providerTransactionId: payment.providerTransactionId || 'N/A',
          userId: payment.userId,
          contextId: payment.contextId,
        });
      });

      // Format amount column as currency
      worksheet.getColumn('amount').numFmt = '#,##0.00';

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.error('Error exporting payments:', error);
      throw error;
    }
  }

  /**
   * Get lodgements (payment summaries) by organisation
   */
  async getLodgementsByOrganisation(
    organisationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Lodgement[]> {
    try {
      let query = `
        SELECT 
          DATE(payment_date) as date,
          payment_method,
          currency,
          SUM(amount) as total_amount,
          COUNT(*) as transaction_count
        FROM payments
        WHERE organisation_id = $1
          AND payment_status = 'paid'
      `;
      const params: any[] = [organisationId];
      let paramCount = 2;

      if (startDate) {
        query += ` AND payment_date >= $${paramCount}`;
        params.push(startDate);
        paramCount++;
      }

      if (endDate) {
        query += ` AND payment_date <= $${paramCount}`;
        params.push(endDate);
        paramCount++;
      }

      query += `
        GROUP BY DATE(payment_date), payment_method, currency
        ORDER BY date DESC, payment_method
      `;

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        date: row.date,
        paymentMethod: row.payment_method,
        totalAmount: parseFloat(row.total_amount),
        transactionCount: parseInt(row.transaction_count, 10),
        currency: row.currency,
      }));
    } catch (error) {
      logger.error('Error getting lodgements by organisation:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const paymentService = new PaymentService();
