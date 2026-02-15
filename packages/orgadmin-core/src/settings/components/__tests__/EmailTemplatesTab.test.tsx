/**
 * Unit tests for EmailTemplatesTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import EmailTemplatesTab from '../EmailTemplatesTab';
import * as useApiModule from '../../../hooks/useApi';

// Initialize i18n for testing
i18n.init({
  lng: 'en-GB',
  fallbackLng: 'en-GB',
  resources: {
    'en-GB': {
      translation: {
        settings: {
          emailTemplates: {
            title: 'Email Templates',
            subtitle: 'Customise email templates sent to users',
            fields: {
              templateType: 'Template Type',
              subject: 'Subject',
              body: 'Body',
              resetToDefault: 'Reset to Default',
            },
            templateTypes: {
              welcome: 'Welcome Email',
              eventConfirmation: 'Event Entry Confirmation',
              paymentReceipt: 'Payment Receipt',
              membershipConfirmation: 'Membership Confirmation',
              passwordReset: 'Password Reset',
            },
            variables: {
              title: 'Available Variables',
            },
            messages: {
              loadFailed: 'Failed to load email templates',
              saveFailed: 'Failed to save email template',
              saveSuccess: 'Email template saved successfully',
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

describe('EmailTemplatesTab', () => {
  const mockExecute = vi.fn();
  const mockTemplates = [
    {
      id: '1',
      name: 'welcome',
      subject: 'Welcome to {{organisation_name}}',
      body: 'Dear {{user_name}},\n\nWelcome!',
    },
    {
      id: '2',
      name: 'event_confirmation',
      subject: 'Event Entry Confirmation - {{event_name}}',
      body: 'Dear {{user_name}},\n\nYour entry has been confirmed.',
    },
  ];

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

  it('should load email templates on mount', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/organisation/email-templates',
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

    renderWithI18n(<EmailTemplatesTab />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display template selector with options', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/template type/i)).toBeInTheDocument();
    });
  });

  it('should display welcome template by default', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue(/Dear {{user_name}}/)).toBeInTheDocument();
  });

  it('should switch templates when selector changed', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/template type/i)).toBeInTheDocument();
    });

    const templateSelect = screen.getByLabelText(/template type/i);
    fireEvent.mouseDown(templateSelect);

    const eventOption = await screen.findByText('Event Entry Confirmation');
    fireEvent.click(eventOption);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Event Entry Confirmation - {{event_name}}')).toBeInTheDocument();
    });
  });

  it('should update subject field', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });

    const subjectInput = screen.getByLabelText(/subject/i);
    fireEvent.change(subjectInput, { target: { value: 'Updated Subject' } });

    expect(subjectInput).toHaveValue('Updated Subject');
  });

  it('should update body field', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/body/i)).toBeInTheDocument();
    });

    const bodyInput = screen.getByLabelText(/body/i);
    fireEvent.change(bodyInput, { target: { value: 'Updated body content' } });

    expect(bodyInput).toHaveValue('Updated body content');
  });

  it('should save template when save button clicked', async () => {
    mockExecute
      .mockResolvedValueOnce(mockTemplates)
      .mockResolvedValueOnce({ success: true });

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/api/orgadmin/organisation/email-templates',
        data: expect.objectContaining({
          name: 'welcome',
          subject: 'Welcome to {{organisation_name}}',
        }),
      });
    });
  });

  it('should display success message after successful save', async () => {
    mockExecute
      .mockResolvedValueOnce(mockTemplates)
      .mockResolvedValueOnce({ success: true });

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Email template saved successfully')).toBeInTheDocument();
    });
  });

  it('should reset template to default', async () => {
    mockExecute.mockResolvedValueOnce([
      {
        ...mockTemplates[0],
        subject: 'Custom Subject',
        body: 'Custom Body',
      },
    ]);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Custom Subject')).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /reset to default/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });
  });

  it('should display available variables information', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByText('Available Variables')).toBeInTheDocument();
    });

    const variableElements = screen.getAllByText(/{{organisation_name}}/);
    expect(variableElements.length).toBeGreaterThan(0);
  });

  it('should display error message on save failure', async () => {
    mockExecute
      .mockResolvedValueOnce(mockTemplates)
      .mockRejectedValueOnce({ message: 'Failed to save email template' });

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save email template')).toBeInTheDocument();
    });
  });

  it('should use default template when no custom template exists', async () => {
    mockExecute.mockResolvedValueOnce([]);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Welcome to {{organisation_name}}')).toBeInTheDocument();
    });
  });

  it('should display error message on load failure', async () => {
    mockExecute.mockRejectedValueOnce({
      message: 'Failed to load email templates',
    });

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load email templates')).toBeInTheDocument();
    });
  });

  it('should show all template type options', async () => {
    mockExecute.mockResolvedValueOnce(mockTemplates);

    renderWithI18n(<EmailTemplatesTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/template type/i)).toBeInTheDocument();
    });

    const templateSelect = screen.getByLabelText(/template type/i);
    fireEvent.mouseDown(templateSelect);

    await waitFor(() => {
      const welcomeOptions = screen.getAllByText('Welcome Email');
      expect(welcomeOptions.length).toBeGreaterThan(0);
      expect(screen.getByText('Event Entry Confirmation')).toBeInTheDocument();
      expect(screen.getByText('Payment Receipt')).toBeInTheDocument();
      expect(screen.getByText('Membership Confirmation')).toBeInTheDocument();
      expect(screen.getByText('Password Reset')).toBeInTheDocument();
    });
  });
});
