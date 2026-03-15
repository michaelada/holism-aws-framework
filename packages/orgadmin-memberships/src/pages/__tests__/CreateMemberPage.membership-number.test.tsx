/**
 * CreateMemberPage Membership Number Field Tests
 * 
 * Tests for Tasks 10.1-10.4: Membership numbering configuration
 * Validates Requirements 5.1, 5.2
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CreateMemberPage from '../CreateMemberPage';

// Mock dependencies
const mockExecute = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ 
    organisation: { 
      id: 'org-1',
      organizationTypeId: 'org-type-1'
    } 
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

describe('CreateMemberPage - Membership Number Field (Tasks 10.1-10.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task 10.1: Fetch organization type configuration', () => {
    it('should fetch organization type configuration on load', async () => {
      const membershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const formDefinition = {
        id: 'form-1',
        name: 'Application Form',
        fields: [],
      };

      const organizationType = {
        id: 'org-type-1',
        name: 'sports-club',
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization',
        initialMembershipNumber: 1000000,
      };

      mockExecute.mockImplementation(({ url }) => {
        if (url.includes('/membership-types/')) {
          return Promise.resolve(membershipType);
        }
        if (url.includes('/application-forms/')) {
          return Promise.resolve(formDefinition);
        }
        if (url.includes('/organization-types/')) {
          return Promise.resolve(organizationType);
        }
        return Promise.resolve(null);
      });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/organization-types/org-type-1',
          })
        );
      });
    });
  });

  describe('Task 10.2: Add conditional Membership Number field', () => {
    it('should NOT show membership number field when organization type uses internal mode', async () => {
      const membershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const formDefinition = {
        id: 'form-1',
        name: 'Application Form',
        fields: [],
      };

      const organizationType = {
        id: 'org-type-1',
        name: 'sports-club',
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization',
        initialMembershipNumber: 1000000,
      };

      mockExecute.mockImplementation(({ url }) => {
        if (url.includes('/membership-types/')) {
          return Promise.resolve(membershipType);
        }
        if (url.includes('/application-forms/')) {
          return Promise.resolve(formDefinition);
        }
        if (url.includes('/organization-types/')) {
          return Promise.resolve(organizationType);
        }
        return Promise.resolve(null);
      });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      // Membership number field should NOT be present
      expect(screen.queryByTestId('membership-number-field')).not.toBeInTheDocument();
    });

    it('should show membership number field when organization type uses external mode', async () => {
      const membershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const formDefinition = {
        id: 'form-1',
        name: 'Application Form',
        fields: [],
      };

      const organizationType = {
        id: 'org-type-1',
        name: 'sports-club',
        membershipNumbering: 'external',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 1000000,
      };

      mockExecute.mockImplementation(({ url }) => {
        if (url.includes('/membership-types/')) {
          return Promise.resolve(membershipType);
        }
        if (url.includes('/application-forms/')) {
          return Promise.resolve(formDefinition);
        }
        if (url.includes('/organization-types/')) {
          return Promise.resolve(organizationType);
        }
        return Promise.resolve(null);
      });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      // Membership number field SHOULD be present
      expect(screen.getByTestId('membership-number-field')).toBeInTheDocument();
    });
  });
});
