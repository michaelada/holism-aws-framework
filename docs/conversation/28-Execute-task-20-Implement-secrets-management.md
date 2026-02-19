# Execute task: 20. Implement secrets management

Exported: 19/02/2026, 08:35:08

---

**User:**

Execute Task: 20. Implement secrets management

---

**Assistant:**

I'll implement task 20 (Implement secrets management) by working through each subtask sequentially.

Let me start by reading the design document to understand the secrets management requirements better.

Now let me check the existing backend structure to understand where to implement the secrets management module:

Now let me check the current backend index.ts to understand the application startup:

Now let me check the requirements for secrets management:

Now let me start implementing the subtasks. I'll begin with task 20.1 - Create secrets management module.

Now I'll create the SecretsManager class in the config directory:

Now let me check the package.json to see if we need to add the AWS SDK dependency:

I need to add the AWS SDK for Secrets Manager. Let me update the package.json:

Now let me complete task 20.1:

Now let's move to task 20.2 - Integrate secrets with application startup:

Now I need to integrate the secrets manager with the application startup. Let me update the index.ts file:

Now I need to update the database configuration to use secrets from the secrets manager. Let me check the current database config:

Now let me update the database config to support loading password from secrets manager:

Now I need to update the database pool to use the async getDatabaseConfig:

Now I need to ensure that secrets don't appear in logs. Let me update the logger configuration to add a sanitization function:

Good! The logger already has a sanitizeLogData function. Now let me update the secrets manager to use this sanitization:

Now let me complete task 20.2:

Now let's move to task 20.3 - Write unit tests for secrets management:

Now I'll create unit tests for the secrets management module:

Now let me install the AWS SDK dependency and run the tests:

Now let's run the secrets tests:

Let me run the test without the --run flag (Jest doesn't use that flag):

I see the issue. The SecretsManager constructor is being called before the environment variables are set in the tests. I need to fix the implementation to make it more testable. Let me update the SecretsManager class:

Now let's run the tests again:

Excellent! All tests pass. Now let me also update the database config tests to account for the async change:

I need to update these tests to handle the async getDatabaseConfig:

Now let's run the database config tests to make sure they still pass:

Perfect! Now let me complete task 20.3:

Now let me complete the parent task 20:

Now let me run all the backend tests to make sure nothing broke:

Perfect! All tests pass. Now let me create a summary of what was implemented:

## Summary

I've successfully implemented **Task 20: Implement secrets management** for the AWS Web Application Framework. All three subtasks have been completed:

### What was implemented:

**Task 20.1 - Create secrets management module:**
- Created `packages/backend/src/config/secrets.ts` with a `SecretsManager` class
- Supports loading secrets from AWS Secrets Manager for production/staging environments
- Falls back to environment variables for local development
- Implements secret refresh for rotation support
- Includes proper error handling and sanitization to prevent secrets from leaking in logs
- Added AWS SDK dependency (`@aws-sdk/client-secrets-manager`) to package.json

**Task 20.2 - Integrate secrets with application startup:**
- Updated `packages/backend/src/index.ts` to load secrets on application startup
- Modified `packages/backend/src/config/database.config.ts` to support async secret loading
- Updated `packages/backend/src/database/pool.ts` to use async database configuration
- Integrated with existing logger sanitization to prevent secrets from appearing in logs

**Task 20.3 - Write unit tests for secrets management:**
- Created comprehensive unit tests in `packages/backend/src/config/__tests__/secrets.test.ts`
- Tests cover:
  - Loading secrets from environment variables (development)
  - Loading secrets from AWS Secrets Manager (production/staging)
  - Error handling and fallback mechanisms
  - Secret refresh functionality
  - API key parsing
  - Secret sanitization in logs (ensuring secrets never appear in logs)
  - ARN masking for security
- Updated database config tests to handle async configuration
- All 204 tests pass successfully

### Key Features:
- **Environment-aware**: Automatically uses environment variables in development and AWS Secrets Manager in production
- **Secure**: Secrets are never logged, ARNs are masked, and errors are sanitized
- **Rotation support**: Includes `refreshSecrets()` method for secret rotation
- **Flexible**: Supports multiple secret types (database passwords, API keys, JWT signing keys, etc.)
- **Well-tested**: 25 unit tests specifically for secrets management, plus integration with existing tests

The implementation follows all requirements (5.1, 5.2, 5.3, 5.4) and maintains the framework's security-first approach.

---
