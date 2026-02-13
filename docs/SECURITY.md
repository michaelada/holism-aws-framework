# Security Documentation

## Overview

This document outlines the security measures implemented in the ItsPlainSailing Organisation Admin System to protect against common web application vulnerabilities and ensure data security.

## Security Measures

### 1. Authentication

**Implementation:**
- Keycloak-based authentication using JWT tokens
- Token validation on all protected endpoints
- Token expiration enforcement
- Secure token storage and transmission

**Middleware:**
- `authenticateToken`: Validates JWT tokens from Keycloak
- `requireRole`: Enforces role-based access control
- `optionalAuth`: Allows optional authentication for public endpoints

**Best Practices:**
- Tokens are transmitted via Authorization header
- Tokens expire after configured period
- Refresh tokens are used for session management
- Failed authentication attempts are logged

### 2. Authorization

**Implementation:**
- Capability-based access control for feature modules
- Role-based access control for administrative functions
- Organization-level data isolation

**Middleware:**
- `requireCapability`: Enforces capability requirements
- `loadOrganisationCapabilities`: Loads user's organization capabilities
- `requireOrgAdminCapability`: Ensures user has org-admin role

**Access Control Matrix:**

| Resource | Required Role | Required Capability |
|----------|--------------|---------------------|
| Super Admin | super-admin | - |
| Organization Management | super-admin | - |
| Event Management | org-admin | event-management |
| Membership Management | org-admin | memberships |
| Merchandise Management | org-admin | merchandise |
| Calendar Bookings | org-admin | calendar-bookings |
| Registrations | org-admin | registrations |
| Event Ticketing | org-admin | event-ticketing |
| Form Builder | org-admin | - (core) |
| Settings | org-admin | - (core) |
| Payments | org-admin | - (core) |
| Reporting | org-admin | - (core) |
| User Management | org-admin | - (core) |

### 3. Input Validation

**Implementation:**
- Comprehensive input validation using Yup schemas
- Type checking and format validation
- Length and range validation
- Custom validation rules

**Middleware:**
- `validateUUIDParam`: Validates UUID format in route parameters
- `validateRequiredFields`: Ensures required fields are present
- `validateEmailField`: Validates email format
- `validatePagination`: Validates pagination parameters
- `validateDateRange`: Validates date range parameters
- `validateSortParam`: Prevents SQL injection in sort parameters
- `validateFileUpload`: Validates file uploads

**Validation Rules:**
- UUIDs must match standard UUID format
- Emails must be valid email addresses
- Dates must be ISO 8601 format
- Pagination limits: 1-100 items per page
- File sizes: Maximum 10MB per file
- File types: Whitelist of allowed MIME types

### 4. Input Sanitization

**Implementation:**
- HTML sanitization using DOMPurify
- SQL injection prevention using parameterized queries
- XSS prevention through input/output encoding

**Middleware:**
- `sanitizeBody`: Sanitizes request body
- `sanitizeQuery`: Sanitizes query parameters
- `sanitizeParams`: Sanitizes route parameters
- `xssProtection`: Removes dangerous HTML/JavaScript
- `richTextXSSProtection`: Allows safe HTML formatting

**Sanitization Rules:**
- All user input is trimmed and escaped
- HTML tags are stripped unless explicitly allowed
- JavaScript event handlers are removed
- SQL special characters are escaped
- Rich text fields allow only safe formatting tags

### 5. Rate Limiting

**Implementation:**
- Request rate limiting per IP address
- Per-user rate limiting for authenticated requests
- Per-organization rate limiting
- Stricter limits for sensitive operations

**Rate Limits:**
- API endpoints: 100 requests/minute
- Authentication: 5 attempts/15 minutes
- File uploads: 10 uploads/minute
- Expensive operations (exports): 5 requests/minute

**Middleware:**
- `apiRateLimit`: Standard API rate limiting
- `authRateLimit`: Strict authentication rate limiting
- `uploadRateLimit`: File upload rate limiting
- `expensiveOperationRateLimit`: Export/report rate limiting
- `perUserRateLimit`: Per-user rate limiting
- `perOrganizationRateLimit`: Per-organization rate limiting

### 6. XSS Protection

**Implementation:**
- Content Security Policy (CSP) headers
- HTML sanitization on input and output
- XSS detection and logging
- Safe HTML rendering for rich text

**Security Headers:**
```
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
```

