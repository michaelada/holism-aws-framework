/**
 * Route to Page Mapping Utility
 * 
 * Defines mapping of routes to pageId and moduleId for contextual help.
 * Provides function to resolve current route to page information.
 * 
 * Requirements: 8.2
 */

import { ModuleId } from '../context/OnboardingContext';

/**
 * Page mapping interface
 * Maps a route pattern to a page identifier and module
 */
export interface PageMapping {
  /** Route pattern (can include :params) */
  route: string;
  /** Page identifier for help content lookup */
  pageId: string;
  /** Module this page belongs to */
  moduleId: ModuleId;
}

/**
 * Complete mapping of routes to page information
 * Used to determine which help content to display
 */
export const pageMappings: PageMapping[] = [
  // Dashboard
  { route: '/dashboard', pageId: 'overview', moduleId: 'dashboard' },
  { route: '/', pageId: 'overview', moduleId: 'dashboard' },
  
  // Users
  { route: '/users', pageId: 'list', moduleId: 'users' },
  { route: '/users/create', pageId: 'create', moduleId: 'users' },
  { route: '/users/invite', pageId: 'invite', moduleId: 'users' },
  { route: '/users/:id', pageId: 'detail', moduleId: 'users' },
  { route: '/users/:id/edit', pageId: 'edit', moduleId: 'users' },
  
  // Forms
  { route: '/forms', pageId: 'list', moduleId: 'forms' },
  { route: '/forms/create', pageId: 'create', moduleId: 'forms' },
  { route: '/forms/:id', pageId: 'detail', moduleId: 'forms' },
  { route: '/forms/:id/edit', pageId: 'edit', moduleId: 'forms' },
  { route: '/forms/:id/submissions', pageId: 'submissions', moduleId: 'forms' },
  
  // Events
  { route: '/events', pageId: 'list', moduleId: 'events' },
  { route: '/events/create', pageId: 'create', moduleId: 'events' },
  { route: '/events/:id', pageId: 'detail', moduleId: 'events' },
  { route: '/events/:id/edit', pageId: 'edit', moduleId: 'events' },
  { route: '/events/:id/registrations', pageId: 'registrations', moduleId: 'events' },
  
  // Memberships
  { route: '/memberships', pageId: 'list', moduleId: 'memberships' },
  { route: '/memberships/create', pageId: 'create', moduleId: 'memberships' },
  { route: '/memberships/:id', pageId: 'detail', moduleId: 'memberships' },
  { route: '/memberships/:id/edit', pageId: 'edit', moduleId: 'memberships' },
  { route: '/memberships/types', pageId: 'types', moduleId: 'memberships' },
  
  // Calendar
  { route: '/calendar', pageId: 'overview', moduleId: 'calendar' },
  { route: '/calendar/calendars', pageId: 'list', moduleId: 'calendar' },
  { route: '/calendar/calendars/create', pageId: 'create', moduleId: 'calendar' },
  { route: '/calendar/calendars/:id', pageId: 'detail', moduleId: 'calendar' },
  { route: '/calendar/calendars/:id/edit', pageId: 'edit', moduleId: 'calendar' },
  { route: '/calendar/bookings', pageId: 'bookings', moduleId: 'calendar' },
  
  // Payments
  { route: '/payments', pageId: 'overview', moduleId: 'payments' },
  { route: '/payments/transactions', pageId: 'transactions', moduleId: 'payments' },
  { route: '/payments/invoices', pageId: 'invoices', moduleId: 'payments' },
  { route: '/payments/invoices/create', pageId: 'create-invoice', moduleId: 'payments' },
];

/**
 * Resolve the current route to page information
 * 
 * @param pathname - Current route pathname (e.g., from useLocation)
 * @returns Page mapping if found, undefined otherwise
 */
export function resolvePageInfo(pathname: string): PageMapping | undefined {
  // Try exact match first
  const exactMatch = pageMappings.find(mapping => mapping.route === pathname);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Try pattern matching for routes with parameters
  for (const mapping of pageMappings) {
    if (matchRoute(mapping.route, pathname)) {
      return mapping;
    }
  }
  
  return undefined;
}

/**
 * Match a route pattern against a pathname
 * Supports :param style parameters
 * 
 * @param pattern - Route pattern (e.g., '/users/:id')
 * @param pathname - Actual pathname (e.g., '/users/123')
 * @returns True if pathname matches pattern
 */
function matchRoute(pattern: string, pathname: string): boolean {
  // Convert pattern to regex
  // Replace :param with regex that matches any non-slash characters
  const regexPattern = pattern
    .replace(/:[^/]+/g, '[^/]+')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}

/**
 * Get module ID from current pathname
 * Convenience function that extracts just the module ID
 * 
 * @param pathname - Current route pathname
 * @returns Module ID if found, undefined otherwise
 */
export function getModuleFromPath(pathname: string): ModuleId | undefined {
  const pageInfo = resolvePageInfo(pathname);
  return pageInfo?.moduleId;
}

/**
 * Get page ID from current pathname
 * Convenience function that extracts just the page ID
 * 
 * @param pathname - Current route pathname
 * @returns Page ID if found, undefined otherwise
 */
export function getPageIdFromPath(pathname: string): string | undefined {
  const pageInfo = resolvePageInfo(pathname);
  return pageInfo?.pageId;
}
