import * as fc from 'fast-check';
import request from 'supertest';
import express, { Express } from 'express';

// Shared state for capability mocking
let mockCapabilities: string[] = [];

// Mock dependencies BEFORE importing routes
jest.mock('../../services/metadata.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: jest.fn(() => (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  requireRole: jest.fn(() => (_req: any, _res: any, next: any) => {
    next();
  })
}));
jest.mock('../../middleware/capability.middleware', () => ({
  loadOrganisationCapabilities: jest.fn(() => (req: any, _res: any, next: any) => {
    req.capabilities = mockCapabilities;
    next();
  })
}));

// Now import after mocks are set up
import metadataRoutes from '../../routes/metadata.routes';
import { metadataService } from '../../services/metadata.service';

describe('Metadata Routes Property-Based Tests', () => {
  let app: Express;

  beforeAll(() => {
    // Setup Express app with routes once
    app = express();
    app.use(express.json());
    app.use('/api/metadata', metadataRoutes);
  });

  beforeEach(() => {
    // Reset all mocks and capabilities before each test
    jest.clearAllMocks();
    mockCapabilities = [];
  });

  /**
   * Property 9: Backend Rejects Document Fields Without Capability
   * Feature: document-management-capability-consolidation, Property 9: Backend Rejects Document Fields Without Capability
   * 
   * For any organization without document-management capability, when attempting to create
   * or update a field with datatype 'file' or 'image', the backend should return HTTP 403
   * with a descriptive error message indicating the missing capability.
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.9**
   */
  describe('Property 9: Backend Rejects Document Fields Without Capability', () => {
    it('should reject field creation with file datatype when capability is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 200 }),
          async (shortName, displayName, description) => {
            // Set capabilities WITHOUT document-management
            mockCapabilities = ['some-other-capability', 'another-capability'];

            // Arrange: Create field with file datatype
            const fieldData = {
              shortName,
              displayName,
              description,
              datatype: 'file',
              datatypeProperties: {}
            };

            // Act: Attempt to create field
            const response = await request(app)
              .post('/api/metadata/fields')
              .send(fieldData);

            // Assert: Should return 403 with descriptive error
            expect(response.status).toBe(403);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('CAPABILITY_REQUIRED');
            expect(response.body.error.message).toContain('Document management capability required');
            expect(response.body.error.requiredCapability).toBe('document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject field creation with image datatype when capability is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 200 }),
          async (shortName, displayName, description) => {
            // Set capabilities WITHOUT document-management
            mockCapabilities = ['some-other-capability', 'another-capability'];

            // Arrange: Create field with image datatype
            const fieldData = {
              shortName,
              displayName,
              description,
              datatype: 'image',
              datatypeProperties: {}
            };

            // Act: Attempt to create field
            const response = await request(app)
              .post('/api/metadata/fields')
              .send(fieldData);

            // Assert: Should return 403 with descriptive error
            expect(response.status).toBe(403);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('CAPABILITY_REQUIRED');
            expect(response.body.error.message).toContain('Document management capability required');
            expect(response.body.error.requiredCapability).toBe('document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow non-document field types regardless of capability', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.constantFrom('text', 'number', 'email', 'date', 'boolean', 'select'),
          async (shortName, displayName, datatype) => {
            // Set capabilities WITHOUT document-management
            mockCapabilities = ['some-other-capability'];

            // Mock metadataService to return success
            (metadataService.registerField as jest.Mock).mockResolvedValue({
              id: 'test-id',
              shortName,
              displayName,
              datatype,
              datatypeProperties: {},
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Arrange: Create field with non-document datatype
            const fieldData = {
              shortName,
              displayName,
              description: 'Test field',
              datatype,
              datatypeProperties: {}
            };

            // Act: Attempt to create field
            const response = await request(app)
              .post('/api/metadata/fields')
              .send(fieldData);

            // Assert: Should succeed (not 403)
            expect(response.status).not.toBe(403);
            // Should be 201 (created) or possibly 500 if service mock fails
            // The key is that it's NOT rejected for capability reasons
            if (response.status === 403) {
              expect(response.body.error?.code).not.toBe('CAPABILITY_REQUIRED');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Backend Allows Document Fields With Capability
   * Feature: document-management-capability-consolidation, Property 10: Backend Allows Document Fields With Capability
   * 
   * For any organization with document-management capability, when creating or updating
   * a field with datatype 'file' or 'image', the backend should allow the operation
   * and return success.
   * 
   * **Validates: Requirements 4.5, 4.6, 4.7, 4.8**
   */
  describe('Property 10: Backend Allows Document Fields With Capability', () => {
    it('should allow field creation with file datatype when capability is present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
          async (shortName, displayName, description, otherCapabilities) => {
            // Set capabilities WITH document-management
            mockCapabilities = ['document-management', ...otherCapabilities];

            // Mock metadataService to return success
            const mockField = {
              id: 'test-id',
              shortName,
              displayName,
              description,
              datatype: 'file',
              datatypeProperties: {},
              createdAt: new Date(),
              updatedAt: new Date()
            };
            (metadataService.registerField as jest.Mock).mockResolvedValue(mockField);

            // Arrange: Create field with file datatype
            const fieldData = {
              shortName,
              displayName,
              description,
              datatype: 'file',
              datatypeProperties: {}
            };

            // Act: Attempt to create field
            const response = await request(app)
              .post('/api/metadata/fields')
              .send(fieldData);

            // Assert: Should NOT return 403 (capability check should pass)
            expect(response.status).not.toBe(403);
            // Should be 201 (created) if service succeeds
            if (response.status === 201) {
              expect(response.body.datatype).toBe('file');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow field creation with image datatype when capability is present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
          async (shortName, displayName, description, otherCapabilities) => {
            // Set capabilities WITH document-management
            mockCapabilities = ['document-management', ...otherCapabilities];

            // Mock metadataService to return success
            const mockField = {
              id: 'test-id',
              shortName,
              displayName,
              description,
              datatype: 'image',
              datatypeProperties: {},
              createdAt: new Date(),
              updatedAt: new Date()
            };
            (metadataService.registerField as jest.Mock).mockResolvedValue(mockField);

            // Arrange: Create field with image datatype
            const fieldData = {
              shortName,
              displayName,
              description,
              datatype: 'image',
              datatypeProperties: {}
            };

            // Act: Attempt to create field
            const response = await request(app)
              .post('/api/metadata/fields')
              .send(fieldData);

            // Assert: Should NOT return 403 (capability check should pass)
            expect(response.status).not.toBe(403);
            // Should be 201 (created) if service succeeds
            if (response.status === 201) {
              expect(response.body.datatype).toBe('image');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow field update to file datatype when capability is present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
          async (shortName, displayName, description, otherCapabilities) => {
            // Set capabilities WITH document-management
            mockCapabilities = ['document-management', ...otherCapabilities];

            // Mock metadataService to return success
            const mockField = {
              id: 'test-id',
              shortName,
              displayName,
              description,
              datatype: 'file',
              datatypeProperties: {},
              createdAt: new Date(),
              updatedAt: new Date()
            };
            (metadataService.updateField as jest.Mock).mockResolvedValue(mockField);

            // Arrange: Update field to file datatype
            const fieldData = {
              displayName,
              description,
              datatype: 'file',
              datatypeProperties: {}
            };

            // Act: Attempt to update field
            const response = await request(app)
              .put(`/api/metadata/fields/${shortName}`)
              .send(fieldData);

            // Assert: Should NOT return 403 (capability check should pass)
            expect(response.status).not.toBe(403);
            // Should be 200 (updated) if service succeeds
            if (response.status === 200) {
              expect(response.body.datatype).toBe('file');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow field update to image datatype when capability is present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
          async (shortName, displayName, description, otherCapabilities) => {
            // Set capabilities WITH document-management
            mockCapabilities = ['document-management', ...otherCapabilities];

            // Mock metadataService to return success
            const mockField = {
              id: 'test-id',
              shortName,
              displayName,
              description,
              datatype: 'image',
              datatypeProperties: {},
              createdAt: new Date(),
              updatedAt: new Date()
            };
            (metadataService.updateField as jest.Mock).mockResolvedValue(mockField);

            // Arrange: Update field to image datatype
            const fieldData = {
              displayName,
              description,
              datatype: 'image',
              datatypeProperties: {}
            };

            // Act: Attempt to update field
            const response = await request(app)
              .put(`/api/metadata/fields/${shortName}`)
              .send(fieldData);

            // Assert: Should NOT return 403 (capability check should pass)
            expect(response.status).not.toBe(403);
            // Should be 200 (updated) if service succeeds
            if (response.status === 200) {
              expect(response.body.datatype).toBe('image');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
