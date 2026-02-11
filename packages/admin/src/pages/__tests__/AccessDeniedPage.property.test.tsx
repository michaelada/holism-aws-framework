import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { AccessDeniedPage } from '../AccessDeniedPage';
import { AuthContext } from '../../context/AuthContext';

// Cleanup after each test to prevent DOM pollution
afterEach(() => {
  cleanup();
});

/**
 * Feature: keycloak-admin-integration, Property 20: Frontend Authorization Feedback
 * 
 * For any authenticated user without admin role accessing the Admin Frontend,
 * the system should display an access denied message.
 * 
 * Validates: Requirements 7.7
 */
describe('Property 20: Frontend Authorization Feedback', () => {
  it('should display access denied message for non-admin users', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // userName
        fc.string({ minLength: 1, maxLength: 100 }), // token
        (userName, token) => {
          const mockLogout = vi.fn();
          const mockAuthValue = {
            keycloak: {} as any,
            authenticated: true, // Authenticated
            loading: false,
            token,
            userName,
            isAdmin: false, // Not admin
            login: vi.fn(),
            logout: mockLogout,
            getToken: vi.fn(() => token),
          };

          const { unmount, container } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <AccessDeniedPage />
            </AuthContext.Provider>
          );

          // Property: Access denied message should be displayed
          const accessDeniedElements = screen.queryAllByText(/access denied/i);
          expect(accessDeniedElements.length).toBeGreaterThan(0);

          // Property: User should see explanation message
          const permissionElements = screen.queryAllByText(/you do not have permission/i);
          expect(permissionElements.length).toBeGreaterThan(0);

          // Property: Username should be displayed (if not just whitespace)
          if (userName && userName.trim().length > 0) {
            // Check that the username appears somewhere in the document
            const trimmedUserName = userName.trim();
            const bodyText = document.body.textContent || '';
            expect(bodyText).toContain(trimmedUserName);
          }

          // Property: Logout button should be available
          const logoutButtons = screen.queryAllByRole('button', { name: /logout/i });
          expect(logoutButtons.length).toBeGreaterThan(0);

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display access denied for all non-admin authenticated users', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }), // userName (can be null)
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }), // token (can be null)
        (userName, token) => {
          const mockLogout = vi.fn();
          const mockAuthValue = {
            keycloak: {} as any,
            authenticated: true,
            loading: false,
            token,
            userName,
            isAdmin: false, // Not admin
            login: vi.fn(),
            logout: mockLogout,
            getToken: vi.fn(() => token),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <AccessDeniedPage />
            </AuthContext.Provider>
          );

          // Property: Access denied should always be shown for non-admin users
          const accessDeniedElements = screen.queryAllByText(/access denied/i);
          expect(accessDeniedElements.length).toBeGreaterThan(0);

          // Property: Logout button should always be available
          const logoutButtons = screen.queryAllByRole('button', { name: /logout/i });
          expect(logoutButtons.length).toBeGreaterThan(0);

          // Property: Username should be displayed if available (and not just whitespace)
          if (userName && userName.trim().length > 0) {
            // Check that the username appears somewhere in the document
            const trimmedUserName = userName.trim();
            const bodyText = document.body.textContent || '';
            expect(bodyText).toContain(trimmedUserName);
          }

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide logout functionality for denied users', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // userName
        (userName) => {
          const mockLogout = vi.fn();
          const mockAuthValue = {
            keycloak: {} as any,
            authenticated: true,
            loading: false,
            token: 'test-token',
            userName,
            isAdmin: false,
            login: vi.fn(),
            logout: mockLogout,
            getToken: vi.fn(() => 'test-token'),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <AccessDeniedPage />
            </AuthContext.Provider>
          );

          // Property: Logout button should be clickable
          const logoutButtons = screen.queryAllByRole('button', { name: /logout/i });
          expect(logoutButtons.length).toBeGreaterThan(0);
          const logoutButton = logoutButtons[0];
          expect(logoutButton).not.toBeDisabled();

          // Click the logout button
          logoutButton.click();

          // Property: Logout function should be called
          expect(mockLogout).toHaveBeenCalledTimes(1);

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display consistent access denied UI for all non-admin users', () => {
    fc.assert(
      fc.property(
        fc.record({
          userName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
          token: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
          authenticated: fc.constant(true),
          isAdmin: fc.constant(false),
        }),
        (authState) => {
          const mockAuthValue = {
            keycloak: {} as any,
            authenticated: authState.authenticated,
            loading: false,
            token: authState.token,
            userName: authState.userName,
            isAdmin: authState.isAdmin,
            login: vi.fn(),
            logout: vi.fn(),
            getToken: vi.fn(() => authState.token),
          };

          const { unmount } = render(
            <AuthContext.Provider value={mockAuthValue}>
              <AccessDeniedPage />
            </AuthContext.Provider>
          );

          // Property: All required UI elements should be present
          expect(screen.queryAllByText(/access denied/i).length).toBeGreaterThan(0);
          expect(screen.queryAllByText(/you do not have permission/i).length).toBeGreaterThan(0);
          expect(screen.queryAllByText(/administrator privileges/i).length).toBeGreaterThan(0);
          expect(screen.queryAllByRole('button', { name: /logout/i }).length).toBeGreaterThan(0);

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
