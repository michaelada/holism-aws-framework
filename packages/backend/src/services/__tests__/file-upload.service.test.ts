import { FileUploadService } from '../file-upload.service';
import { s3Client } from '../../config/aws.config';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('../../config/aws.config', () => ({
  s3Client: {
    send: jest.fn(),
  },
  S3_BUCKET_NAME: 'test-bucket',
}));

describe('FileUploadService', () => {
  let service: FileUploadService;
  const mockSend = s3Client.send as jest.Mock;
  const mockGetSignedUrl = getSignedUrl as jest.Mock;

  beforeEach(() => {
    service = new FileUploadService();
    jest.clearAllMocks();
  });

  describe('validateFile', () => {
    it('should validate a valid file', () => {
      const file = {
        size: 1024 * 1024, // 1MB
        mimetype: 'application/pdf',
        originalname: 'test.pdf',
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file exceeding size limit', () => {
      const file = {
        size: 11 * 1024 * 1024, // 11MB
        mimetype: 'application/pdf',
        originalname: 'test.pdf',
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum allowed size of 10MB');
    });

    it('should reject file with invalid MIME type', () => {
      const file = {
        size: 1024,
        mimetype: 'application/x-executable',
        originalname: 'test.exe',
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject executable files', () => {
      const file = {
        size: 1024,
        mimetype: 'application/pdf',
        originalname: 'malicious.exe',
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Executable files are not allowed');
    });

    it('should reject file with empty name', () => {
      const file = {
        size: 1024,
        mimetype: 'application/pdf',
        originalname: '',
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File name is required');
    });

    it('should accept various allowed MIME types', () => {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'text/plain',
      ];

      allowedTypes.forEach(mimetype => {
        const file = {
          size: 1024,
          mimetype,
          originalname: 'test.file',
        };

        const result = service.validateFile(file);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('uploadFile', () => {
    it('should upload file to S3 with correct key structure', async () => {
      const params = {
        organizationId: 'org-123',
        formId: 'form-456',
        fieldId: 'field-789',
        file: {
          buffer: Buffer.from('test content'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        },
      };

      mockSend.mockResolvedValueOnce({} as any);

      const result = await service.uploadFile(params);

      expect(result.fileId).toBeDefined();
      expect(result.s3Key).toContain('org-123/form-456/field-789/');
      expect(result.s3Key).toContain('test');
      expect(result.s3Key).toContain('.pdf');
      expect(result.fileName).toBe('test.pdf');
      expect(result.fileSize).toBe(1024);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.uploadedAt).toBeInstanceOf(Date);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(PutObjectCommand);
    });

    it('should generate unique S3 keys for same filename', async () => {
      const params = {
        organizationId: 'org-123',
        formId: 'form-456',
        fieldId: 'field-789',
        file: {
          buffer: Buffer.from('test content'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        },
      };

      mockSend.mockResolvedValue({} as any);

      const result1 = await service.uploadFile(params);
      const result2 = await service.uploadFile(params);

      expect(result1.s3Key).not.toBe(result2.s3Key);
    });

    it('should reject invalid file', async () => {
      const params = {
        organizationId: 'org-123',
        formId: 'form-456',
        fieldId: 'field-789',
        file: {
          buffer: Buffer.from('test content'),
          originalname: 'malicious.exe',
          mimetype: 'application/pdf',
          size: 1024,
        },
      };

      await expect(service.uploadFile(params)).rejects.toThrow('File validation failed');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should sanitize filename to prevent path traversal', async () => {
      const params = {
        organizationId: 'org-123',
        formId: 'form-456',
        fieldId: 'field-789',
        file: {
          buffer: Buffer.from('test content'),
          originalname: '../../../etc/passwd',
          mimetype: 'text/plain',
          size: 1024,
        },
      };

      mockSend.mockResolvedValueOnce({} as any);

      const result = await service.uploadFile(params);

      expect(result.s3Key).not.toContain('../');
      expect(result.s3Key).toContain('org-123/form-456/field-789/');
    });

    it('should include metadata in S3 upload', async () => {
      const params = {
        organizationId: 'org-123',
        formId: 'form-456',
        fieldId: 'field-789',
        file: {
          buffer: Buffer.from('test content'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        },
      };

      mockSend.mockResolvedValueOnce({} as any);

      await service.uploadFile(params);

      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(PutObjectCommand);
    });
  });

  describe('getFileUrl', () => {
    it('should generate signed URL for file', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';
      const expectedUrl = 'https://s3.amazonaws.com/signed-url';

      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      const url = await service.getFileUrl(s3Key);

      expect(url).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        s3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should allow custom expiration time', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';
      const expectedUrl = 'https://s3.amazonaws.com/signed-url';
      const customExpiry = 7200; // 2 hours

      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      await service.getFileUrl(s3Key, customExpiry);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        s3Client,
        expect.any(GetObjectCommand),
        { expiresIn: customExpiry }
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';

      mockSend.mockResolvedValueOnce({} as any);

      await service.deleteFile(s3Key);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(DeleteObjectCommand);
    });

    it('should handle deletion errors', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';
      const error = new Error('S3 deletion failed');

      mockSend.mockRejectedValueOnce(error);

      await expect(service.deleteFile(s3Key)).rejects.toThrow('S3 deletion failed');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';

      mockSend.mockResolvedValueOnce({} as any);

      const exists = await service.fileExists(s3Key);

      expect(exists).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(HeadObjectCommand);
    });

    it('should return false if file does not exist', async () => {
      const s3Key = 'org-123/form-456/field-789/nonexistent.pdf';
      const error: any = new Error('Not Found');
      error.name = 'NotFound';

      mockSend.mockRejectedValueOnce(error);

      const exists = await service.fileExists(s3Key);

      expect(exists).toBe(false);
    });

    it('should throw error for other S3 errors', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';
      const error = new Error('S3 error');

      mockSend.mockRejectedValueOnce(error);

      await expect(service.fileExists(s3Key)).rejects.toThrow('S3 error');
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';
      const mockMetadata = {
        ContentLength: 1024,
        ContentType: 'application/pdf',
        LastModified: new Date('2024-01-01'),
        Metadata: {
          organizationId: 'org-123',
          formId: 'form-456',
        },
      };

      mockSend.mockResolvedValueOnce(mockMetadata as any);

      const metadata = await service.getFileMetadata(s3Key);

      expect(metadata).toEqual({
        size: 1024,
        contentType: 'application/pdf',
        lastModified: new Date('2024-01-01'),
        metadata: {
          organizationId: 'org-123',
          formId: 'form-456',
        },
      });
    });

    it('should return null if file does not exist', async () => {
      const s3Key = 'org-123/form-456/field-789/nonexistent.pdf';
      const error: any = new Error('Not Found');
      error.name = 'NotFound';

      mockSend.mockRejectedValueOnce(error);

      const metadata = await service.getFileMetadata(s3Key);

      expect(metadata).toBeNull();
    });

    it('should handle missing metadata fields', async () => {
      const s3Key = 'org-123/form-456/field-789/test.pdf';
      const mockMetadata = {};

      mockSend.mockResolvedValueOnce(mockMetadata as any);

      const metadata = await service.getFileMetadata(s3Key);

      expect(metadata).toEqual({
        size: 0,
        contentType: 'application/octet-stream',
        lastModified: expect.any(Date),
        metadata: {},
      });
    });
  });

  describe('S3 key generation with organization segregation', () => {
    it('should ensure organization-level segregation in S3 keys', async () => {
      const org1Params = {
        organizationId: 'org-111',
        formId: 'form-456',
        fieldId: 'field-789',
        file: {
          buffer: Buffer.from('test content'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        },
      };

      const org2Params = {
        ...org1Params,
        organizationId: 'org-222',
      };

      mockSend.mockResolvedValue({} as any);

      const result1 = await service.uploadFile(org1Params);
      const result2 = await service.uploadFile(org2Params);

      expect(result1.s3Key).toContain('org-111/');
      expect(result2.s3Key).toContain('org-222/');
      expect(result1.s3Key).not.toContain('org-222/');
      expect(result2.s3Key).not.toContain('org-111/');
    });

    it('should include form and field IDs in S3 key structure', async () => {
      const params = {
        organizationId: 'org-123',
        formId: 'form-abc',
        fieldId: 'field-xyz',
        file: {
          buffer: Buffer.from('test content'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        },
      };

      mockSend.mockResolvedValueOnce({} as any);

      const result = await service.uploadFile(params);

      expect(result.s3Key).toMatch(/^org-123\/form-abc\/field-xyz\/.+\.pdf$/);
    });
  });
});
