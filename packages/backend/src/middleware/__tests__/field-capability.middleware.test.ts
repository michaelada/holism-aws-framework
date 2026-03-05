import { Response, NextFunction } from 'express';
import { validateFieldCapability } from '../field-capability.middleware';
import { OrganisationRequest } from '../capability.middleware';

describe('validateFieldCapability Middleware', () => {
  let mockRequest: Partial<OrganisationRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      capabilities: []
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Document upload field types (file and image)', () => {
    describe('With document-management capability', () => {
      beforeEach(() => {
        mockRequest.capabilities = ['document-management'];
      });

      it('should allow creating a field with datatype "file"', () => {
        mockRequest.body = { datatype: 'file' };

        const middleware = validateFieldCapability();
        middleware(
          mockRequest as OrganisationRequest,
          mockResponse as Response,
          nextFunction
        );

        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(mockResponse.json).not.toHaveBeenCalled();
      });

      it('should allow creating a field with datatype "image"', () => {
        mockRequest.body = { datatype: 'image' };

        const middleware = validateFieldCapability();
        middleware(
          mockRequest as OrganisationRequest,
          mockResponse as Response,
          nextFunction
        );

        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(mockResponse.json).not.toHaveBeenCalled();
      });

      it('should allow when organization has multiple capabilities including document-management', () => {
        mockRequest.capabilities = ['event-management', 'document-management', 'memberships'];
        mockRequest.body = { datatype: 'file' };

        const middleware = validateFieldCapability();
        middleware(
          mockRequest as OrganisationRequest,
          mockResponse as Response,
          nextFunction
        );

        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('Without document-management capability', () => {
      beforeEach(() => {
        mockRequest.capabilities = ['event-management', 'memberships'];
      });

      it('should return 403 when creating a field with datatype "file"', () => {
        mockRequest.body = { datatype: 'file' };

        const middleware = validateFieldCapability();
        middleware(
          mockRequest as OrganisationRequest,
          mockResponse as Response,
          nextFunction
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: {
            code: 'CAPABILITY_REQUIRED',
            message: 'Document management capability required for file and image fields',
            requiredCapability: 'document-management'
          }
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should return 403 when creating a field with datatype "image"', () => {
        mockRequest.body = { datatype: 'image' };

        const middleware = validateFieldCapability();
        middleware(
          mockRequest as OrganisationRequest,
          mockResponse as Response,
          nextFunction
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: {
            code: 'CAPABILITY_REQUIRED',
            message: 'Document management capability required for file and image fields',
            requiredCapability: 'document-management'
          }
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should return 403 when organization has empty capabilities array', () => {
        mockRequest.capabilities = [];
        mockRequest.body = { datatype: 'file' };

        const middleware = validateFieldCapability();
        middleware(
          mockRequest as OrganisationRequest,
          mockResponse as Response,
          nextFunction
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: {
            code: 'CAPABILITY_REQUIRED',
            message: 'Document management capability required for file and image fields',
            requiredCapability: 'document-management'
          }
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });
  });

  describe('Non-document field types', () => {
    const nonDocumentDatatypes = [
      'text',
      'textarea',
      'number',
      'email',
      'phone',
      'date',
      'time',
      'datetime',
      'boolean',
      'select',
      'multiselect',
      'radio',
      'checkbox',
      'url'
    ];

    describe('With document-management capability', () => {
      beforeEach(() => {
        mockRequest.capabilities = ['document-management'];
      });

      nonDocumentDatatypes.forEach(datatype => {
        it(`should allow creating a field with datatype "${datatype}"`, () => {
          mockRequest.body = { datatype };

          const middleware = validateFieldCapability();
          middleware(
            mockRequest as OrganisationRequest,
            mockResponse as Response,
            nextFunction
          );

          expect(nextFunction).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalled();
        });
      });
    });

    describe('Without document-management capability', () => {
      beforeEach(() => {
        mockRequest.capabilities = ['event-management'];
      });

      nonDocumentDatatypes.forEach(datatype => {
        it(`should allow creating a field with datatype "${datatype}"`, () => {
          mockRequest.body = { datatype };

          const middleware = validateFieldCapability();
          middleware(
            mockRequest as OrganisationRequest,
            mockResponse as Response,
            nextFunction
          );

          expect(nextFunction).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalled();
        });
      });
    });

    describe('With empty capabilities array', () => {
      beforeEach(() => {
        mockRequest.capabilities = [];
      });

      nonDocumentDatatypes.forEach(datatype => {
        it(`should allow creating a field with datatype "${datatype}"`, () => {
          mockRequest.body = { datatype };

          const middleware = validateFieldCapability();
          middleware(
            mockRequest as OrganisationRequest,
            mockResponse as Response,
            nextFunction
          );

          expect(nextFunction).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should return 500 when capabilities are not loaded (undefined)', () => {
      delete mockRequest.capabilities;
      mockRequest.body = { datatype: 'file' };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Organisation capabilities not loaded. Ensure loadOrganisationCapabilities middleware is used before validateFieldCapability.'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow when no datatype is provided in request body', () => {
      mockRequest.capabilities = [];
      mockRequest.body = {};

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow when datatype is null', () => {
      mockRequest.capabilities = [];
      mockRequest.body = { datatype: null };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow when datatype is undefined', () => {
      mockRequest.capabilities = [];
      mockRequest.body = { datatype: undefined };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should be case-sensitive for datatype matching', () => {
      mockRequest.capabilities = ['document-management'];
      mockRequest.body = { datatype: 'FILE' };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      // Should allow because 'FILE' !== 'file'
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should be case-sensitive for capability matching', () => {
      mockRequest.capabilities = ['Document-Management'];
      mockRequest.body = { datatype: 'file' };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      // Should reject because 'Document-Management' !== 'document-management'
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Error message format', () => {
    beforeEach(() => {
      mockRequest.capabilities = [];
    });

    it('should return error with correct structure for file datatype', () => {
      mockRequest.body = { datatype: 'file' };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
            requiredCapability: expect.any(String)
          })
        })
      );
    });

    it('should include "document-management" in requiredCapability field', () => {
      mockRequest.body = { datatype: 'image' };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error.requiredCapability).toBe('document-management');
    });

    it('should include descriptive message about missing capability', () => {
      mockRequest.body = { datatype: 'file' };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error.message).toContain('Document management capability required');
      expect(callArgs.error.message).toContain('file and image fields');
    });
  });

  describe('Request body variations', () => {
    beforeEach(() => {
      mockRequest.capabilities = ['document-management'];
    });

    it('should work when body contains additional fields', () => {
      mockRequest.body = {
        datatype: 'file',
        shortName: 'document',
        displayName: 'Document Upload',
        description: 'Upload a document'
      };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should only check datatype field and ignore other fields', () => {
      mockRequest.capabilities = [];
      mockRequest.body = {
        datatype: 'text',
        someOtherField: 'file'
      };

      const middleware = validateFieldCapability();
      middleware(
        mockRequest as OrganisationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
