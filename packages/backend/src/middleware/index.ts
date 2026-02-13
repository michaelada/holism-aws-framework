export {
  authenticateToken,
  requireRole,
  requireAllRoles,
  optionalAuth,
  UserInfo,
  AuthenticatedRequest
} from './auth.middleware';

export {
  loadOrganisationCapabilities,
  requireCapability,
  requireAllCapabilities,
  requireOrgAdminCapability,
  OrganisationRequest
} from './capability.middleware';

export {
  errorHandler,
  asyncHandler
} from './error-handler.middleware';

export {
  AppError,
  ValidationError,
  NotFoundError,
  AuthError,
  ForbiddenError,
  InternalError,
  FieldError
} from './errors';

export { requestLogger } from './request-logger.middleware';

export { metricsMiddleware } from './metrics.middleware';

export {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  inputValidators,
  validateUUIDParam,
  validateRequiredFields,
  validateEmailField,
  validatePagination,
  validateDateRange,
  validateSortParam,
  validateFileUpload
} from './input-validation.middleware';

export {
  rateLimit,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit,
  expensiveOperationRateLimit,
  perUserRateLimit,
  perOrganizationRateLimit
} from './rate-limit.middleware';

export {
  csrfProtection,
  generateCSRFToken,
  doubleSubmitCookie
} from './csrf.middleware';

export {
  xssProtection,
  richTextXSSProtection,
  strictXSSProtection,
  xssSecurityHeaders,
  xssDetection,
  detectXSS,
  richTextConfig
} from './xss-protection.middleware';
