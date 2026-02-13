import { Router, Request, Response } from 'express';
import multer from 'multer';
import { fileUploadService } from '../services/file-upload.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * @swagger
 * /api/orgadmin/files/upload:
 *   post:
 *     summary: Upload a file to S3
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - organizationId
 *               - formId
 *               - fieldId
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               organizationId:
 *                 type: string
 *               formId:
 *                 type: string
 *               fieldId:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid request or file validation failed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/upload',
  authenticateToken(),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId, formId, fieldId } = req.body;
      const file = req.file;

      // Validate required fields
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      if (!organizationId || !formId || !fieldId) {
        res.status(400).json({
          error: 'Missing required fields: organizationId, formId, fieldId',
        });
        return;
      }

      // Upload file
      const result = await fileUploadService.uploadFile({
        organizationId,
        formId,
        fieldId,
        file: {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
      });

      // Store file metadata in database
      await db.query(
        `INSERT INTO form_submission_files 
         (id, organization_id, form_id, field_id, s3_key, file_name, file_size, mime_type, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          result.fileId,
          organizationId,
          formId,
          fieldId,
          result.s3Key,
          result.fileName,
          result.fileSize,
          result.mimeType,
          result.uploadedAt,
        ]
      );

      logger.info('File upload successful', {
        fileId: result.fileId,
        organizationId,
        formId,
        fieldId,
      });

      res.json({
        success: true,
        file: result,
      });
    } catch (error: any) {
      logger.error('Error in POST /files/upload:', error);
      res.status(500).json({
        error: 'Failed to upload file',
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/files/{fileId}:
 *   get:
 *     summary: Get signed URL for file download
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: Signed URL generated successfully
 *       404:
 *         description: File not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:fileId', authenticateToken(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    // Get file metadata from database
    const result = await db.query(
      `SELECT * FROM form_submission_files WHERE id = $1`,
      [fileId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fileRecord = result.rows[0];

    // Generate signed URL
    const signedUrl = await fileUploadService.getFileUrl(fileRecord.s3_key);

    logger.info('Generated signed URL for file', { fileId });

    res.json({
      success: true,
      fileId,
      fileName: fileRecord.file_name,
      fileSize: fileRecord.file_size,
      mimeType: fileRecord.mime_type,
      url: signedUrl,
      expiresIn: 3600, // 1 hour
    });
  } catch (error: any) {
    logger.error('Error in GET /files/:fileId:', error);
    res.status(500).json({
      error: 'Failed to get file URL',
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/orgadmin/files/{fileId}:
 *   delete:
 *     summary: Delete a file from S3
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: File not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/:fileId', authenticateToken(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    // Get file metadata from database
    const result = await db.query(
      `SELECT * FROM form_submission_files WHERE id = $1`,
      [fileId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fileRecord = result.rows[0];

    // Delete from S3
    await fileUploadService.deleteFile(fileRecord.s3_key);

    // Delete from database
    await db.query(`DELETE FROM form_submission_files WHERE id = $1`, [fileId]);

    logger.info('File deleted successfully', { fileId });

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error in DELETE /files/:fileId:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: error.message,
    });
  }
});

export default router;
