/**
 * Registrations Module (Entity Registration Management)
 * 
 * Capability module that provides entity registration management functionality.
 * Only visible if organisation has 'registrations' capability enabled.
 * 
 * Features:
 * - Registration type management for entities (horses, boats, equipment, etc.)
 * - Registrations database with advanced filtering
 * - Batch operations (mark processed, add/remove labels)
 * - Custom filter sets for registration searches
 * - Excel export for registration data
 * - Rolling and fixed-period registrations
 * - Application form integration
 * - Payment method configuration
 * - Terms and conditions support
 * - Automatic status updates for expired registrations
 * 
 * Key Differences from Memberships:
 * - Registrations are for entities (things), not people
 * - Entity Name field identifies what is being registered
 * - No group registrations (each entity is registered individually)
 * - Simpler data model focused on entity tracking
 */

// Re-export module config (separated to allow lightweight test imports)
export { registrationsModule } from './module.config';

// Export pages for direct use if needed
export { default as RegistrationTypesListPage } from './pages/RegistrationTypesListPage';
export { default as CreateRegistrationTypePage } from './pages/CreateRegistrationTypePage';
export { default as RegistrationTypeDetailsPage } from './pages/RegistrationTypeDetailsPage';
export { default as RegistrationsDatabasePage } from './pages/RegistrationsDatabasePage';
export { default as RegistrationDetailsPage } from './pages/RegistrationDetailsPage';
export { default as DiscountsListPage } from './pages/DiscountsListPage';
export { default as CreateDiscountPage } from './pages/CreateDiscountPage';
export { default as EditDiscountPage } from './pages/EditDiscountPage';

// Export components
export { default as RegistrationTypeForm } from './components/RegistrationTypeForm';
export { default as CreateCustomFilterDialog } from './components/CreateCustomFilterDialog';
export { default as BatchOperationsDialog } from './components/BatchOperationsDialog';

// Export types
export * from './types/registration.types';
export * from './types/module.types';

export const ORGADMIN_REGISTRATIONS_VERSION = '1.0.0';