**Middleware:**
- `xssSecurityHeaders`: Sets XSS protection headers
- `xssDetection`: Detects and logs XSS attempts
- `xssProtection`: Sanitizes HTML content
- `richTextXSSProtection`: Allows safe HTML formatting

**Allowed HTML Tags (Rich Text):**
- Formatting: `<p>`, `<br>`, `<strong>`, `<em>`, `<u>`
- Headings: `<h1>` through `<h6>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Other: `<blockquote>`, `<a>`, `<span>`, `<div>`

**Forbidden HTML:**
- Scripts: `<script>`, `<iframe>`, `<object>`, `<embed>`
- Event handlers: `onclick`, `onerror`, etc.
- JavaScript URLs: `javascript:`, `data:text/html`
- Styles: `<style>` tags (inline styles allowed with whitelist)

### 7. CSRF Protection

**Implementation:**
- CSRF token generation and validation
- Double submit cookie pattern
- SameSite cookie attribute
- Token rotation on each request

**Middleware:**
- `csrfProtection`: Full CSRF protection with server-side storage
- `doubleSubmitCookie`: Simpler CSRF protection without storage
- `generateCSRFToken`: Generates tokens for forms

**CSRF Token Flow:**
1. Client requests page (GET)
2. Server generates CSRF token
3. Token sent in cookie and header
4. Client includes token in state-changing requests
5. Server validates token matches
6. Token rotated after successful validation

**Configuration:**
- Token length: 32 bytes (64 hex characters)
- Token expiration: 1 hour
- Cookie settings: HttpOnly, Secure, SameSite=Strict
- Header name: `X-CSRF-Token`

### 8. SQL Injection Protection

**Implementation:**
- Parameterized queries using pg library
- Input validation and sanitization
- Whitelist validation for dynamic SQL
- Query logging and monitoring

**Best Practices:**
- Never concatenate user input into SQL queries
- Use parameterized queries for all database operations
- Validate and whitelist sort/filter parameters
- Escape special characters in LIKE queries
- Use prepared statements for repeated queries

**Example:**
```typescript
// ✓ GOOD - Parameterized query
const result = await db.query(
  'SELECT * FROM events WHERE organisation_id = $1 AND name = $2',
  [organisationId, name]
);

// ✗ BAD - String concatenation
const result = await db.query(
  `SELECT * FROM events WHERE name = '${name}'`
);
```

### 9. Security Headers

**Implementation:**
- Helmet.js for security headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- Additional security headers

**Headers Set:**
```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 10. File Upload Security

**Implementation:**
- File type validation (MIME type and extension)
- File size limits
- Virus scanning (recommended)
- Secure file storage in AWS S3
- Organization-level file isolation

**Validation:**
- Maximum file size: 10MB
- Allowed file types: PDF, images (JPEG, PNG, GIF), documents (DOC, DOCX)
- File name sanitization
- Content-Type verification

**Storage:**
- Files stored in AWS S3
- Organization-level directory structure: `/org-id/form-id/field-id/filename`
- Pre-signed URLs for secure access
- Automatic expiration of download links

**Middleware:**
- `validateFileUpload`: Validates file uploads
- `uploadRateLimit`: Rate limits file uploads

### 11. Error Handling

**Implementation:**
- Centralized error handling
- Sanitized error messages
- Detailed error logging
- Request ID tracking

