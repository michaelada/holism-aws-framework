import { Router, Request, Response } from 'express';
import multer from 'multer';
import { merchandiseService } from '../services/merchandise.service';
import { merchandiseOptionService } from '../services/merchandise-option.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_NAME } from '../config/aws.config';
import crypto from 'crypto';
import path from 'path';

const router = Router();

// Configure multer for memory storage (merchandise images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * Middleware to check if organisation has merchandise capability
 */
async function requireMerchandiseCapability(
  req: Request,
  res: Response,
  next: Function
): Promise<void> {
  try {
    const organisationId = req.params.organisationId || req.body.organisationId;
    
    if (!organisationId) {
      res.status(400).json({ error: 'Organisation ID is required' });
      return;
    }

    // Check if organisation has merchandise capability
    const result = await db.query(
      `SELECT enabled_capabilities FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const enabledCapabilities = result.rows[0].enabled_capabilities || [];
    
    if (!enabledCapabilities.includes('merchandise')) {
      res.status(403).json({ 
        error: 'Organisation does not have merchandise capability enabled' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking merchandise capability:', error);
    res.status(500).json({ error: 'Failed to verify capability' });
  }
}

// ============================================================================
// Merchandise Types Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/merchandise-types:
 *   get:
 *     summary: Get all merchandise types for an organisation
 *     tags: [Merchandise]
 */
router.get(
  '/organisations/:organisationId/merchandise-types',
  authenticateToken(),
  requireMerchandiseCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const merchandiseTypes = await merchandiseService.getMerchandiseTypesByOrganisation(organisationId);
      const resolved = await Promise.all(merchandiseTypes.map(mt => merchandiseService.resolveImageUrls(mt)));
      res.json(resolved);
    } catch (error) {
      logger.error('Error in GET /merchandise-types:', error);
      res.status(500).json({ error: 'Failed to fetch merchandise types' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{id}:
 *   get:
 *     summary: Get merchandise type by ID
 *     tags: [Merchandise]
 */
router.get(
  '/merchandise-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const merchandiseType = await merchandiseService.getMerchandiseTypeById(id);
      
      if (!merchandiseType) {
        return res.status(404).json({ error: 'Merchandise type not found' });
      }
      
      const resolved = await merchandiseService.resolveImageUrls(merchandiseType);
      return res.json(resolved);
    } catch (error) {
      logger.error('Error in GET /merchandise-types/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch merchandise type' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types:
 *   post:
 *     summary: Create a new merchandise type
 *     tags: [Merchandise]
 */
router.post(
  '/merchandise-types',
  authenticateToken(),
  requireMerchandiseCapability,
  async (req: Request, res: Response) => {
    try {
      const merchandiseType = await merchandiseService.createMerchandiseType(req.body);
      res.status(201).json(merchandiseType);
    } catch (error) {
      logger.error('Error in POST /merchandise-types:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create merchandise type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{id}:
 *   put:
 *     summary: Update a merchandise type
 *     tags: [Merchandise]
 */
router.put(
  '/merchandise-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const merchandiseType = await merchandiseService.updateMerchandiseType(id, req.body);
      res.json(merchandiseType);
    } catch (error) {
      logger.error('Error in PUT /merchandise-types/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update merchandise type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{id}:
 *   delete:
 *     summary: Delete a merchandise type
 *     tags: [Merchandise]
 */
router.delete(
  '/merchandise-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await merchandiseService.deleteMerchandiseType(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /merchandise-types/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete merchandise type' });
      }
    }
  }
);

// ============================================================================
// Merchandise Options Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{id}/options:
 *   get:
 *     summary: Get all option combinations for a merchandise type
 *     tags: [Merchandise Options]
 */
router.get(
  '/merchandise-types/:id/options',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const combinations = await merchandiseOptionService.getAllCombinations(id);
      res.json(combinations);
    } catch (error) {
      logger.error('Error in GET /merchandise-types/:id/options:', error);
      res.status(500).json({ error: 'Failed to fetch option combinations' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{id}/options:
 *   post:
 *     summary: Create a new option type
 *     tags: [Merchandise Options]
 */
router.post(
  '/merchandise-types/:id/options',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const optionTypeData = { ...req.body, merchandiseTypeId: id };
      const optionType = await merchandiseOptionService.createOptionType(optionTypeData);
      res.status(201).json(optionType);
    } catch (error) {
      logger.error('Error in POST /merchandise-types/:id/options:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create option type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{typeId}/options/{optionId}:
 *   put:
 *     summary: Update an option type
 *     tags: [Merchandise Options]
 */
router.put(
  '/merchandise-types/:typeId/options/:optionId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { optionId } = req.params;
      const optionType = await merchandiseOptionService.updateOptionType(optionId, req.body);
      res.json(optionType);
    } catch (error) {
      logger.error('Error in PUT /merchandise-types/:typeId/options/:optionId:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update option type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{typeId}/options/{optionId}:
 *   delete:
 *     summary: Delete an option type
 *     tags: [Merchandise Options]
 */
router.delete(
  '/merchandise-types/:typeId/options/:optionId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { optionId } = req.params;
      await merchandiseOptionService.deleteOptionType(optionId);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /merchandise-types/:typeId/options/:optionId:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete option type' });
      }
    }
  }
);

// ============================================================================
// Merchandise Orders Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/merchandise-orders:
 *   get:
 *     summary: Get all orders for an organisation
 *     tags: [Merchandise Orders]
 */
router.get(
  '/organisations/:organisationId/merchandise-orders',
  authenticateToken(),
  requireMerchandiseCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { merchandiseTypeId, paymentStatus, orderStatus, dateFrom, dateTo, customerName } = req.query;
      
      const filters = {
        merchandiseTypeId: merchandiseTypeId as string,
        paymentStatus: paymentStatus ? (paymentStatus as string).split(',') : undefined,
        orderStatus: orderStatus ? (orderStatus as string).split(',') : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        customerName: customerName as string,
      };
      
      const orders = await merchandiseService.getOrdersByOrganisation(organisationId, filters);
      res.json(orders);
    } catch (error) {
      logger.error('Error in GET /merchandise-orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Merchandise Orders]
 */
router.get(
  '/merchandise-orders/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const order = await merchandiseService.getOrderById(id);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      return res.json(order);
    } catch (error) {
      logger.error('Error in GET /merchandise-orders/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Merchandise Orders]
 */
router.post(
  '/merchandise-orders',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const order = await merchandiseService.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      logger.error('Error in POST /merchandise-orders:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create order' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-orders/{id}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Merchandise Orders]
 */
router.put(
  '/merchandise-orders/:id/status',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, userId, notes } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const order = await merchandiseService.updateOrderStatus(id, status, userId, notes);
      return res.json(order);
    } catch (error) {
      logger.error('Error in PUT /merchandise-orders/:id/status:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Failed to update order status' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/merchandise-orders/export:
 *   get:
 *     summary: Export orders to Excel
 *     tags: [Merchandise Orders]
 */
router.get(
  '/organisations/:organisationId/merchandise-orders/export',
  authenticateToken(),
  requireMerchandiseCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { merchandiseTypeId, paymentStatus, orderStatus, dateFrom, dateTo, customerName } = req.query;
      
      const filters = {
        merchandiseTypeId: merchandiseTypeId as string,
        paymentStatus: paymentStatus ? (paymentStatus as string).split(',') : undefined,
        orderStatus: orderStatus ? (orderStatus as string).split(',') : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        customerName: customerName as string,
      };
      
      const buffer = await merchandiseService.exportOrdersToExcel(organisationId, filters);
      
      // Set headers for file download
      const filename = `merchandise_orders_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(buffer);
    } catch (error) {
      logger.error('Error in GET /merchandise-orders/export:', error);
      return res.status(500).json({ error: 'Failed to export orders' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/merchandise-types/{id}/stock/adjust:
 *   post:
 *     summary: Manually adjust stock levels
 *     tags: [Merchandise]
 */
router.post(
  '/merchandise-types/:id/stock/adjust',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { selectedOptions, quantityChange } = req.body;
      
      if (!selectedOptions || typeof quantityChange !== 'number') {
        return res.status(400).json({ error: 'Selected options and quantity change are required' });
      }
      
      await merchandiseService.updateStockLevels(selectedOptions, quantityChange);
      return res.json({ message: 'Stock levels updated successfully' });
    } catch (error) {
      logger.error('Error in POST /merchandise-types/:id/stock/adjust:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Failed to adjust stock levels' });
      }
    }
  }
);

// ============================================================================
// Merchandise Image Routes
// ============================================================================

/**
 * Upload a merchandise image to S3
 * S3 key format: merchandise/{organisationId}/{uniqueFilename}
 */
router.post(
  '/merchandise-images/upload',
  authenticateToken(),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organisationId } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }
      if (!organisationId) {
        res.status(400).json({ error: 'organisationId is required' });
        return;
      }

      // Validate image type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        res.status(400).json({ error: `File type ${file.mimetype} is not allowed. Allowed: ${allowedTypes.join(', ')}` });
        return;
      }

      // Generate unique S3 key
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const uniqueName = `${baseName}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
      const s3Key = `merchandise/${organisationId}/${uniqueName}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      logger.info('Merchandise image uploaded to S3', { s3Key, organisationId });

      res.json({ success: true, s3Key });
    } catch (error: any) {
      logger.error('Error uploading merchandise image:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
);

/**
 * Unescape HTML entities added by the global sanitizeBody/sanitizeQuery middleware
 */
function unescapeHtml(str: string): string {
  return str
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

/**
 * Get a signed URL for a merchandise image
 */
router.get(
  '/merchandise-images/url',
  authenticateToken(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.query;
      if (!key || typeof key !== 'string') {
        res.status(400).json({ error: 's3 key is required' });
        return;
      }

      const s3Key = unescapeHtml(key);
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: s3Key }),
        { expiresIn: 3600 }
      );

      res.json({ url: signedUrl });
    } catch (error: any) {
      logger.error('Error generating merchandise image URL:', error);
      res.status(500).json({ error: 'Failed to generate image URL' });
    }
  }
);

/**
 * Delete a merchandise image from S3
 */
router.delete(
  '/merchandise-images',
  authenticateToken(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.query;
      if (!key || typeof key !== 'string') {
        res.status(400).json({ error: 's3 key is required' });
        return;
      }

      const s3Key = unescapeHtml(key);
      await s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
      }));

      logger.info('Merchandise image deleted from S3', { key: s3Key });
      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting merchandise image:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
);

export default router;
