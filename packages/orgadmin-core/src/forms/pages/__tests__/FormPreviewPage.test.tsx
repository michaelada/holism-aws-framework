/**
 * Unit tests for FormPreviewPage component
 * Tests form preview rendering with different field types including document_upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FormPreviewPage from '../FormPreviewPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('@itsplainsailing/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));

// Shell hooks (translations, onboarding, page help, capabilities, locale)
// are mocked rather than provided — see test/orgadminShellMock.
vi.mock('@itsplainsailing/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams = { id: 'form-1' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

const mockSimpleForm = {
  id: 'form-1',
  name: 'Simple Registration Form',
  description: 'A simple form with basic fields',
  status: 'published',
  fields: [
    {
      id: 'field-1',
      name: 'first_name',
      label: 'First Name',
      datatype: 'text',
      order: 1,
      validation: { required: true },
    },
    {
      id: 'field-2',
      name: 'email',
      label: 'Email Address',
      datatype: 'email',
      order: 2,
      validation: { required: true },
    },
    {
      id: 'field-3',
      name: 'resume',
      label: 'Upload Resume',
      datatype: 'document_upload',
      order: 3,
      validation: { required: false },
    },
  ],
};

const mockFormWithGroups = {
  id: 'form-2',
  name: 'Form with Groups',
  description: 'A form organized into field groups',
  status: 'draft',
  fields: [
    {
      id: 'field-1',
      name: 'first_name',
      label: 'First Name',
      datatype: 'text',
      order: 1,
      validation: { required: true },
    },
    {
      id: 'field-2',
      name: 'last_name',
      label: 'Last Name',
      datatype: 'text',
      order: 2,
      validation: { required: true },
    },
    {
      id: 'field-3',
      name: 'company',
      label: 'Company',
      datatype: 'text',
      order: 3,
      validation: { required: false },
    },
  ],
  fieldGroups: [
    {
      name: 'Personal Information',
      description: 'Your personal details',
      fields: ['first_name', 'last_name'],
      order: 1,
    },
    {
      name: 'Professional Information',
      description: 'Your work details',
      fields: ['company'],
      order: 2,
    },
  ],
};

const mockFormWithWizard = {
  id: 'form-3',
  name: 'Multi-Step Form',
  description: 'A form with wizard steps',
  status: 'published',
  fields: [
    {
      id: 'field-1',
      name: 'first_name',
      label: 'First Name',
      datatype: 'text',
      order: 1,
      validation: { required: true },
    },
    {
      id: 'field-2',
      name: 'email',
      label: 'Email',
      datatype: 'email',
      order: 2,
      validation: { required: true },
    },
    {
      id: 'field-3',
      name: 'cv',
      label: 'Upload CV',
      datatype: 'document_upload',
      order: 3,
      validation: { required: false },
    },
  ],
  wizardConfig: {
    steps: [
      {
        name: 'Basic Information',
        description: 'Enter your basic details',
        fields: ['first_name', 'email'],
        order: 1,
      },
      {
        name: 'Documents',
        description: 'Upload required documents',
        fields: ['cv'],
        order: 2,
      },
    ],
  },
};

describe('FormPreviewPage', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockParams.id = 'form-1';
    
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const renderComponent = () => {
    return renderWithProviders(<FormPreviewPage />);
  };

  /**
   * These exercise the real MUI pickers, so they need the real
   * LocalizationProvider — do not reintroduce a stub for it.
   *
   * They used to fail with "Can not find the date and time pickers localization
   * context", which reads like the duplicate-install problem MUI's message
   * suggests. It was not: there is one install, and the suite stubbed
   * `@mui/x-date-pickers/LocalizationProvider` with a plain `<div>`, so nothing
   * ever published the context the pickers look for. That stub existed to dodge
   * a separate fault — Vitest served the ESM build to the provider and the CJS
   * build under `@mui/x-date-pickers/node` to the pickers — now fixed by
   * inlining the package in vite.config.ts.
   *
   * The `localization-provider` test id is the page's own Box, which sits
   * inside the real provider.
   */
  describe('LocalizationProvider Configuration', () => {
    it('should render LocalizationProvider component', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form Preview')).toBeInTheDocument();
      });

      // Verify LocalizationProvider wrapper is present
      expect(screen.getAllByTestId('localization-provider')[0]).toBeInTheDocument();
    });

    it('should configure AdapterDateFns for date localization', async () => {
      mockExecute.mockResolvedValue({
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'birth_date',
            label: 'Date of Birth',
            datatype: 'date',
            order: 1,
            validation: { required: false },
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Date of Birth')[0]).toBeInTheDocument();
      });

      // Verify LocalizationProvider wraps the content
      expect(screen.getAllByTestId('localization-provider')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Date of Birth')[0]).toBeInTheDocument();
    });

    it('should support date picker fields without context errors', async () => {
      const formWithDateField = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'event_date',
            label: 'Event Date',
            datatype: 'date',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithDateField);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Date')).toBeInTheDocument();
      });

      // Verify the field renders within LocalizationProvider context
      const provider = screen.getAllByTestId('localization-provider')[0];
      expect(provider).toBeInTheDocument();
      expect(screen.getByText('Event Date')).toBeInTheDocument();
    });

    it('should support time picker fields without context errors', async () => {
      const formWithTimeField = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'appointment_time',
            label: 'Appointment Time',
            datatype: 'time',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithTimeField);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Appointment Time')).toBeInTheDocument();
      });

      // Verify the field renders within LocalizationProvider context
      const provider = screen.getAllByTestId('localization-provider')[0];
      expect(provider).toBeInTheDocument();
      expect(screen.getByText('Appointment Time')).toBeInTheDocument();
    });

    it('should support datetime picker fields without context errors', async () => {
      const formWithDateTimeField = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'meeting_datetime',
            label: 'Meeting Date & Time',
            datatype: 'datetime',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithDateTimeField);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Meeting Date & Time')).toBeInTheDocument();
      });

      // Verify the field renders within LocalizationProvider context
      const provider = screen.getAllByTestId('localization-provider')[0];
      expect(provider).toBeInTheDocument();
      expect(screen.getByText('Meeting Date & Time')).toBeInTheDocument();
    });

    it('should support multiple date/time fields without context conflicts', async () => {
      const formWithMultipleDateFields = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'start_date',
            label: 'Start Date',
            datatype: 'date',
            order: 1,
            validation: { required: true },
          },
          {
            id: 'field-2',
            name: 'end_date',
            label: 'End Date',
            datatype: 'date',
            order: 2,
            validation: { required: true },
          },
          {
            id: 'field-3',
            name: 'meeting_time',
            label: 'Meeting Time',
            datatype: 'time',
            order: 3,
            validation: { required: false },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithMultipleDateFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Start Date')).toBeInTheDocument();
        expect(screen.getByText('End Date')).toBeInTheDocument();
        expect(screen.getAllByText('Meeting Time')[0]).toBeInTheDocument();
      });

      // Verify all date/time fields render within the same LocalizationProvider context
      const provider = screen.getAllByTestId('localization-provider')[0];
      expect(provider).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
      expect(screen.getAllByText('Meeting Time')[0]).toBeInTheDocument();
    });
  });

  describe('Form Preview Rendering', () => {
    it('should render form preview page title', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form Preview')).toBeInTheDocument();
      });
    });

    it('should load and display form details', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/application-forms/form-1/with-fields',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Simple Registration Form')).toBeInTheDocument();
        expect(screen.getByText('A simple form with basic fields')).toBeInTheDocument();
        expect(screen.getByText(/status: published/i)).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching form', async () => {
      mockExecute.mockImplementation(() => new Promise(() => {}));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should display info alert about preview mode', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/this is a live preview of your form/i)).toBeInTheDocument();
      });
    });
  });

  describe('Field Rendering', () => {
    it('should render all form fields in order', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('First Name')[0]).toBeInTheDocument();
        expect(screen.getByText('Email Address')).toBeInTheDocument();
        expect(screen.getAllByText('Upload Resume')[0]).toBeInTheDocument();
      });
    });

    it('should display required indicator for required fields', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        const firstNameLabel = screen.getAllByText('First Name')[0];
        expect(firstNameLabel.parentElement?.textContent).toContain('*');
      });
    });

    it('should display field types', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        // The preview renders the field itself now, not a 'Type: …' caption.
        expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
        expect(screen.getAllByLabelText(/Email Address/i)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/Upload Resume/i)[0]).toBeInTheDocument();
      });
    });

    it('should render document_upload field with appropriate preview', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByLabelText(/Upload Resume/i)[0]).toBeInTheDocument();
      });
    });

    it('should render text fields with appropriate preview', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        const textInputs = screen.getAllByRole('textbox');
        expect(textInputs.length).toBeGreaterThan(0);
      });
    });

    it('should render select fields with appropriate preview', async () => {
      const formWithSelect = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'country',
            label: 'Country',
            datatype: 'single_select',
            order: 1,
            validation: { required: false },
            options: ['USA', 'UK', 'Canada'],
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithSelect);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/Country/i)).toBeInTheDocument();
      });
    });

    it('should render boolean fields with appropriate preview', async () => {
      const formWithBoolean = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'agree',
            label: 'I agree to terms',
            datatype: 'boolean',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithBoolean);
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/I agree to terms/i)[0]).toBeInTheDocument();
      });
    });

    it('should render date fields with appropriate preview', async () => {
      const formWithDate = {
        ...mockSimpleForm,
        fields: [
          {
            id: 'field-1',
            name: 'birth_date',
            label: 'Date of Birth',
            datatype: 'date',
            order: 1,
            validation: { required: false },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithDate);
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/Date of Birth/i)[0]).toBeInTheDocument();
      });
    });
  });

  describe('Field Groups Rendering', () => {
    it('should render form with field groups', async () => {
      mockExecute.mockResolvedValue(mockFormWithGroups);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Personal Information')).toBeInTheDocument();
        expect(screen.getByText('Your personal details')).toBeInTheDocument();
        expect(screen.getByText('Professional Information')).toBeInTheDocument();
        expect(screen.getByText('Your work details')).toBeInTheDocument();
      });
    });

    it('should organize fields into their respective groups', async () => {
      mockExecute.mockResolvedValue(mockFormWithGroups);
      renderComponent();

      await waitFor(() => {
        const personalInfoSection = screen.getByText('Personal Information').closest('div');
        expect(personalInfoSection?.textContent).toContain('First Name');
        expect(personalInfoSection?.textContent).toContain('Last Name');
      });
    });

    it('should render ungrouped fields in additional section', async () => {
      const formWithUngrouped = {
        ...mockFormWithGroups,
        fields: [
          ...mockFormWithGroups.fields,
          {
            id: 'field-4',
            name: 'notes',
            label: 'Additional Notes',
            datatype: 'text',
            order: 4,
            validation: { required: false },
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithUngrouped);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
        expect(screen.getAllByText('Additional Notes')[0]).toBeInTheDocument();
      });
    });
  });

  describe('Wizard Steps Rendering', () => {
    it('should render form with wizard steps', async () => {
      mockExecute.mockResolvedValue(mockFormWithWizard);
      renderComponent();

      // The wizard is a preview mode now — switch to it first.
      await waitFor(() => expect(screen.getByLabelText('wizard view')).toBeInTheDocument());
      fireEvent.click(screen.getByLabelText('wizard view'));

      await waitFor(() => {
        expect(screen.getByText('Multi-Step Form')).toBeInTheDocument();
        expect(screen.getAllByText(/basic information/i)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/documents/i)[0]).toBeInTheDocument();
      });
    });

    it('should display wizard step descriptions', async () => {
      mockExecute.mockResolvedValue(mockFormWithWizard);
      renderComponent();

      // The wizard is a preview mode now — switch to it first.
      await waitFor(() => expect(screen.getByLabelText('wizard view')).toBeInTheDocument());
      fireEvent.click(screen.getByLabelText('wizard view'));

      await waitFor(() => {
        expect(screen.getAllByText('Enter your basic details')[0]).toBeInTheDocument();
        // Only the active step's description is shown; step 2's appears after advancing.
        expect(screen.queryByText('Upload required documents')).not.toBeInTheDocument();
      });
    });

    it('should organize fields into wizard steps', async () => {
      mockExecute.mockResolvedValue(mockFormWithWizard);
      renderComponent();

      // The wizard is a preview mode now — switch to it first.
      await waitFor(() => expect(screen.getByLabelText('wizard view')).toBeInTheDocument());
      fireEvent.click(screen.getByLabelText('wizard view'));

      await waitFor(() => {
        // The step heading in the Stepper is not an ancestor of the fields —
        // assert against the rendered step content instead.
        expect(screen.getAllByLabelText(/First Name/i)[0]).toBeInTheDocument();
        expect(screen.getAllByLabelText(/Email/i)[0]).toBeInTheDocument();
      });

      // Step two's fields are not in the DOM until the wizard advances to it —
      // the previous assertion matched the Stepper's "Documents" label rather
      // than any step content, so it could never have seen Upload CV.
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      await waitFor(() => {
        expect(screen.getAllByText('Upload CV')[0]).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to forms list when back button is clicked', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form Preview')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to forms/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/forms');
    });

    it('should navigate to edit page when edit button is clicked', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form Preview')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit form/i });
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith('/forms/form-1/edit');
    });

    it('should have disabled submit and cancel buttons in preview mode', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit \(preview only\)/i });
        const cancelButton = screen.getByRole('button', { name: /cancel \(preview only\)/i });

        expect(submitButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when form fails to load', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('Failed to load'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load form')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should display error when form is not found', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form not found')).toBeInTheDocument();
      });
    });

    it('should show back button on error', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /back to forms/i });
        expect(backButton).toBeInTheDocument();
      });
    });
  });

  describe('Form Status Display', () => {
    it('should display published status', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/status: published/i)).toBeInTheDocument();
      });
    });

    it('should display draft status', async () => {
      mockExecute.mockResolvedValue(mockFormWithGroups);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/status: draft/i)).toBeInTheDocument();
      });
    });
  });
});
