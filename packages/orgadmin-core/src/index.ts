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
export * from './components';

// Shared utilities
export * from './utils';

// Shared context
export { OrganisationProvider, useOrganisation } from './context/OrganisationContext';
export type { Organisation } from './context/OrganisationContext';

// Module exports
export * from './dashboard';
export * from './forms';
export * from './settings';
export * from './payments';
export * from './reporting';
/*
 * The download half of any export. It lived inside `reporting/` and was needed
 * the moment a second module had a workbook to save (CLAUDE.md §1.5) — the
 * alternative being a second `URL.createObjectURL` dance that forgets to
 * revoke it.
 */
export { saveBlob } from './reporting/exportReport';
export * from './audit';
export * from './users';

// Export AuthTokenContext for shell integration
export { AuthTokenContext, OrganisationIdContext, organisationScopedUrl } from './hooks/useApi';

export const ORGADMIN_CORE_VERSION = '1.0.0';
