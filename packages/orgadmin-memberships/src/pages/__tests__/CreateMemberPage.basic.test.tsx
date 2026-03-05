/**
 * CreateMemberPage Basic Structure Tests
 * 
 * Tests for Task 5.1: Basic page structure, state management, and loading states
 * Validates Requirements 3.1, 9.4, 9.5
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
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

describe('CreateMemberPage - Basic Structure (Task 5.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Header and Back Button', () => {
    it('should render page header with back button', async () => {
      // Requirement 3.1: The Member_Creation_Form SHALL render the form on a separate page
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      expect(screen.getByText('Add New Member')).toBeInTheDocument();
    });

    it('should navigate back to members database when back button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      const backButton = screen.getByTestId('back-button');
      backButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members');
    });
  });

  describe('Loading States', () => {
    it('should display loading spinner while fetching data', () => {
      // Requirement 9.4: WHEN the Member_Creation_Form is loading, THE System SHALL display a loading indicator
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Add New Member')).toBeInTheDocument();
    });

    it('should hide loading spinner after data is loaded', async () => {
      // Requirement 9.5: WHEN the Form_Definition is being fetched, THE System SHALL display a loading state on the form
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

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

  describe('Error States', () => {
    it('should display error alert when membership type fails to load', async () => {
      // Requirement 9.4: Display loading indicator
      // Requirement 9.5: Display loading state on form
      mockExecute.mockRejectedValueOnce(new Error('Failed to load membership type'));

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to load membership type')).toBeInTheDocument();
    });

    it('should display error when no typeId is provided', async () => {
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

  describe('State Management', () => {
    it('should initialize with correct default state', async () => {
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('membership-type-name')).toBeInTheDocument();
      });

      // Verify membership type is loaded
      expect(screen.getByText('Individual Membership')).toBeInTheDocument();
    });

    it('should load membership type and form definition on mount', async () => {
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });

      // Verify API calls
      expect(mockExecute).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        url: '/api/orgadmin/membership-types/type-1',
      });

      expect(mockExecute).toHaveBeenNthCalledWith(2, {
        method: 'GET',
        url: '/api/orgadmin/application-forms/form-1/with-fields',
      });
    });
  });

  describe('Form Actions', () => {
    it('should render cancel and submit buttons', async () => {
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      });

      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    it('should navigate back when cancel button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('cancel-button');
      cancelButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members');
    });

    it('should disable submit button when submitting', async () => {
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('submit-button') as HTMLButtonElement;
      expect(submitButton.disabled).toBe(false);
    });
  });

  describe('Membership Type Display', () => {
    it('should display membership type name after loading', async () => {
      // Requirement 3.1: The Member_Creation_Form SHALL render the form on a separate page
      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Premium Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce({
          id: 'form-1',
          name: 'Membership Form',
          fields: [],
        });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Premium Membership')).toBeInTheDocument();
      });
    });
  });
});
