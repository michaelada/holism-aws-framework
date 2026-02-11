import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthContext } from '../../context/AuthContext';

// Cleanup after each test to prevent DOM pollution
afterEach(() => {
  cleanup();
});

/**
 * Feature: keycloak-admin-integration, Property 19: Frontend Authentication Redirect
 * 
 * For any unauthenticated access to the Admin Frontend, the system should redirect
 * to Keycloak login.
 * 
 * Validates: Requirements 7.6
 */
describe('Property 19: Frontend Authentication Redirect', () => {
  it('should show redirecting message for unauthenticated users', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // loading state
        fc.boolean(), // isAdmin state
        fc.string({ minLength: 1, maxLength: 50 }), // userName
        (loading, isAdmin, userName) => {
          // Skip if loading is true (different behavior)
          if (loading) return true;

          const mockAuthValue = {
            keycloak: null,
            authenticated: false, // Not authenticated
            loading: false,
            token: null,
            userName,
            isAdmin,
            login: vi.fn(),
            logout: vi.fn(),
            getToken: vi.fn(() => null),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <ProtectedRoute>
                <div data-testid="protected-content">Protected Content</div>
              </ProtectedRoute>
            </AuthContext.Provider>
          );

          // Property: Unauthenticated users should see redirecting message
          expect(screen.getByText(/redirecting to login/i)).toBeInTheDocument();

          // Property: Protected content should NOT be rendered
          expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show loading state while authentication is being checked', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // authenticated state
        fc.boolean(), // isAdmin state
        fc.string({ minLength: 1, maxLength: 50 }), // userName
        (authenticated, isAdmin, userName) => {
          const mockAuthValue = {
            keycloak: null,
            authenticated,
            loading: true, // Loading
            token: null,
            userName,
            isAdmin,
            login: vi.fn(),
            logout: vi.fn(),
            getToken: vi.fn(() => null),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <ProtectedRoute>
                <div data-testid="protected-content">Protected Content</div>
              </ProtectedRoute>
            </AuthContext.Provider>
          );

          // Property: Loading state should show loading indicator
          expect(screen.getByText(/loading/i)).toBeInTheDocument();

          // Property: Protected content should NOT be rendered during loading
          expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render protected content only for authenticated admin users', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // userName
        fc.string({ minLength: 1, maxLength: 100 }), // token
        (userName, token) => {
          const mockAuthValue = {
            keycloak: {} as any,
            authenticated: true, // Authenticated
            loading: false,
            token,
            userName,
            isAdmin: true, // Is admin
            login: vi.fn(),
            logout: vi.fn(),
            getToken: vi.fn(() => token),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <ProtectedRoute>
                <div data-testid="protected-content">Protected Content</div>
              </ProtectedRoute>
            </AuthContext.Provider>
          );

          // Property: Authenticated admin users should see protected content
          expect(screen.getByTestId('protected-content')).toBeInTheDocument();

          // Property: No redirecting or loading messages should be shown
          expect(screen.queryByText(/redirecting to login/i)).not.toBeInTheDocument();
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle all authentication state combinations correctly', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // authenticated
        fc.boolean(), // loading
        fc.boolean(), // isAdmin
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }), // userName
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }), // token
        (authenticated, loading, isAdmin, userName, token) => {
          const mockAuthValue = {
            keycloak: authenticated ? ({} as any) : null,
            authenticated,
            loading,
            token,
            userName,
            isAdmin,
            login: vi.fn(),
            logout: vi.fn(),
            getToken: vi.fn(() => token),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <ProtectedRoute>
                <div data-testid="protected-content">Protected Content</div>
              </ProtectedRoute>
            </AuthContext.Provider>
          );

          // Property: Content visibility depends on authentication state
          const contentVisible = screen.queryByTestId('protected-content') !== null;
          const shouldShowContent = authenticated && !loading && isAdmin;

          expect(contentVisible).toBe(shouldShowContent);

          // Property: Loading state takes precedence
          if (loading) {
            expect(screen.getByText(/loading/i)).toBeInTheDocument();
          }

          // Property: Unauthenticated users see redirect message (when not loading)
          if (!authenticated && !loading) {
            expect(screen.getByText(/redirecting to login/i)).toBeInTheDocument();
          }

          // Property: Authenticated non-admin users see access denied (when not loading)
          if (authenticated && !isAdmin && !loading) {
            expect(screen.getByText(/access denied/i)).toBeInTheDocument();
          }

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
