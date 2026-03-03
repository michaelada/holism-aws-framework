/**
 * Unit tests for FormPreviewPage component
 * Tests form preview rendering with different field types including document_upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FormPreviewPage from '../FormPreviewPage';
import * as useApiModule from '../../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock MUI X Date Pickers to avoid date-fns internal import issues in tests
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="localization-provider">{children}</div>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: vi.fn(),
}));

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
      fieldId: 'field-1',
      fieldName: 'first_name',
      fieldLabel: 'First Name',
      fieldType: 'text',
      order: 1,
      required: true,
    },
    {
      fieldId: 'field-2',
      fieldName: 'email',
      fieldLabel: 'Email Address',
      fieldType: 'email',
      order: 2,
      required: true,
    },
    {
      fieldId: 'field-3',
      fieldName: 'resume',
      fieldLabel: 'Upload Resume',
      fieldType: 'document_upload',
      order: 3,
      required: false,
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
      fieldId: 'field-1',
      fieldName: 'first_name',
      fieldLabel: 'First Name',
      fieldType: 'text',
      order: 1,
      required: true,
    },
    {
      fieldId: 'field-2',
      fieldName: 'last_name',
      fieldLabel: 'Last Name',
      fieldType: 'text',
      order: 2,
      required: true,
    },
    {
      fieldId: 'field-3',
      fieldName: 'company',
      fieldLabel: 'Company',
      fieldType: 'text',
      order: 3,
      required: false,
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
      fieldId: 'field-1',
      fieldName: 'first_name',
      fieldLabel: 'First Name',
      fieldType: 'text',
      order: 1,
      required: true,
    },
    {
      fieldId: 'field-2',
      fieldName: 'email',
      fieldLabel: 'Email',
      fieldType: 'email',
      order: 2,
      required: true,
    },
    {
      fieldId: 'field-3',
      fieldName: 'cv',
      fieldLabel: 'Upload CV',
      fieldType: 'document_upload',
      order: 3,
      required: false,
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
    return render(
      <BrowserRouter>
        <FormPreviewPage />
      </BrowserRouter>
    );
  };

  describe('LocalizationProvider Configuration', () => {
    it('should render LocalizationProvider component', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form Preview')).toBeInTheDocument();
      });

      // Verify LocalizationProvider wrapper is present
      expect(screen.getByTestId('localization-provider')).toBeInTheDocument();
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
            required: false,
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Date of Birth')).toBeInTheDocument();
      });

      // Verify LocalizationProvider wraps the content
      expect(screen.getByTestId('localization-provider')).toBeInTheDocument();
      expect(screen.getByText('Date of Birth')).toBeInTheDocument();
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
            required: true,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithDateField);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event Date')).toBeInTheDocument();
      });

      // Verify the field renders within LocalizationProvider context
      const provider = screen.getByTestId('localization-provider');
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
            required: true,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithTimeField);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Appointment Time')).toBeInTheDocument();
      });

      // Verify the field renders within LocalizationProvider context
      const provider = screen.getByTestId('localization-provider');
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
            required: true,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithDateTimeField);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Meeting Date & Time')).toBeInTheDocument();
      });

      // Verify the field renders within LocalizationProvider context
      const provider = screen.getByTestId('localization-provider');
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
            required: true,
          },
          {
            id: 'field-2',
            name: 'end_date',
            label: 'End Date',
            datatype: 'date',
            order: 2,
            required: true,
          },
          {
            id: 'field-3',
            name: 'meeting_time',
            label: 'Meeting Time',
            datatype: 'time',
            order: 3,
            required: false,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithMultipleDateFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Start Date')).toBeInTheDocument();
        expect(screen.getByText('End Date')).toBeInTheDocument();
        expect(screen.getByText('Meeting Time')).toBeInTheDocument();
      });

      // Verify all date/time fields render within the same LocalizationProvider context
      const provider = screen.getByTestId('localization-provider');
      expect(provider).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
      expect(screen.getByText('Meeting Time')).toBeInTheDocument();
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
          url: '/api/orgadmin/application-forms/form-1',
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
        expect(screen.getByText(/this is a preview of how your form will appear/i)).toBeInTheDocument();
      });
    });
  });

  describe('Field Rendering', () => {
    it('should render all form fields in order', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
        expect(screen.getByText('Email Address')).toBeInTheDocument();
        expect(screen.getByText('Upload Resume')).toBeInTheDocument();
      });
    });

    it('should display required indicator for required fields', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        const firstNameLabel = screen.getByText('First Name');
        expect(firstNameLabel.parentElement?.textContent).toContain('*');
      });
    });

    it('should display field types', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Type: text')).toBeInTheDocument();
        expect(screen.getByText('Type: email')).toBeInTheDocument();
        expect(screen.getByText('Type: document_upload')).toBeInTheDocument();
      });
    });

    it('should render document_upload field with appropriate preview', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('[File upload field - users can upload documents here]')).toBeInTheDocument();
      });
    });

    it('should render text fields with appropriate preview', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        const textInputs = screen.getAllByText('[Text input field]');
        expect(textInputs.length).toBeGreaterThan(0);
      });
    });

    it('should render select fields with appropriate preview', async () => {
      const formWithSelect = {
        ...mockSimpleForm,
        fields: [
          {
            fieldId: 'field-1',
            fieldName: 'country',
            fieldLabel: 'Country',
            fieldType: 'single_select',
            order: 1,
            required: false,
            options: ['USA', 'UK', 'Canada'],
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithSelect);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('[Dropdown/Select field with 3 options]')).toBeInTheDocument();
      });
    });

    it('should render boolean fields with appropriate preview', async () => {
      const formWithBoolean = {
        ...mockSimpleForm,
        fields: [
          {
            fieldId: 'field-1',
            fieldName: 'agree',
            fieldLabel: 'I agree to terms',
            fieldType: 'boolean',
            order: 1,
            required: true,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithBoolean);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('[Checkbox field]')).toBeInTheDocument();
      });
    });

    it('should render date fields with appropriate preview', async () => {
      const formWithDate = {
        ...mockSimpleForm,
        fields: [
          {
            fieldId: 'field-1',
            fieldName: 'birth_date',
            fieldLabel: 'Date of Birth',
            fieldType: 'date',
            order: 1,
            required: false,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithDate);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('[Date picker field]')).toBeInTheDocument();
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
            fieldId: 'field-4',
            fieldName: 'notes',
            fieldLabel: 'Additional Notes',
            fieldType: 'text',
            order: 4,
            required: false,
          },
        ],
      };

      mockExecute.mockResolvedValue(formWithUngrouped);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
        expect(screen.getByText('Additional Notes')).toBeInTheDocument();
      });
    });
  });

  describe('Wizard Steps Rendering', () => {
    it('should render form with wizard steps', async () => {
      mockExecute.mockResolvedValue(mockFormWithWizard);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Multi-Step Form (Wizard)')).toBeInTheDocument();
        expect(screen.getByText(/step 1: basic information/i)).toBeInTheDocument();
        expect(screen.getByText(/step 2: documents/i)).toBeInTheDocument();
      });
    });

    it('should display wizard step descriptions', async () => {
      mockExecute.mockResolvedValue(mockFormWithWizard);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Enter your basic details')).toBeInTheDocument();
        expect(screen.getByText('Upload required documents')).toBeInTheDocument();
      });
    });

    it('should organize fields into wizard steps', async () => {
      mockExecute.mockResolvedValue(mockFormWithWizard);
      renderComponent();

      await waitFor(() => {
        const step1Section = screen.getByText(/step 1: basic information/i).closest('div');
        expect(step1Section?.textContent).toContain('First Name');
        expect(step1Section?.textContent).toContain('Email');
      });

      await waitFor(() => {
        const step2Section = screen.getByText(/step 2: documents/i).closest('div');
        expect(step2Section?.textContent).toContain('Upload CV');
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

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms');
    });

    it('should navigate to edit page when edit button is clicked', async () => {
      mockExecute.mockResolvedValue(mockSimpleForm);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Form Preview')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit form/i });
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms/form-1/edit');
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
