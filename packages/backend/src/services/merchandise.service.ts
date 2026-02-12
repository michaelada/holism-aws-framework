import { db } from '../database/pool';
import { logger } from '../config/logger';
import ExcelJS from 'exceljs';

/**
 * Merchandise Type interface matching database schema
 */
export interface MerchandiseType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  images: string[];
  status: 'active' | 'inactive';
  trackStockLevels: boolean;
  lowStockAlert?: number;
  outOfStockBehavior?: 'hide' | 'show_unavailable';
  deliveryType: 'free' | 'fixed' | 'quantity_based';
  deliveryFee?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityIncrements?: number;
  requireApplicationForm: boolean;
  applicationFormId?: string;
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  adminNotificationEmails?: string;
  customConfirmationMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Merchandise Order interface
 */
export interface MerchandiseOrder {
  id: string;
  organisationId: string;
  merchandiseTypeId: string;
  userId: string;
  selectedOptions: Record<string, string>;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  formSubmissionId?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  adminNotes?: string;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating merchandise type
 */
export interface CreateMerchandiseTypeDto {
  organisationId: string;
  name: string;
  description: string;
  images: string[];
  status?: 'active' | 'inactive';
  trackStockLevels?: boolean;
  lowStockAlert?: number;
  outOfStockBehavior?: 'hide' | 'show_unavailable';
  deliveryType: 'free' | 'fixed' | 'quantity_based';
  deliveryFee?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityIncrements?: number;
  requireApplicationForm?: boolean;
  applicationFormId?: string;
  supportedPaymentMethods: string[];
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  adminNotificationEmails?: string;
  customConfirmationMessage?: string;
}

/**
 * DTO for updating merchandise type
 */
export interface UpdateMerchandiseTypeDto {
  name?: string;
  description?: string;
  images?: string[];
  status?: 'active' | 'inactive';
  trackStockLevels?: boolean;
  lowStockAlert?: number;
  outOfStockBehavior?: 'hide' | 'show_unavailable';
  deliveryType?: 'free' | 'fixed' | 'quantity_based';
  deliveryFee?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityIncrements?: number;
  requireApplicationForm?: boolean;
  applicationFormId?: string;
  supportedPaymentMethods?: string[];
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  adminNotificationEmails?: string;
  customConfirmationMessage?: string;
}

/**
 * DTO for creating order
 */
export interface CreateOrderDto {
  organisationId: string;
  merchandiseTypeId: string;
  userId: string;
  selectedOptions: Record<string, string>;
  quantity: number;
  formSubmissionId?: string;
  paymentMethod?: string;
}

/**
 * Order filter options
 */
export interface OrderFilterOptions {
  merchandiseTypeId?: string;
  paymentStatus?: string[];
  orderStatus?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  customerName?: string;
}

/**
 * Service for managing merchandise
 */
export class MerchandiseService {
  /**
   * Convert database row to MerchandiseType object
   */
  private rowToMerchandiseType(row: any): MerchandiseType {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      images: row.images || [],
      status: row.status,
      trackStockLevels: row.track_stock_levels,
      lowStockAlert: row.low_stock_alert,
      outOfStockBehavior: row.out_of_stock_behavior,
      deliveryType: row.delivery_type,
      deliveryFee: row.delivery_fee ? parseFloat(row.delivery_fee) : undefined,
      minOrderQuantity: row.min_order_quantity,
      maxOrderQuantity: row.max_order_quantity,
      quantityIncrements: row.quantity_increments,
      requireApplicationForm: row.require_application_form,
      applicationFormId: row.application_form_id,
      supportedPaymentMethods: row.supported_payment_methods || [],
      useTermsAndConditions: row.use_terms_and_conditions,
      termsAndConditions: row.terms_and_conditions,
      adminNotificationEmails: row.admin_notification_emails,
      customConfirmationMessage: row.custom_confirmation_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to MerchandiseOrder object
   */
  private rowToOrder(row: any): MerchandiseOrder {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      merchandiseTypeId: row.merchandise_type_id,
      userId: row.user_id,
      selectedOptions: row.selected_options || {},
      quantity: row.quantity,
      unitPrice: parseFloat(row.unit_price),
      subtotal: parseFloat(row.subtotal),
      deliveryFee: parseFloat(row.delivery_fee),
      totalPrice: parseFloat(row.total_price),
      formSubmissionId: row.form_submission_id,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      orderStatus: row.order_status,
      adminNotes: row.admin_notes,
      orderDate: row.order_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all merchandise types for an organisation
   */
  async getMerchandiseTypesByOrganisation(organisationId: string): Promise<MerchandiseType[]> {
    try {
      const result = await db.query(
        `SELECT * FROM merchandise_types 
         WHERE organisation_id = $1 
         ORDER BY created_at DESC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToMerchandiseType(row));
    } catch (error) {
      logger.error('Error getting merchandise types by organisation:', error);
      throw error;
    }
  }

  /**
   * Get merchandise type by ID
   */
  async getMerchandiseTypeById(id: string): Promise<MerchandiseType | null> {
    try {
      const result = await db.query(
        'SELECT * FROM merchandise_types WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToMerchandiseType(result.rows[0]);
    } catch (error) {
      logger.error('Error getting merchandise type by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new merchandise type
   */
  async createMerchandiseType(data: CreateMerchandiseTypeDto): Promise<MerchandiseType> {
    try {
      // Validate images
      if (!data.images || data.images.length === 0) {
        throw new Error('At least one image is required');
      }

      // Validate delivery configuration
      if (data.deliveryType === 'fixed' && !data.deliveryFee) {
        throw new Error('Delivery fee is required for fixed delivery type');
      }

      // Validate quantity rules
      if (data.minOrderQuantity && data.maxOrderQuantity && data.minOrderQuantity > data.maxOrderQuantity) {
        throw new Error('Minimum order quantity cannot be greater than maximum');
      }

      // Validate application form
      if (data.requireApplicationForm && !data.applicationFormId) {
        throw new Error('Application form ID is required when form is required');
      }

      // Validate terms and conditions
      if (data.useTermsAndConditions && !data.termsAndConditions) {
        throw new Error('Terms and conditions text is required when enabled');
      }

      const result = await db.query(
        `INSERT INTO merchandise_types 
         (organisation_id, name, description, images, status, track_stock_levels,
          low_stock_alert, out_of_stock_behavior, delivery_type, delivery_fee,
          min_order_quantity, max_order_quantity, quantity_increments,
          require_application_form, application_form_id, supported_payment_methods,
          use_terms_and_conditions, terms_and_conditions, admin_notification_emails,
          custom_confirmation_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.description,
          JSON.stringify(data.images),
          data.status || 'active',
          data.trackStockLevels || false,
          data.lowStockAlert || null,
          data.outOfStockBehavior || null,
          data.deliveryType,
          data.deliveryFee || null,
          data.minOrderQuantity || 1,
          data.maxOrderQuantity || null,
          data.quantityIncrements || null,
          data.requireApplicationForm || false,
          data.applicationFormId || null,
          JSON.stringify(data.supportedPaymentMethods),
          data.useTermsAndConditions || false,
          data.termsAndConditions || null,
          data.adminNotificationEmails || null,
          data.customConfirmationMessage || null,
        ]
      );

      logger.info(`Merchandise type created: ${data.name} (${result.rows[0].id})`);
      return this.rowToMerchandiseType(result.rows[0]);
    } catch (error) {
      logger.error('Error creating merchandise type:', error);
      throw error;
    }
  }

  /**
   * Update a merchandise type
   */
  async updateMerchandiseType(id: string, data: UpdateMerchandiseTypeDto): Promise<MerchandiseType> {
    try {
      // Get existing merchandise type
      const existing = await this.getMerchandiseTypeById(id);
      if (!existing) {
        throw new Error('Merchandise type not found');
      }

      // Validate images if provided
      if (data.images && data.images.length === 0) {
        throw new Error('At least one image is required');
      }

      // Validate delivery configuration
      const deliveryType = data.deliveryType || existing.deliveryType;
      const deliveryFee = data.deliveryFee !== undefined ? data.deliveryFee : existing.deliveryFee;
      if (deliveryType === 'fixed' && !deliveryFee) {
        throw new Error('Delivery fee is required for fixed delivery type');
      }

      // Validate quantity rules
      const minOrderQuantity = data.minOrderQuantity !== undefined ? data.minOrderQuantity : existing.minOrderQuantity;
      const maxOrderQuantity = data.maxOrderQuantity !== undefined ? data.maxOrderQuantity : existing.maxOrderQuantity;
      if (minOrderQuantity && maxOrderQuantity && minOrderQuantity > maxOrderQuantity) {
        throw new Error('Minimum order quantity cannot be greater than maximum');
      }

      // Validate application form
      const requireApplicationForm = data.requireApplicationForm !== undefined 
        ? data.requireApplicationForm 
        : existing.requireApplicationForm;
      const applicationFormId = data.applicationFormId !== undefined 
        ? data.applicationFormId 
        : existing.applicationFormId;
      if (requireApplicationForm && !applicationFormId) {
        throw new Error('Application form ID is required when form is required');
      }

      // Validate terms and conditions
      const useTermsAndConditions = data.useTermsAndConditions !== undefined 
        ? data.useTermsAndConditions 
        : existing.useTermsAndConditions;
      const termsAndConditions = data.termsAndConditions !== undefined 
        ? data.termsAndConditions 
        : existing.termsAndConditions;
      if (useTermsAndConditions && !termsAndConditions) {
        throw new Error('Terms and conditions text is required when enabled');
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.images !== undefined) {
        updates.push(`images = $${paramCount++}`);
        values.push(JSON.stringify(data.images));
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.trackStockLevels !== undefined) {
        updates.push(`track_stock_levels = $${paramCount++}`);
        values.push(data.trackStockLevels);
      }
      if (data.lowStockAlert !== undefined) {
        updates.push(`low_stock_alert = $${paramCount++}`);
        values.push(data.lowStockAlert || null);
      }
      if (data.outOfStockBehavior !== undefined) {
        updates.push(`out_of_stock_behavior = $${paramCount++}`);
        values.push(data.outOfStockBehavior || null);
      }
      if (data.deliveryType !== undefined) {
        updates.push(`delivery_type = $${paramCount++}`);
        values.push(data.deliveryType);
      }
      if (data.deliveryFee !== undefined) {
        updates.push(`delivery_fee = $${paramCount++}`);
        values.push(data.deliveryFee || null);
      }
      if (data.minOrderQuantity !== undefined) {
        updates.push(`min_order_quantity = $${paramCount++}`);
        values.push(data.minOrderQuantity);
      }
      if (data.maxOrderQuantity !== undefined) {
        updates.push(`max_order_quantity = $${paramCount++}`);
        values.push(data.maxOrderQuantity || null);
      }
      if (data.quantityIncrements !== undefined) {
        updates.push(`quantity_increments = $${paramCount++}`);
        values.push(data.quantityIncrements || null);
      }
      if (data.requireApplicationForm !== undefined) {
        updates.push(`require_application_form = $${paramCount++}`);
        values.push(data.requireApplicationForm);
      }
      if (data.applicationFormId !== undefined) {
        updates.push(`application_form_id = $${paramCount++}`);
        values.push(data.applicationFormId || null);
      }
      if (data.supportedPaymentMethods !== undefined) {
        updates.push(`supported_payment_methods = $${paramCount++}`);
        values.push(JSON.stringify(data.supportedPaymentMethods));
      }
      if (data.useTermsAndConditions !== undefined) {
        updates.push(`use_terms_and_conditions = $${paramCount++}`);
        values.push(data.useTermsAndConditions);
      }
      if (data.termsAndConditions !== undefined) {
        updates.push(`terms_and_conditions = $${paramCount++}`);
        values.push(data.termsAndConditions || null);
      }
      if (data.adminNotificationEmails !== undefined) {
        updates.push(`admin_notification_emails = $${paramCount++}`);
        values.push(data.adminNotificationEmails || null);
      }
      if (data.customConfirmationMessage !== undefined) {
        updates.push(`custom_confirmation_message = $${paramCount++}`);
        values.push(data.customConfirmationMessage || null);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE merchandise_types 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Merchandise type not found');
      }

      logger.info(`Merchandise type updated: ${id}`);
      return this.rowToMerchandiseType(result.rows[0]);
    } catch (error) {
      logger.error('Error updating merchandise type:', error);
      throw error;
    }
  }

  /**
   * Delete a merchandise type
   */
  async deleteMerchandiseType(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM merchandise_types WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Merchandise type not found');
      }

      logger.info(`Merchandise type deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting merchandise type:', error);
      throw error;
    }
  }

  /**
   * Get orders by organisation with filtering
   */
  async getOrdersByOrganisation(
    organisationId: string,
    filters?: OrderFilterOptions
  ): Promise<MerchandiseOrder[]> {
    try {
      let query = `
        SELECT mo.* 
        FROM merchandise_orders mo
        WHERE mo.organisation_id = $1
      `;
      const values: any[] = [organisationId];
      let paramCount = 2;

      if (filters?.merchandiseTypeId) {
        query += ` AND mo.merchandise_type_id = $${paramCount++}`;
        values.push(filters.merchandiseTypeId);
      }

      if (filters?.paymentStatus && filters.paymentStatus.length > 0) {
        query += ` AND mo.payment_status = ANY($${paramCount++})`;
        values.push(filters.paymentStatus);
      }

      if (filters?.orderStatus && filters.orderStatus.length > 0) {
        query += ` AND mo.order_status = ANY($${paramCount++})`;
        values.push(filters.orderStatus);
      }

      if (filters?.dateFrom) {
        query += ` AND mo.order_date >= $${paramCount++}`;
        values.push(filters.dateFrom);
      }

      if (filters?.dateTo) {
        query += ` AND mo.order_date <= $${paramCount++}`;
        values.push(filters.dateTo);
      }

      if (filters?.customerName) {
        query += ` AND EXISTS (
          SELECT 1 FROM organization_users ou 
          WHERE ou.id = mo.user_id 
          AND (ou.first_name ILIKE $${paramCount} OR ou.last_name ILIKE $${paramCount})
        )`;
        values.push(`%${filters.customerName}%`);
        paramCount++;
      }

      query += ' ORDER BY mo.order_date DESC';

      const result = await db.query(query, values);
      return result.rows.map(row => this.rowToOrder(row));
    } catch (error) {
      logger.error('Error getting orders by organisation:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string): Promise<MerchandiseOrder | null> {
    try {
      const result = await db.query(
        'SELECT * FROM merchandise_orders WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrder(result.rows[0]);
    } catch (error) {
      logger.error('Error getting order by ID:', error);
      throw error;
    }
  }

  /**
   * Calculate unit price based on selected options
   */
  async calculatePrice(
    merchandiseTypeId: string,
    selectedOptions: Record<string, string>,
    quantity: number
  ): Promise<{ unitPrice: number; subtotal: number; deliveryFee: number; totalPrice: number }> {
    try {
      // Get merchandise type
      const merchandiseType = await this.getMerchandiseTypeById(merchandiseTypeId);
      if (!merchandiseType) {
        throw new Error('Merchandise type not found');
      }

      // Calculate unit price from selected options
      let unitPrice = 0;
      
      // Get all option values for the selected options
      const optionValueIds = Object.values(selectedOptions);
      if (optionValueIds.length > 0) {
        const result = await db.query(
          `SELECT price FROM merchandise_option_values WHERE id = ANY($1)`,
          [optionValueIds]
        );
        
        unitPrice = result.rows.reduce((sum, row) => sum + parseFloat(row.price), 0);
      }

      // Calculate subtotal
      const subtotal = unitPrice * quantity;

      // Calculate delivery fee
      let deliveryFee = 0;
      if (merchandiseType.deliveryType === 'fixed') {
        deliveryFee = merchandiseType.deliveryFee || 0;
      } else if (merchandiseType.deliveryType === 'quantity_based') {
        // Get delivery rules
        const rulesResult = await db.query(
          `SELECT * FROM delivery_rules 
           WHERE merchandise_type_id = $1 
           ORDER BY "order"`,
          [merchandiseTypeId]
        );

        // Find applicable rule
        for (const rule of rulesResult.rows) {
          if (quantity >= rule.min_quantity && 
              (!rule.max_quantity || quantity <= rule.max_quantity)) {
            deliveryFee = parseFloat(rule.delivery_fee);
            break;
          }
        }
      }
      // If deliveryType is 'free', deliveryFee remains 0

      // Calculate total
      const totalPrice = subtotal + deliveryFee;

      return { unitPrice, subtotal, deliveryFee, totalPrice };
    } catch (error) {
      logger.error('Error calculating price:', error);
      throw error;
    }
  }

  /**
   * Validate quantity against rules
   */
  async validateQuantity(merchandiseTypeId: string, quantity: number): Promise<void> {
    try {
      const merchandiseType = await this.getMerchandiseTypeById(merchandiseTypeId);
      if (!merchandiseType) {
        throw new Error('Merchandise type not found');
      }

      // Check minimum
      if (merchandiseType.minOrderQuantity && quantity < merchandiseType.minOrderQuantity) {
        throw new Error(`Minimum order quantity is ${merchandiseType.minOrderQuantity}`);
      }

      // Check maximum
      if (merchandiseType.maxOrderQuantity && quantity > merchandiseType.maxOrderQuantity) {
        throw new Error(`Maximum order quantity is ${merchandiseType.maxOrderQuantity}`);
      }

      // Check increments
      if (merchandiseType.quantityIncrements && quantity % merchandiseType.quantityIncrements !== 0) {
        throw new Error(`Quantity must be in multiples of ${merchandiseType.quantityIncrements}`);
      }
    } catch (error) {
      logger.error('Error validating quantity:', error);
      throw error;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderDto): Promise<MerchandiseOrder> {
    try {
      // Validate quantity
      await this.validateQuantity(data.merchandiseTypeId, data.quantity);

      // Calculate prices
      const prices = await this.calculatePrice(
        data.merchandiseTypeId,
        data.selectedOptions,
        data.quantity
      );

      // Check stock levels if tracking is enabled
      const merchandiseType = await this.getMerchandiseTypeById(data.merchandiseTypeId);
      if (merchandiseType?.trackStockLevels) {
        const optionValueIds = Object.values(data.selectedOptions);
        const stockResult = await db.query(
          `SELECT id, stock_quantity FROM merchandise_option_values WHERE id = ANY($1)`,
          [optionValueIds]
        );

        for (const row of stockResult.rows) {
          if (row.stock_quantity !== null && row.stock_quantity < data.quantity) {
            throw new Error('Insufficient stock for selected options');
          }
        }
      }

      // Create order
      const result = await db.query(
        `INSERT INTO merchandise_orders 
         (organisation_id, merchandise_type_id, user_id, selected_options, quantity,
          unit_price, subtotal, delivery_fee, total_price, form_submission_id, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          data.organisationId,
          data.merchandiseTypeId,
          data.userId,
          JSON.stringify(data.selectedOptions),
          data.quantity,
          prices.unitPrice,
          prices.subtotal,
          prices.deliveryFee,
          prices.totalPrice,
          data.formSubmissionId || null,
          data.paymentMethod || null,
        ]
      );

      // Update stock levels if tracking is enabled
      if (merchandiseType?.trackStockLevels) {
        await this.updateStockLevels(data.selectedOptions, -data.quantity);
      }

      logger.info(`Order created: ${result.rows[0].id}`);
      return this.rowToOrder(result.rows[0]);
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    status: string,
    userId: string,
    notes?: string
  ): Promise<MerchandiseOrder> {
    try {
      // Get existing order
      const existing = await this.getOrderById(id);
      if (!existing) {
        throw new Error('Order not found');
      }

      // Update order
      const result = await db.query(
        `UPDATE merchandise_orders 
         SET order_status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      // Record history
      await db.query(
        `INSERT INTO merchandise_order_history 
         (order_id, user_id, previous_status, new_status, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, userId, existing.orderStatus, status, notes || null]
      );

      logger.info(`Order status updated: ${id} -> ${status}`);
      return this.rowToOrder(result.rows[0]);
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Update stock levels
   */
  async updateStockLevels(
    selectedOptions: Record<string, string>,
    quantityChange: number
  ): Promise<void> {
    try {
      const optionValueIds = Object.values(selectedOptions);
      
      for (const optionValueId of optionValueIds) {
        await db.query(
          `UPDATE merchandise_option_values 
           SET stock_quantity = COALESCE(stock_quantity, 0) + $1
           WHERE id = $2 AND stock_quantity IS NOT NULL`,
          [quantityChange, optionValueId]
        );
      }

      logger.info(`Stock levels updated for options: ${optionValueIds.join(', ')}`);
    } catch (error) {
      logger.error('Error updating stock levels:', error);
      throw error;
    }
  }

  /**
   * Export orders to Excel
   */
  async exportOrdersToExcel(
    organisationId: string,
    filters?: OrderFilterOptions
  ): Promise<Buffer> {
    try {
      // Get orders
      const orders = await this.getOrdersByOrganisation(organisationId, filters);

      // Get merchandise types and user details
      const merchandiseTypeIds = [...new Set(orders.map(o => o.merchandiseTypeId))];
      const userIds = [...new Set(orders.map(o => o.userId))];

      const merchandiseTypes = new Map<string, any>();
      const users = new Map<string, any>();

      if (merchandiseTypeIds.length > 0) {
        const mtResult = await db.query(
          'SELECT id, name FROM merchandise_types WHERE id = ANY($1)',
          [merchandiseTypeIds]
        );
        mtResult.rows.forEach(row => merchandiseTypes.set(row.id, row));
      }

      if (userIds.length > 0) {
        const userResult = await db.query(
          'SELECT id, first_name, last_name, email FROM organization_users WHERE id = ANY($1)',
          [userIds]
        );
        userResult.rows.forEach(row => users.set(row.id, row));
      }

      // Create workbook
      const workbook = new ExcelJS();
      const worksheet = workbook.addWorksheet('Orders');

      // Add headers
      worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Email', key: 'customerEmail', width: 30 },
        { header: 'Merchandise Type', key: 'merchandiseType', width: 25 },
        { header: 'Selected Options', key: 'selectedOptions', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Unit Price', key: 'unitPrice', width: 12 },
        { header: 'Subtotal', key: 'subtotal', width: 12 },
        { header: 'Delivery Fee', key: 'deliveryFee', width: 12 },
        { header: 'Total Price', key: 'totalPrice', width: 12 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Order Status', key: 'orderStatus', width: 15 },
        { header: 'Order Date', key: 'orderDate', width: 20 },
        { header: 'Admin Notes', key: 'adminNotes', width: 30 },
      ];

      // Add data
      orders.forEach(order => {
        const merchandiseType = merchandiseTypes.get(order.merchandiseTypeId);
        const user = users.get(order.userId);

        worksheet.addRow({
          orderId: order.id,
          customerName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
          customerEmail: user?.email || '',
          merchandiseType: merchandiseType?.name || 'Unknown',
          selectedOptions: Object.entries(order.selectedOptions)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', '),
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          totalPrice: order.totalPrice,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod || '',
          orderStatus: order.orderStatus,
          orderDate: order.orderDate.toISOString(),
          adminNotes: order.adminNotes || '',
        });
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.error('Error exporting orders to Excel:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const merchandiseService = new MerchandiseService();
