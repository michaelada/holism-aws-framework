/**
 * Unit tests for BrandingTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BrandingTab from '../BrandingTab';
import * as useApiModule from '../../../hooks/useApi';

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

    render(<BrandingTab />);

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

    render(<BrandingTab />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display branding settings after loading', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      const primaryColorInputs = screen.getAllByDisplayValue('#1976d2');
      expect(primaryColorInputs.length).toBeGreaterThan(0);
    });

    expect(screen.getAllByDisplayValue('#dc004e').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('#ff9800').length).toBeGreaterThan(0);
  });

  it('should display logo when logoUrl is set', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      const logo = screen.getByAltText('Organisation Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
    });
  });

  it('should show upload icon when no logo is set', async () => {
    mockExecute.mockResolvedValueOnce({ ...mockBrandingSettings, logoUrl: '' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload logo/i })).toBeInTheDocument();
    });
  });

  it('should handle logo upload', async () => {
    mockExecute
      .mockResolvedValueOnce({ ...mockBrandingSettings, logoUrl: '' })
      .mockResolvedValueOnce({ url: 'https://example.com/new-logo.png' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload logo/i })).toBeInTheDocument();
    });

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (input) {
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/files/upload',
          })
        );
      });
    }
  });

  it('should validate file type on upload', async () => {
    mockExecute.mockResolvedValueOnce({ ...mockBrandingSettings, logoUrl: '' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload logo/i })).toBeInTheDocument();
    });

    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (input) {
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('Please select an image file')).toBeInTheDocument();
      });
    }
  });

  it('should validate file size on upload', async () => {
    mockExecute.mockResolvedValueOnce({ ...mockBrandingSettings, logoUrl: '' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload logo/i })).toBeInTheDocument();
    });

    // Create a file larger than 2MB
    const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (input) {
      Object.defineProperty(input, 'files', {
        value: [largeFile],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('Image size must be less than 2MB')).toBeInTheDocument();
      });
    }
  });

  it('should remove logo when remove button clicked', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByAltText('Organisation Logo')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByAltText('Organisation Logo')).not.toBeInTheDocument();
    });
  });

  it('should update color fields', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      const primaryColorInputs = screen.getAllByDisplayValue('#1976d2');
      expect(primaryColorInputs.length).toBeGreaterThan(0);
    });

    const primaryColorInput = screen.getByLabelText(/primary colour/i);
    fireEvent.change(primaryColorInput, { target: { value: '#ff0000' } });

    expect(primaryColorInput).toHaveValue('#ff0000');
  });

  it('should reset colors to default', async () => {
    mockExecute.mockResolvedValueOnce({
      ...mockBrandingSettings,
      primaryColor: '#ff0000',
    });

    render(<BrandingTab />);

    await waitFor(() => {
      const redColorInputs = screen.getAllByDisplayValue('#ff0000');
      expect(redColorInputs.length).toBeGreaterThan(0);
    });

    const resetButton = screen.getByRole('button', { name: /reset to default colours/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      const defaultColorInputs = screen.getAllByDisplayValue('#1976d2');
      expect(defaultColorInputs.length).toBeGreaterThan(0);
    });
  });

  it('should save branding settings when save button clicked', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockResolvedValueOnce({ success: true });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/primary colour/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/api/orgadmin/organisation/branding-settings',
        data: expect.objectContaining({
          logoUrl: 'https://example.com/logo.png',
          primaryColor: '#1976d2',
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
      expect(screen.getByLabelText(/primary colour/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Branding settings saved successfully')).toBeInTheDocument();
    });
  });

  it('should display preview with branding colors', async () => {
    mockExecute.mockResolvedValueOnce(mockBrandingSettings);

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    expect(screen.getByText('Primary Button')).toBeInTheDocument();
    expect(screen.getByText('Secondary Button')).toBeInTheDocument();
    expect(screen.getByText('Accent Button')).toBeInTheDocument();
  });

  it('should display error message on save failure', async () => {
    mockExecute
      .mockResolvedValueOnce(mockBrandingSettings)
      .mockRejectedValueOnce({ message: 'Failed to save branding settings' });

    render(<BrandingTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/primary colour/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save branding settings')).toBeInTheDocument();
    });
  });
});
