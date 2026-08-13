/**
 * Public surface of the account-shell package.
 *
 * The shell is an application rather than a library, so this exports only the
 * pieces the later account-* capability packages will need to plug into it:
 * the organisation context, the API hook and the navigation model.
 */
export { AccountOrganisationProvider, useAccountOrganisation } from './src/context/AccountOrganisationContext';
export type { AccountOrganisationContextValue, OrganisationState } from './src/context/AccountOrganisationContext';
export { AuthProvider, useAuthContext } from './src/context/AuthContext';
export { useAccountApi, AccountApiError } from './src/hooks/useAccountApi';
export type { ApiRequest } from './src/hooks/useAccountApi';
export { NAV_SECTIONS, visibleSections } from './src/components/navigation';
export type { NavItem, NavSection } from './src/components/navigation';
export { buildTheme } from './src/theme';
export * from './src/types/account';
