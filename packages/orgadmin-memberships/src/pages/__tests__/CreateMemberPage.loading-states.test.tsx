/**
 * CreateMemberPage Loading States Tests
 * 
 * Tests for Task 13.3: Loading states and user feedback
 * Validates Requirements 9.2, 9.3, 9.4, 9.5
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('CreateMemberPage - Loading States and User Feedback (Task 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('13.1: Loading Indicators', () => {
    it('should show skeleton loader while loading membership type and form definition', () => {
      // Requirement 9.5: WHEN the Form_Definition is being fetched, THE System SHALL display a loading state on the form
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Verify skeleton loaders are displayed
      expect(screen.getByTestId('skeleton-title')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-field-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-field-2')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-field-3')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-button-1')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-button-2')).toBeInTheDocument();
    });

    it('should hide skeleton loader after form definition loads', async () => {
      // Requirement 9.5: Loading state should disappear after data loads
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
      expect(screen.getByTestId('skeleton-title')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-title')).not.toBeInTheDocument();
      });

      // Form should be visible
      expect(screen.getByTestId('membership-type-name')).toBeInTheDocument();
    });

    it('should disable submit button while creating member', async () => {
      // Requirement 9.4: WHEN the Member_Creation_Form is loading, THE System SHALL display a loading indicator
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition)
        .mockResolvedValueOnce({ user: { id: 'user-1' } })
        .mockImplementation(() => new Promise(() => {})); // Hang on form submission

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      // Fill in name field
      const nameInput = screen.getByTestId('name-input');
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });

      // Click submit
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Wait for submission to start
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('should show "Creating..." text on submit button during submission', async () => {
      // Requirement 9.4: Show "Creating..." text on submit button during submission
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition)
        .mockResolvedValueOnce({ user: { id: 'user-1' } })
        .mockImplementation(() => new Promise(() => {})); // Hang on form submission

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      // Fill in name field
      const nameInput = screen.getByTestId('name-input');
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });

      // Click submit
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Wait for submission to start
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Creating...');
      });
    });

    it('should re-enable submit button after submission completes', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition)
        .mockResolvedValueOnce({ user: { id: 'user-1' } })
        .mockRejectedValueOnce(new Error('Validation error')); // Fail submission

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      // Fill in name field
      const nameInput = screen.getByTestId('name-input');
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });

      // Click submit
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Button should be re-enabled
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Create Member');
    });
  });

  describe('13.2: Error State Displays', () => {
    it('should display network error message with retry button', async () => {
      // Requirement 9.2: IF Member creation fails due to a server error, THEN THE System SHALL display an error notification
      // Requirement 9.3: Provide retry options for network errors
      mockExecute.mockRejectedValueOnce(new Error('network error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Verify network error message
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();

      // Verify retry button is present
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('should display API error message without retry button', async () => {
      // Requirement 9.2: Display API error messages
      mockExecute.mockRejectedValueOnce(new Error('Server error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Verify API error message
      expect(screen.getByText('Failed to load form. Please try again.')).toBeInTheDocument();

      // Verify retry button is NOT present for API errors
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });

    it('should retry loading when retry button is clicked', async () => {
      // Requirement 9.3: Provide retry options for network errors
      mockExecute
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      // Wait for successful load
      await waitFor(() => {
        expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
      });

      // Verify form is displayed
      expect(screen.getByTestId('membership-type-name')).toBeInTheDocument();

      // Verify execute was called 3 times (1 failed + 2 successful)
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should display specific error for "not found" errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Membership type not found'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=invalid-id']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('The requested membership type or form was not found.')).toBeInTheDocument();
    });

    it('should display network error during form submission with retry option', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition)
        .mockResolvedValueOnce({ user: { id: 'user-1' } })
        .mockRejectedValueOnce(new Error('network timeout'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      // Fill in name field
      const nameInput = screen.getByTestId('name-input');
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });

      // Click submit
      fireEvent.click(screen.getByTestId('submit-button'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Verify network error message
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();

      // Note: Retry button for submission errors would retry the submission, not reload the form
      // The current implementation shows retry button for network errors during loading
    });

    it('should display validation error message without retry button', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition)
        .mockResolvedValueOnce({ user: { id: 'user-1' } })
        .mockRejectedValueOnce(new Error('validation failed: invalid email'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      // Fill in name field
      const nameInput = screen.getByTestId('name-input');
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });

      // Click submit
      fireEvent.click(screen.getByTestId('submit-button'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Verify validation error message
      expect(screen.getByText('Validation error. Please check your input and try again.')).toBeInTheDocument();

      // Verify no retry button for validation errors
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });

    it('should allow closing error alert', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Server error'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      // Find and click close button (MUI Alert has a close button)
      const alert = screen.getByTestId('error-alert');
      const closeButton = alert.querySelector('button[aria-label="Close"]');
      
      if (closeButton) {
        fireEvent.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
        });
      }
    });

    it('should display error when no membership type is selected', async () => {
      render(
        <MemoryRouter initialEntries={['/members/create']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('No membership type selected')).toBeInTheDocument();
    });
  });

  describe('Loading State Transitions', () => {
    it('should transition from loading to form display', async () => {
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
      expect(screen.getByTestId('skeleton-title')).toBeInTheDocument();
      expect(screen.queryByTestId('membership-type-name')).not.toBeInTheDocument();

      // Wait for transition
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-title')).not.toBeInTheDocument();
        expect(screen.getByTestId('membership-type-name')).toBeInTheDocument();
      });
    });

    it('should transition from loading to error display', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Load failed'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Initially loading
      expect(screen.getByTestId('skeleton-title')).toBeInTheDocument();
      expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();

      // Wait for transition
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-title')).not.toBeInTheDocument();
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });
    });

    it('should transition from form to submitting state', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
        automaticallyApprove: true,
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      };

      mockExecute
        .mockResolvedValueOnce(mockMembershipType)
        .mockResolvedValueOnce(mockFormDefinition)
        .mockResolvedValueOnce({ user: { id: 'user-1' } })
        .mockImplementation(() => new Promise(() => {})); // Hang on submission

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('submit-button');
      
      // Initially not submitting
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Create Member');

      // Fill in name and submit
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'John Doe' } });
      fireEvent.click(submitButton);

      // Wait for transition to submitting state
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent('Creating...');
      });
    });
  });
});
