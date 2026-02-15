/**
 * Unit tests for BrandingTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import BrandingTab from '../BrandingTab';
import * as useApiModule from '../../../hooks/useApi';

// Initialize i18n for testing
i18n.init({
  lng: 'en-GB',
  fallbackLng: 'en-GB',
  resources: {
    'en-GB': {
      translation: {
        settings: {
          branding: {
            title: 'Branding',
            subtitle: 'Customise your organisation\'s visual identity',
            sections: {
              logo: 'Logo',
              themeColours: 'Theme Colours',
              preview: 'Preview',
            },
            fields: {
              uploadLogo: 'Upload Logo',
              removeLogo: 'Remove',
              primaryColour: 'Primary Colour',
              secondaryColour: 'Secondary Colour',
              accentColour: 'Accent Colour',
              backgroundColour: 'Background Colour',
              textColour: 'Text Colour',
              resetColours: 'Reset to Default Colours',
            },
            preview: {
              organisationName: 'Organisation Name',
              primaryButton: 'Primary Button',
              secondaryButton: 'Secondary Button',
              accentButton: 'Accent Button',
            },
            validation: {
              invalidFileType: 'Please select an image file',
              fileTooLarge: 'Image size must be less than 2MB',
            },
            messages: {
              loadFailed: 'Failed to load branding settings',
              saveFailed: 'Failed to save branding settings',
              saveSuccess: 'Branding settings saved successfully',
              uploadFailed: 'Failed to upload logo',
            },
          },
          actions: {
            saveChanges: 'Save Changes',
            saving: 'Saving...',
          },
        },
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('BrandingTab', () => {
  const mockExecute = vi.fn();
  const mockBrandingSettings = {
    logoUrl: 'https://example.com/logo.png',
    primaryColor: '#1976d2',
    secondaryColor: '#dc004e',
    accentColor: '#ff9800',
    backgroundColor: '#ffffff',
    textColor: '#000000',
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

  it('should load branding settings on mount', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisation/branding-settings',
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

    renderWithI18n(<BrandingTab />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display branding settings after loading', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('#dc004e')).toBeInTheDocument();
    expect(screen.getByDisplayValue('#ff9800')).toBeInTheDocument();
  });

  it('should update color field when changed', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
    });

    const primaryColorInput = screen.getByLabelText(/primary colour/i);
    fireEvent.change(primaryColorInput, { target: { value: '#ff0000' } });

    expect(primaryColorInput).toHaveValue('#ff0000');
  });

  it('should save branding settings when save button clicked', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockResolvedValueOnce({ success: true });

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/api/orgadmin/organisation/branding-settings',
        data: expect.objectContaining({
          primaryColor: '#1976d2',
          secondaryColor: '#dc004e',
        }),
      });
    });
  });

  it('should display success message after successful save', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockResolvedValueOnce({ success: true });

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Branding settings saved successfully')).toBeInTheDocument();
    });
  });

  it('should display error message on save failure', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockRejectedValueOnce({ message: 'Failed to save' });

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeInTheDocument();
    });
  });

  it('should reset colors to default when reset button clicked', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /reset to default colours/i });
    fireEvent.click(resetButton);

    // After reset, colors should be back to defaults
    expect(screen.getByDisplayValue('#1976d2')).toBeInTheDocument();
  });

  it('should render upload logo button', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText(/upload logo/i)).toBeInTheDocument();
    });
  });

  it('should render remove logo button when logo exists', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText(/remove/i)).toBeInTheDocument();
    });
  });

  it('should render preview section', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    renderWithI18n(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText(/preview/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Primary Button')).toBeInTheDocument();
    expect(screen.getByText('Secondary Button')).toBeInTheDocument();
    expect(screen.getByText('Accent Button')).toBeInTheDocument();
  });
});