**Error Response Format:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "requestId": "req_1234567890_abc123"
  }
}
```

**Security Considerations:**
- Stack traces never sent to clients
- Database errors sanitized
- Sensitive information removed from error messages
- Detailed errors logged server-side only

**Middleware:**
- `errorHandler`: Centralized error handling
- `asyncHandler`: Wraps async route handlers

### 12. Logging and Monitoring

**Implementation:**
- Winston logger for structured logging
- Request logging with sanitization
- Security event logging
- Prometheus metrics

**Logged Events:**
- Authentication attempts (success/failure)
- Authorization failures
- Rate limit violations
- XSS/CSRF attempts
- SQL injection attempts
- File upload attempts
- API errors

**Log Levels:**
- ERROR: Application errors, security violations
- WARN: Authentication failures, rate limits
- INFO: Successful operations, API requests
- DEBUG: Detailed debugging information

**Sensitive Data:**
- Passwords never logged
- Tokens logged as truncated hashes
- PII sanitized in logs
- Credit card data never logged

### 13. Organization Data Isolation

**Implementation:**
- Organization ID validation on all requests
- Database-level row security
- API-level organization filtering
- User-organization binding

**Enforcement:**
- All queries filtered by organization ID
- Users can only access their organization's data
- Cross-organization access prevented
- Organization ID from authenticated token

### 14. Session Management

**Implementation:**
- JWT-based stateless sessions
- Token expiration and refresh
- Secure token storage
- Session invalidation on logout

**Configuration:**
- Access token expiration: 15 minutes
- Refresh token expiration: 7 days
- Token rotation on refresh
- Secure cookie storage

## Security Testing

### Automated Tests

**Test Coverage:**
- Authentication and authorization tests
- Input validation tests
- XSS protection tests
- CSRF protection tests
- SQL injection tests
- Rate limiting tests
- Security header tests

**Test Location:**
- `packages/backend/src/__tests__/security/security-audit.test.ts`

### Manual Testing

**Security Checklist:**
- [ ] Test authentication with invalid tokens
- [ ] Test authorization with insufficient permissions
- [ ] Test input validation with malicious input
- [ ] Test XSS with various payloads
- [ ] Test CSRF with missing/invalid tokens
- [ ] Test SQL injection with various payloads
- [ ] Test rate limiting with excessive requests
- [ ] Test file upload with malicious files
- [ ] Test error handling for information disclosure
- [ ] Test organization isolation

### Penetration Testing

**Recommended Tools:**
- OWASP ZAP for automated scanning
- Burp Suite for manual testing
- SQLMap for SQL injection testing
- XSSer for XSS testing

## Security Incident Response

### Incident Detection

**Monitoring:**
- Failed authentication attempts
- Authorization failures
- Rate limit violations
- XSS/CSRF attempts
- SQL injection attempts
- Unusual API patterns

**Alerts:**
- Multiple failed login attempts
- Repeated authorization failures
- Rate limit violations
- Security header violations
- File upload anomalies

### Incident Response

**Steps:**
1. Detect and log the incident
2. Assess the severity and impact
3. Contain the incident (block IP, revoke tokens)
4. Investigate the root cause
5. Remediate the vulnerability
6. Document the incident
7. Review and improve security measures

## Security Best Practices

### For Developers

1. **Never trust user input** - Always validate and sanitize
2. **Use parameterized queries** - Prevent SQL injection
3. **Implement least privilege** - Grant minimum necessary permissions
4. **Keep dependencies updated** - Patch security vulnerabilities
5. **Review code for security** - Use security linters and code review
6. **Test security measures** - Write security tests
7. **Log security events** - Monitor for suspicious activity
8. **Handle errors securely** - Don't expose sensitive information

### For Administrators

1. **Keep software updated** - Apply security patches promptly
2. **Monitor logs** - Watch for security incidents
3. **Review access controls** - Audit user permissions regularly
4. **Backup data** - Maintain secure backups
5. **Use strong passwords** - Enforce password policies
6. **Enable MFA** - Require multi-factor authentication
7. **Limit access** - Use IP whitelisting where appropriate
8. **Train users** - Educate on security best practices

## Compliance

### GDPR Compliance

- User data encryption
- Right to access data
- Right to delete data
- Data breach notification
- Privacy by design

### OWASP Top 10

- ✓ A01:2021 - Broken Access Control
- ✓ A02:2021 - Cryptographic Failures
- ✓ A03:2021 - Injection
- ✓ A04:2021 - Insecure Design
- ✓ A05:2021 - Security Misconfiguration
- ✓ A06:2021 - Vulnerable and Outdated Components
- ✓ A07:2021 - Identification and Authentication Failures
- ✓ A08:2021 - Software and Data Integrity Failures
- ✓ A09:2021 - Security Logging and Monitoring Failures
- ✓ A10:2021 - Server-Side Request Forgery (SSRF)

## Security Contacts

**Security Issues:**
- Report security vulnerabilities to: security@itsplainsailing.com
- Use encrypted email for sensitive reports
- Include detailed reproduction steps
- Allow reasonable time for response

**Security Updates:**
- Subscribe to security mailing list
- Monitor GitHub security advisories
- Review dependency security alerts

## Changelog

### Version 1.0.0 (2024)
- Initial security implementation
- Authentication and authorization
- Input validation and sanitization
- Rate limiting
- XSS and CSRF protection
- SQL injection protection
- Security headers
- File upload security
- Error handling
- Logging and monitoring
