import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_NAME } from '../config/aws.config';
import { logger } from '../config/logger';
import crypto from 'crypto';
import path from 'path';

/**
 * File Upload Service
 * 
 * Handles file uploads to AWS S3 with organization-level segregation.
 * Files are stored with the key structure: /org-id/form-id/field-id/filename
 */

export interface UploadFileParams {
  organizationId: string;
  formId: string;
  fieldId: string;
  fieldType?: 'file' | 'image'; // Optional field type for validation
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
}

export interface UploadFileResult {
  fileId: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

export class FileUploadService {
  // Maximum file size: 10MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  // Allowed MIME types for IMAGE fields only
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
  ];

  // Allowed MIME types for FILE fields (general document uploads)
  private readonly ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/rtf',
    'application/rtf',
    'application/zip',
    'application/x-zip-compressed',
  ];

  /**
   * Generate S3 key with organization segregation
   * Format: uploads/org-id/form-id/field-id/filename
   */
  private generateS3Key(
    organizationId: string,
    formId: string,
    fieldId: string,
    fileName: string
  ): string {
    // Sanitize filename to prevent path traversal
    const sanitizedFileName = path.basename(fileName);
    
    // Add timestamp and random string to prevent collisions
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const fileExtension = path.extname(sanitizedFileName);
    const fileNameWithoutExt = path.basename(sanitizedFileName, fileExtension);
    const uniqueFileName = `${fileNameWithoutExt}_${timestamp}_${randomString}${fileExtension}`;

    return `uploads/${organizationId}/${formId}/${fieldId}/${uniqueFileName}`;
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: {
      size: number;
      mimetype: string;
      originalname: string;
    },
    fieldType?: 'file' | 'image'
  ): FileValidationResult {
    const errors: string[] = [];

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Check MIME type based on field type
    if (fieldType === 'image') {
      // For image fields, only allow image types
      if (!this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        errors.push(
          `File type ${file.mimetype} is not allowed for image fields. Allowed types: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`
        );
      }
    } else {
      // For file fields, allow all document types
      if (!this.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        errors.push(
          `File type ${file.mimetype} is not allowed. Allowed types: ${this.ALLOWED_FILE_TYPES.join(', ')}`
        );
      }
    }

    // Check filename
    if (!file.originalname || file.originalname.trim() === '') {
      errors.push('File name is required');
    }

    // Basic virus scan check (check for suspicious patterns in filename)
    const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js'];
    const lowerFileName = file.originalname.toLowerCase();
    if (suspiciousPatterns.some(pattern => lowerFileName.endsWith(pattern))) {
      errors.push('Executable files are not allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Upload file to S3
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    try {
      const { organizationId, formId, fieldId, fieldType, file } = params;

      // Validate file
      const validation = this.validateFile(file, fieldType);
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate S3 key
      const s3Key = this.generateS3Key(
        organizationId,
        formId,
        fieldId,
        file.originalname
      );

      // Generate unique file ID
      const fileId = crypto.randomUUID();

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          fileId,
          organizationId,
          formId,
          fieldId,
          originalName: file.originalname,
        },
      });

      await s3Client.send(command);

      logger.info('File uploaded to S3', {
        fileId,
        s3Key,
        organizationId,
        formId,
        fieldId,
        fileName: file.originalname,
        fileSize: file.size,
      });

      return {
        fileId,
        s3Key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error uploading file to S3:', error);
      throw error;
    }
  }

  /**
   * Upload an organisation's branding logo.
   *
   * Separate from `uploadFile` because a logo is not a form submission. That
   * method's S3 key is built from `formId`/`fieldId`, and its caller writes a
   * `form_submission_files` row — neither of which means anything here, and the
   * required-field check is exactly what made the branding tab's upload fail
   * with "Missing required fields: organizationId, formId, fieldId".
   *
   * The key is stable per organisation but uniquified per upload, so replacing
   * a logo cannot be served stale from a CDN or browser cache.
   */
  async uploadBrandingLogo(params: {
    organizationId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  }): Promise<{ s3Key: string; fileName: string; fileSize: number; mimeType: string }> {
    const { organizationId, file } = params;

    // 'image' — a logo that is not an image is a mistake worth refusing early.
    const validation = this.validateFile(file, 'image');
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedFileName = path.basename(file.originalname);
    const extension = path.extname(sanitizedFileName);
    const unique = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const s3Key = `organisations/${organizationId}/branding/logo_${unique}${extension}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          organizationId,
          purpose: 'branding-logo',
          originalName: sanitizedFileName,
        },
      })
    );

    logger.info('Branding logo uploaded', { organizationId, s3Key, fileSize: file.size });

    return {
      s3Key,
      fileName: sanitizedFileName,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Upload the shared logo for an organisation type.
   *
   * Its own key prefix — `organisation-types/…` rather than `organisations/…` —
   * because the object belongs to the type, outlives any one club, and must not
   * be reachable by the branding endpoint's key check, which confines an
   * organisation to its own prefix.
   *
   * Uniquified per upload, so a federation that rebrands does not have the old
   * mark served from a cache to half its branches.
   */
  async uploadOrganizationTypeLogo(params: {
    organizationTypeId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  }): Promise<{ s3Key: string; fileName: string; fileSize: number; mimeType: string }> {
    const { organizationTypeId, file } = params;

    const validation = this.validateFile(file, 'image');
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedFileName = path.basename(file.originalname);
    const extension = path.extname(sanitizedFileName);
    const unique = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const s3Key = `organisation-types/${organizationTypeId}/logo_${unique}${extension}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          organizationTypeId,
          purpose: 'organisation-type-logo',
          originalName: sanitizedFileName,
        },
      })
    );

    logger.info('Organisation type logo uploaded', { organizationTypeId, s3Key, fileSize: file.size });

    return { s3Key, fileName: sanitizedFileName, fileSize: file.size, mimeType: file.mimetype };
  }

  /**
   * Upload the image shown with a platform post.
   *
   * Its own method for the same reason `uploadBrandingLogo` is: `uploadFile`
   * builds its key from `formId`/`fieldId` and writes a `form_submission_files`
   * row, neither of which exists here. A post belongs to the platform rather
   * than to any organisation, so the key is not under `organisations/`.
   *
   * Uniquified per upload, so replacing a post's image cannot be served stale
   * from a browser or a CDN that is still holding the previous one.
   */
  async uploadPostImage(params: {
    postId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  }): Promise<{ s3Key: string; fileName: string; fileSize: number; mimeType: string }> {
    const { postId, file } = params;

    const validation = this.validateFile(file, 'image');
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedFileName = path.basename(file.originalname);
    const extension = path.extname(sanitizedFileName);
    const unique = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const s3Key = `platform/posts/${postId}/image_${unique}${extension}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          postId,
          purpose: 'platform-post-image',
          originalName: sanitizedFileName,
        },
      })
    );

    logger.info('Platform post image uploaded', { postId, s3Key, fileSize: file.size });

    return { s3Key, fileName: sanitizedFileName, fileSize: file.size, mimeType: file.mimetype };
  }

  /**
   * Get signed URL for file download
   * URL expires after 1 hour
   */
  async getFileUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

      logger.info('Generated signed URL for file', { s3Key, expiresIn });

      return signedUrl;
    } catch (error) {
      logger.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
      });

      await s3Client.send(command);

      logger.info('File deleted from S3', { s3Key });
    } catch (error) {
      logger.error('Error deleting file from S3:', error);
      throw error;
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
      });

      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      logger.error('Error checking file existence:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(s3Key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
      });

      const response = await s3Client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata || {},
      };
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return null;
      }
      logger.error('Error getting file metadata:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();
