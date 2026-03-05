import { Response, NextFunction } from 'express';
import { OrganisationRequest } from './capability.middleware';

/**
 * Middleware to validate that an organization has the required capability
 * for creating or updating fields with document upload datatypes (file or image).
 * 
 * Must be used after loadOrganisationCapabilities middleware.
 * 
 * This middleware checks if the field datatype is 'file' or 'image' and verifies
 * that the organization has the 'document-management' capability. If the capability
 * is missing, it returns HTTP 403 with a descriptive error message.
 * 
 * @returns Express middleware function
 * 
 * @example
 * // Protect field creation endpoint
 * router.post('/fields',
 *   requireRole('admin'),
 *   loadOrganisationCapabilities(),
 *   validateFieldCapability(),
 *   createField
 * );
 * 
 * @example
 * // Protect field update endpoint
 * router.put('/fields/:shortName',
 *   requireRole('admin'),
 *   loadOrganisationCapabilities(),
 *   validateFieldCapability(),
 *   updateField
 * );
 */
export function validateFieldCapability() {
  return (req: OrganisationRequest, res: Response, next: NextFunction): void => {
    const { datatype } = req.body;

    // Check if datatype requires document-management capability
    if (datatype === 'file' || datatype === 'image') {
      // Verify capabilities are loaded
      if (!req.capabilities) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Organisation capabilities not loaded. Ensure loadOrganisationCapabilities middleware is used before validateFieldCapability.'
          }
        });
        return;
      }

      // Check if organization has document-management capability
      if (!req.capabilities.includes('document-management')) {
        res.status(403).json({
          error: {
            code: 'CAPABILITY_REQUIRED',
            message: 'Document management capability required for file and image fields',
            requiredCapability: 'document-management'
          }
        });
        return;
      }
    }

    // Capability check passed or not required for this datatype
    next();
  };
}
