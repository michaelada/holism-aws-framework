/**
 * ItsPlainSailing Organisation Admin Core Modules
 * 
 * This package contains the core modules that are always available
 * to all organisation administrators:
 * - Dashboard: High-level metrics and navigation
 * - Forms: Form builder for application forms
 * - Settings: Organisation settings management
 * - Payments: Payment and refund management
 * - Reporting: Reports and analytics
 * - Users: User management (admin and account users)
 */

// Shared hooks
export * from './hooks';

// Shared utilities
export * from './utils';

// Module exports
export * from './dashboard';
export * from './forms';
export * from './settings';
export * from './payments';
export * from './reporting';
export * from './users';

// Export AuthTokenContext for shell integration
export { AuthTokenContext } from './hooks/useApi';

export const ORGADMIN_CORE_VERSION = '1.0.0';
