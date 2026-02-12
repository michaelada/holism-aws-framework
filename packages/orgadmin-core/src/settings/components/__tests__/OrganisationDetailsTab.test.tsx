/**
 * Unit tests for OrganisationDetailsTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrganisationDetailsTab from '../OrganisationDetailsTab';
import * as useApiModule from '../../../hooks/useApi';

describe('OrganisationDetailsTab', () => {
  const mockExecute = vi.fn();
  const mockOrganisationData = {
    id: 'org-1',
    name: 'test-org',
    displayName: 'Test Organisation',
    domain: 'test.com',
    currency: 'GBP',
    language: 'en-GB',
    settings: {
      address: '123 Test St',
      city: 'London',
      postcode: 'SW1A 1AA',
      country: 'United Kingdom',
      phone: '+44 20 1234 5678',
      email: 'contact@test.com',
      website: 'https://test.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({
      data: null,
      error: null,
      loading: false,
      execute: mockExecute,
      reset: vi.fn(),
    });
  });

  it('should load organisation details on mount', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisation',
      });
    });
  });

  it('should display loading state', () => {
    vi.spyOn(useApiModule, 'useApi').mockReturnValue({
      data: null,
      error: null,
      loading: true,
      execute: mockExecute,
      reset: vi.fn(),
    });

    render(<OrganisationDetailsTab />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display organisation details after loading', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Test St')).toBeInTheDocument();
    expect(screen.getByDisplayValue('London')).toBeInTheDocument();
  });

  it('should display error message on load failure', async () => {
    mockExecute.mockRejectedValueOnce({
      message: 'Failed to load organisation details',
    });

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load organisation details')).toBeInTheDocument();
    });
  });

  it('should validate required display name field', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    expect(displayNameInput).toHaveAttribute('required');
  });

  it('should update form field when changed', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: 'Updated Organisation' } });

    expect(displayNameInput).toHaveValue('Updated Organisation');
  });

  it('should save organisation details when save button clicked', async () => {
    mockExecute
      .mockResolvedValueOnce(mockOrganisationData)
      .mockResolvedValueOnce({ success: true });

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/api/orgadmin/organisation/org-1',
        data: expect.objectContaining({
          displayName: 'Test Organisation',
          domain: 'test.com',
          currency: 'GBP',
          language: 'en-GB',
        }),
      });
    });
  });

  it('should display success message after successful save', async () => {
    mockExecute
      .mockResolvedValueOnce(mockOrganisationData)
      .mockResolvedValueOnce({ success: true });

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Organisation details saved successfully')).toBeInTheDocument();
    });
  });

  it('should display error message on save failure', async () => {
    mockExecute
      .mockResolvedValueOnce(mockOrganisationData)
      .mockRejectedValueOnce({ message: 'Failed to save' });

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeInTheDocument();
    });
  });

  it('should disable organisation name field', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('test-org')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/organisation name/i);
    expect(nameInput).toBeDisabled();
  });

  it('should update nested settings fields', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('London')).toBeInTheDocument();
    });

    const cityInput = screen.getByLabelText(/city/i);
    fireEvent.change(cityInput, { target: { value: 'Manchester' } });

    expect(cityInput).toHaveValue('Manchester');
  });

  it('should render currency dropdown with options', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const currencySelect = screen.getByLabelText(/currency/i);
    expect(currencySelect).toBeInTheDocument();
  });

  it('should render language dropdown with options', async () => {
    mockExecute.mockResolvedValueOnce(mockOrganisationData);

    render(<OrganisationDetailsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Organisation')).toBeInTheDocument();
    });

    const languageSelect = screen.getByLabelText(/language/i);
    expect(languageSelect).toBeInTheDocument();
  });
});
