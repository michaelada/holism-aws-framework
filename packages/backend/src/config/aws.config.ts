import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { logger } from './logger';

/**
 * AWS S3 Configuration
 * 
 * Configures the S3 client for file uploads with organization-level segregation.
 * Files are stored in subdirectories: /org-id/form-id/field-id/filename
 */

// S3 Configuration from environment variables
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'aws-framework-uploads';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// S3 Client configuration
const s3Config: S3ClientConfig = {
  region: AWS_REGION,
};

// Add credentials if provided (for local development)
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  };
}

// Create S3 client instance
export const s3Client = new S3Client(s3Config);

// Export bucket name for use in services
export const S3_BUCKET_NAME = AWS_S3_BUCKET;

// CORS configuration for S3 bucket (to be applied via Terraform or AWS Console)
export const S3_CORS_CONFIGURATION = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: ['*'], // Should be restricted to specific domains in production
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000,
    },
  ],
};

logger.info('AWS S3 client initialized', {
  region: AWS_REGION,
  bucket: AWS_S3_BUCKET,
});
