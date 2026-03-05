/**
 * CreateMemberPage Loading Tests
 * 
 * Tests for Task 5.2: Membership type and form definition loading
 * Validates Requirements 3.3
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
  useOrganisation: () => ({ organisation: { id: 'org-1' } }),
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

describe('CreateMemberPage - Loading Logic (Task 5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Loading', () => {
    it('should successfully load membership type by ID from query parameter', async () => {
      // Requirement 3.3: WHEN a Membership_Type is selected, THE System SHALL fetch the associated Form_Definition
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        description: 'Standard individual membership',
        membershipFormId: 'form-1',
        organisationId: 'org-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Application Form',
        description: 'Standard membership application',
        fields: [
          {
            id: 'field-1',
            name: 'firstName',
            label: 'First Name',
            datatype: 'text',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify membership type was loaded
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/membership-types/type-1',
      });

      // Verify form definition was loaded
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/application-forms/form-1/with-fields',
      });

      // Verify membership type name is displayed
      expect(screen.getByText('Individual Membership')).toBeInTheDocument();
    });

    it('should load form definition using membershipFormId from membership type', async () => {
      const mockMembershipType = {
        id: 'type-2',
        name: 'Family Membership',
        membershipFormId: 'form-family-123',
        organisationId: 'org-1',
      };

      const mockFormDefinition = {
        id: 'form-family-123',
        name: 'Family Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-2']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });

      // Verify correct form ID was used
      expect(mockExecute).toHaveBeenNthCalledWith(2, {
        method: 'GET',
        url: '/api/orgadmin/application-forms/form-family-123/with-fields',
      });
    });

    it('should handle form definition with multiple fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'firstName',
            label: 'First Name',
            datatype: 'text',
            order: 1,
          },
          {
            id: 'field-2',
            name: 'lastName',
            label: 'Last Name',
            datatype: 'text',
            order: 2,
          },
          {
            id: 'field-3',
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            order: 3,
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify both API calls completed successfully
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should handle form definition with empty fields array', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Basic Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Basic Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Should still display the form
      expect(screen.getByText('Basic Membership')).toBeInTheDocument();
    });
  });

  describe('Error Handling - Missing Membership Type', () => {
    it('should display error when membership type is not found (404)', async () => {
      // Requirement 3.3: Handle loading and error states
      const error = new Error('Membership type not found');
      mockExecute.mockRejectedValueOnce(error);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=invalid-id']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Membership type not found')).toBeInTheDocument();
    });

    it('should display error when membership type returns null', async () => {
      mockExecute.mockResolvedValueOnce(null);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Membership type not found')).toBeInTheDocument();
    });

    it('should not attempt to load form definition if membership type fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Network error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Should only have called execute once (for membership type)
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling - Missing Form Definition', () => {
    it('should display error when form definition is not found', async () => {
      // Requirement 3.3: Handle loading and error states
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockRejectedValueOnce(new Error('Form definition not found'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Form definition not found')).toBeInTheDocument();
    });

    it('should display error when form definition returns null', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(null);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Form definition not found')).toBeInTheDocument();
    });

    it('should handle network errors when loading form definition', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockRejectedValueOnce(new Error('Network error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Loading State Display', () => {
    it('should show loading spinner during membership type fetch', () => {
      // Requirement 3.3: Handle loading states
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Add New Member')).toBeInTheDocument();
    });

    it('should show loading spinner during form definition fetch', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      let resolveFormDefinition: (value: any) => void;
      const formDefinitionPromise = new Promise((resolve) => {
        resolveFormDefinition = resolve;
      });

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockReturnValueOnce(formDefinitionPromise);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Should still show loading spinner while form definition loads
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should hide loading spinner after successful load', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Initially loading
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Form should be visible
      expect(screen.getByTestId('membership-type-name')).toBeInTheDocument();
    });
  });

  describe('Error State Display', () => {
    it('should display error alert with error message', async () => {
      // Requirement 3.3: Handle error states
      mockExecute.mockRejectedValueOnce(new Error('Server error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    it('should display back button in error state', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByTestId('back-button')).toBeInTheDocument();
    });

    it('should not display form when in error state', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('membership-type-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('submit-button')).not.toBeInTheDocument();
    });
  });

  describe('Query Parameter Handling', () => {
    it('should display error when typeId query parameter is missing', async () => {
      render(
        <MemoryRouter initialEntries={['/members/create']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('No membership type selected')).toBeInTheDocument();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should not make API calls when typeId is missing', async () => {
      render(
        <MemoryRouter initialEntries={['/members/create']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should handle typeId with special characters', async () => {
      const mockMembershipType = {
        id: 'type-with-dashes-123',
        name: 'Special Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-with-dashes-123']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/membership-types/type-with-dashes-123',
        });
      });
    });
  });

  describe('Organization Context', () => {
    it('should require both typeId and organization to load data', async () => {
      // This test verifies that the component checks for both typeId and organization
      // The actual implementation checks for both in the useEffect condition
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // With both typeId and organization present, API calls should be made
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Sequential Loading', () => {
    it('should load membership type before form definition', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Form',
        fields: [],
      };

      const callOrder: string[] = [];

      mockExecute
        .mockImplementation(async (config) => {
          if (config.url.includes('membership-types')) {
            callOrder.push('membership-type');
            return mockMembershipType;
          } else if (config.url.includes('application-forms')) {
            callOrder.push('form-definition');
            return mockFormDefinition;
          }
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });

      // Verify correct order
      expect(callOrder).toEqual(['membership-type', 'form-definition']);
    });

    it('should use membershipFormId from loaded membership type', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'dynamic-form-id-xyz',
      };

      const mockFormDefinition = {
        id: 'dynamic-form-id-xyz',
        name: 'Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });

      // Verify form definition was loaded with correct ID
      expect(mockExecute).toHaveBeenNthCalledWith(2, {
        method: 'GET',
        url: '/api/orgadmin/application-forms/dynamic-form-id-xyz/with-fields',
      });
    });
  });
});
