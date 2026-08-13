/**
 * Unit tests for BrandingTab component
 *
 * Each colour is edited through two controls — a native colour swatch and a
 * text field — so queries here target one or the other explicitly rather than
 * by display value, which matches both.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
// BrandingTab reads the current organisation (the logo upload posts its id), so
// it needs the provider the rest of the package's tests already use.
import { renderWithProviders as render } from '../../../test/renderWithProviders';
import BrandingTab from '../BrandingTab';
import * as useApiModule from '../../../hooks/useApi';
import { resolveTranslation } from '../../../test/i18nTestUtils';

// The component uses react-i18next directly; resolve against the real en-GB
// bundle so the assertions describe what a user actually sees.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

const label = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);

const colourTextField = (key: string) =>
  screen.getByRole('textbox', { name: label(`settings.branding.fields.${key}`) });

const colourSwatch = (key: string) =>
  screen.getByLabelText(
    label('settings.branding.fields.colourPicker', {
      colour: label(`settings.branding.fields.${key}`),
    })
  );

describe('BrandingTab', () => {
  const mockExecute = vi.fn();

  /** Matches the backend's BrandingSettings contract. */
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
    } as any);
  });

  it('should load branding settings on mount', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisation/branding-settings',
      });
    });
  });

  it('should display loading state', () => {
    mockExecute.mockReturnValue(new Promise(() => {}));

    render(<BrandingTab />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display branding settings after loading', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toHaveValue('#1976d2');
    });

    expect(colourTextField('secondaryColour')).toHaveValue('#dc004e');
    expect(colourTextField('accentColour')).toHaveValue('#ff9800');
    expect(colourTextField('backgroundColour')).toHaveValue('#ffffff');
    expect(colourTextField('textColour')).toHaveValue('#000000');
  });

  it('should fall back to the default palette when the API returns nothing', async () => {
    mockExecute.mockResolvedValueOnce(null);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toHaveValue('#1976d2');
    });
  });

  it('should give each colour swatch an accessible name', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourSwatch('primaryColour')).toBeInTheDocument();
    });

    for (const key of [
      'secondaryColour',
      'accentColour',
      'backgroundColour',
      'textColour',
    ]) {
      expect(colourSwatch(key)).toBeInTheDocument();
    }
  });

  it('should update the colour when the text field changes', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toBeInTheDocument();
    });

    fireEvent.change(colourTextField('primaryColour'), { target: { value: '#ff0000' } });

    expect(colourTextField('primaryColour')).toHaveValue('#ff0000');
    // Both controls are bound to the same value
    expect(colourSwatch('primaryColour')).toHaveValue('#ff0000');
  });

  it('should update the colour when the swatch changes', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourSwatch('accentColour')).toBeInTheDocument();
    });

    fireEvent.change(colourSwatch('accentColour'), { target: { value: '#00ff00' } });

    expect(colourTextField('accentColour')).toHaveValue('#00ff00');
  });

  it('should save branding settings when save button clicked', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockResolvedValueOnce({ success: true });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: label('settings.actions.saveChanges') })
    );

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/api/orgadmin/organisation/branding-settings',
        data: expect.objectContaining({
          primaryColor: '#1976d2',
          secondaryColor: '#dc004e',
          accentColor: '#ff9800',
          backgroundColor: '#ffffff',
          textColor: '#000000',
          logoUrl: 'https://example.com/logo.png',
        }),
      });
    });
  });

  it('should display success message after successful save', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockResolvedValueOnce({ success: true });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: label('settings.actions.saveChanges') })
    );

    await waitFor(() => {
      expect(
        screen.getByText(label('settings.branding.messages.saveSuccess'))
      ).toBeInTheDocument();
    });
  });

  it('should display error message on save failure', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockRejectedValueOnce({ message: 'Failed to save' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: label('settings.actions.saveChanges') })
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeInTheDocument();
    });
  });

  it('should reset colours to the defaults when reset is clicked', async () => {
    mockExecute.mockResolvedValueOnce({ ...mockBrandingSettings, primaryColor: '#123456' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(colourTextField('primaryColour')).toHaveValue('#123456');
    });

    fireEvent.click(
      screen.getByRole('button', { name: label('settings.branding.fields.resetColours') })
    );

    expect(colourTextField('primaryColour')).toHaveValue('#1976d2');
  });

  it('should render the upload logo control', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText(label('settings.branding.fields.uploadLogo'))).toBeInTheDocument();
    });
  });

  it('should render the remove logo control when a logo exists', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText(label('settings.branding.fields.removeLogo'))).toBeInTheDocument();
    });
  });

  it('should render the preview section', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText(label('settings.branding.sections.preview'))).toBeInTheDocument();
    });

    expect(screen.getByText(label('settings.branding.preview.primaryButton'))).toBeInTheDocument();
    expect(
      screen.getByText(label('settings.branding.preview.secondaryButton'))
    ).toBeInTheDocument();
    expect(screen.getByText(label('settings.branding.preview.accentButton'))).toBeInTheDocument();
  });
});
