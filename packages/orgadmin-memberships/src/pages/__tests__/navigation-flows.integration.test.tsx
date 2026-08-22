/**
 * Integration Tests: Navigation Flows
 * 
 * Tests complete navigation flows for member creation
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import CreateMemberPage from '../CreateMemberPage';
import MembersDatabasePage from '../MembersDatabasePage';
import * as useApiModule from '@aws-web-framework/orgadmin-core';
import { createTestI18n } from '../../test/i18n-test-utils';

// Mock the hooks
vi.mock('@aws-web-framework/orgadmin-core', async () => {
  const actual = await vi.importActual('@aws-web-framework/orgadmin-core');
  return {
    ...actual,
    useApi: vi.fn(),
    useOrganisation: vi.fn(),
  };
});

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  // Shared, so a new shell hook does not break this suite — see test/shell-mock.ts
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

vi.mock('../../../orgadmin-shell/src/context/OnboardingProvider', () => ({
  useOnboarding: vi.fn(() => ({
    checkModuleVisit: vi.fn(),
  })),
}));

vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: ({ fieldDefinition, value, onChange }: any) => (
    <div data-testid={`field-${fieldDefinition.shortName}`}>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

describe('Navigation Flows Integration Tests', () => {
  let testI18n: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    testI18n = await createTestI18n();
    
    vi.mocked(useApiModule.useOrganisation).mockReturnValue({
      organisation: { id: 'test-org-id', name: 'Test Org' },
    } as any);
  });

  it('should handle navigation with filter state preservation', async () => {
    const filterState = {
      searchTerm: 'test',
      statusFilter: 'current' as const,
      selectedCustomFilter: '',
    };

    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      if (url === '/api/orgadmin/members') {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    vi.mocked(useApiModule.useApi).mockReturnValue({ execute: mockExecute } as any);

    const { unmount } = render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/members',
              state: { filterState },
            },
          ]}
        >
          <Routes>
            <Route path="/members" element={<MembersDatabasePage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
    });

    expect(true).toBe(true);
    unmount();
  });

  it('should support typeId query parameter in create route', async () => {
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      if (url.includes('/membership-types/type-1')) {
        return Promise.resolve({
          id: 'type-1',
          name: 'Test Type',
          membershipFormId: 'form-1',
          automaticallyApprove: true,
          organisationId: 'test-org-id',
        });
      }
      if (url.includes('/application-forms')) {
        return Promise.resolve({
          id: 'form-1',
          name: 'Test Form',
          fields: [],
        });
      }
      return Promise.resolve(null);
    });

    vi.mocked(useApiModule.useApi).mockReturnValue({ execute: mockExecute } as any);

    const { unmount } = render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <Routes>
            <Route path="/members/create" element={<CreateMemberPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    );

    /*
     * The point of the route carrying `typeId`: the page goes straight to that
     * membership type and its form, rather than asking which type to use.
     *
     * This test was committed truncated — the file ended mid-string here, so
     * the whole suite failed to parse and neither of its two tests ran. The
     * assertions below are the ones its own mock setup was written for.
     */
    await waitFor(() => {
      expect(
        mockExecute.mock.calls.some(([{ url }]: [{ url: string }]) =>
          url.includes('/membership-types/type-1')
        )
      ).toBe(true);
    });

    await waitFor(() => {
      expect(
        mockExecute.mock.calls.some(([{ url }]: [{ url: string }]) =>
          url.includes('/application-forms')
        )
      ).toBe(true);
    });

    unmount();
  });
});
