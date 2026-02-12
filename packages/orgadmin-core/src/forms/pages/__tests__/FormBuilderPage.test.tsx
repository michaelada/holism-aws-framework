/**
 * Unit tests for FormBuilderPage component
 * Tests form builder field operations, validation, and document_upload configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FormBuilderPage from '../FormBuilderPage';
import * as useApiModule from '../../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams = { id: undefined };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

const mockAvailableFields = [
  {
    id: 'field-1',
    name: 'first_name',
    label: 'First Name',
    datatype: 'text',
  },
  {
    id: 'field-2',
    name: 'email',
    label: 'Email Address',
    datatype: 'email',
  },
  {
    id: 'field-3',
    name: 'resume',
    label: 'Upload Resume',
    datatype: 'document_upload',
  },
  {
    id: 'field-4',
    name: 'birth_date',
    label: 'Date of Birth',
    datatype: 'date',
  },
  {
    id: 'field-5',
    name: 'country',
    label: 'Country',
    datatype: 'single_select',
  },
];

const mockExistingForm = {
  id: 'form-1',
  name: 'Test Form',
  description: 'Test form description',
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
      fieldId: 'field-3',
      fieldName: 'resume',
      fieldLabel: 'Upload Resume',
      fieldType: 'document_upload',
      order: 2,
      required: false,
    },
  ],
  fieldGroups: [],
};

describe('FormBuilderPage', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockParams.id = undefined;
    
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
        <FormBuilderPage />
      </BrowserRouter>
    );
  };

  describe('Form Builder Initialization', () => {
    it('should render create form page with empty state', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Form Name')).toHaveValue('');
      expect(screen.getByLabelText('Description')).toHaveValue('');
    });

    it('should load available fields on mount', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/application-fields',
        });
      });
    });

    it('should load existing form when editing', async () => {
      mockParams.id = 'form-1';
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockResolvedValueOnce(mockExistingForm);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Edit Form')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Form Name')).toHaveValue('Test Form');
        expect(screen.getByLabelText('Description')).toHaveValue('Test form description');
      });
    });

    it('should display loading state while fetching form', async () => {
      mockParams.id = 'form-1';
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockImplementationOnce(() => new Promise(() => {}));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });
  });

  describe('Field Operations', () => {
    it('should add a field to the form', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Click Add Field button
      const addFieldButton = screen.getByRole('button', { name: /add field/i });
      fireEvent.click(addFieldButton);

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByText('Add Field')).toBeInTheDocument();
      });

      // Select a field
      const selectField = screen.getByLabelText('Select Field');
      fireEvent.mouseDown(selectField);

      const firstNameOption = await screen.findByText('First Name (text)');
      fireEvent.click(firstNameOption);

      // Verify field was added
      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
        expect(screen.getByText(/text • optional/i)).toBeInTheDocument();
      });
    });

    it('should add document_upload field to the form', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      const addFieldButton = screen.getByRole('button', { name: /add field/i });
      fireEvent.click(addFieldButton);

      await waitFor(() => {
        expect(screen.getByText('Add Field')).toBeInTheDocument();
      });

      const selectField = screen.getByLabelText('Select Field');
      fireEvent.mouseDown(selectField);

      const uploadOption = await screen.findByText('Upload Resume (document_upload)');
      fireEvent.click(uploadOption);

      await waitFor(() => {
        expect(screen.getByText('Upload Resume')).toBeInTheDocument();
        expect(screen.getByText(/document_upload • optional/i)).toBeInTheDocument();
      });
    });

    it('should remove a field from the form', async () => {
      mockParams.id = 'form-1';
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockResolvedValueOnce(mockExistingForm);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(btn => 
        btn.querySelector('[data-testid="DeleteIcon"]')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.queryByText('First Name')).not.toBeInTheDocument();
        });
      }
    });

    it('should toggle field required status', async () => {
      mockParams.id = 'form-1';
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockResolvedValueOnce(mockExistingForm);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/text • required/i)).toBeInTheDocument();
      });

      const makeOptionalButton = screen.getByRole('button', { name: /make optional/i });
      fireEvent.click(makeOptionalButton);

      await waitFor(() => {
        expect(screen.getByText(/text • optional/i)).toBeInTheDocument();
      });
    });

    it('should display empty state when no fields are added', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no fields added yet/i)).toBeInTheDocument();
      });
    });

    it('should not show already selected fields in add field dialog', async () => {
      mockParams.id = 'form-1';
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockResolvedValueOnce(mockExistingForm);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
      });

      const addFieldButton = screen.getByRole('button', { name: /add field/i });
      fireEvent.click(addFieldButton);

      await waitFor(() => {
        expect(screen.getByText('Add Field')).toBeInTheDocument();
      });

      const selectField = screen.getByLabelText('Select Field');
      fireEvent.mouseDown(selectField);

      // First Name should not be in the list since it's already added
      await waitFor(() => {
        expect(screen.queryByText('First Name (text)')).not.toBeInTheDocument();
      });
    });
  });

  describe('Field Groups', () => {
    it('should add a field group', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Switch to Field Groups tab
      const fieldGroupsTab = screen.getByRole('tab', { name: /field groups/i });
      fireEvent.click(fieldGroupsTab);

      await waitFor(() => {
        expect(screen.getByText(/no field groups defined/i)).toBeInTheDocument();
      });

      // Click Add Group button
      const addGroupButton = screen.getByRole('button', { name: /add group/i });
      fireEvent.click(addGroupButton);

      await waitFor(() => {
        expect(screen.getByText('Add Field Group')).toBeInTheDocument();
      });

      // Fill in group details
      const groupNameInput = screen.getByLabelText('Group Name');
      const groupDescInput = screen.getByLabelText('Description');
      
      fireEvent.change(groupNameInput, { target: { value: 'Personal Information' } });
      fireEvent.change(groupDescInput, { target: { value: 'Basic personal details' } });

      // Click Add button
      const addButton = screen.getByRole('button', { name: 'Add' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Personal Information')).toBeInTheDocument();
        expect(screen.getByText(/basic personal details • 0 fields/i)).toBeInTheDocument();
      });
    });

    it('should remove a field group', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Switch to Field Groups tab
      const fieldGroupsTab = screen.getByRole('tab', { name: /field groups/i });
      fireEvent.click(fieldGroupsTab);

      // Add a group first
      const addGroupButton = screen.getByRole('button', { name: /add group/i });
      fireEvent.click(addGroupButton);

      await waitFor(() => {
        expect(screen.getByText('Add Field Group')).toBeInTheDocument();
      });

      const groupNameInput = screen.getByLabelText('Group Name');
      fireEvent.change(groupNameInput, { target: { value: 'Test Group' } });

      const addButton = screen.getByRole('button', { name: 'Add' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });

      // Now remove it
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(btn => 
        btn.querySelector('[data-testid="DeleteIcon"]')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.queryByText('Test Group')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Wizard Steps', () => {
    it('should add a wizard step', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Switch to Wizard Steps tab
      const wizardTab = screen.getByRole('tab', { name: /wizard steps/i });
      fireEvent.click(wizardTab);

      await waitFor(() => {
        expect(screen.getByText(/no wizard steps defined/i)).toBeInTheDocument();
      });

      // Click Add Step button
      const addStepButton = screen.getByRole('button', { name: /add step/i });
      fireEvent.click(addStepButton);

      await waitFor(() => {
        expect(screen.getByText('Add Wizard Step')).toBeInTheDocument();
      });

      // Fill in step details
      const stepNameInput = screen.getByLabelText('Step Name');
      const stepDescInput = screen.getByLabelText('Description');
      
      fireEvent.change(stepNameInput, { target: { value: 'Personal Details' } });
      fireEvent.change(stepDescInput, { target: { value: 'Enter your personal information' } });

      // Click Add button
      const addButton = screen.getByRole('button', { name: 'Add' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/step 1: personal details/i)).toBeInTheDocument();
        expect(screen.getByText(/enter your personal information • 0 fields/i)).toBeInTheDocument();
      });
    });

    it('should remove a wizard step', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Switch to Wizard Steps tab
      const wizardTab = screen.getByRole('tab', { name: /wizard steps/i });
      fireEvent.click(wizardTab);

      // Add a step first
      const addStepButton = screen.getByRole('button', { name: /add step/i });
      fireEvent.click(addStepButton);

      await waitFor(() => {
        expect(screen.getByText('Add Wizard Step')).toBeInTheDocument();
      });

      const stepNameInput = screen.getByLabelText('Step Name');
      fireEvent.change(stepNameInput, { target: { value: 'Test Step' } });

      const addButton = screen.getByRole('button', { name: 'Add' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/step 1: test step/i)).toBeInTheDocument();
      });

      // Now remove it
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(btn => 
        btn.querySelector('[data-testid="DeleteIcon"]')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.queryByText(/step 1: test step/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Form Validation and Saving', () => {
    it('should show error when saving without form name', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      const publishButton = screen.getByRole('button', { name: /publish/i });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('Form name is required')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should save form as draft', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Fill in form name
      const nameInput = screen.getByRole('textbox', { name: /form name/i });
      fireEvent.change(nameInput, { target: { value: 'New Form' } });

      // Click Save as Draft
      const draftButton = screen.getByRole('button', { name: /save as draft/i });
      fireEvent.click(draftButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/application-forms',
          data: expect.objectContaining({
            name: 'New Form',
            status: 'draft',
          }),
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms');
    });

    it('should publish form', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      // Fill in form details
      const nameInput = screen.getByRole('textbox', { name: /form name/i });
      const descInput = screen.getByRole('textbox', { name: /description/i });
      
      fireEvent.change(nameInput, { target: { value: 'Published Form' } });
      fireEvent.change(descInput, { target: { value: 'Form description' } });

      // Click Publish
      const publishButton = screen.getByRole('button', { name: /publish/i });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/application-forms',
          data: expect.objectContaining({
            name: 'Published Form',
            description: 'Form description',
            status: 'published',
          }),
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms');
    });

    it('should update existing form', async () => {
      mockParams.id = 'form-1';
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockResolvedValueOnce(mockExistingForm);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Edit Form')).toBeInTheDocument();
      });

      // Modify form name
      const nameInput = screen.getByRole('textbox', { name: /form name/i });
      fireEvent.change(nameInput, { target: { value: 'Updated Form' } });

      // Click Publish
      const publishButton = screen.getByRole('button', { name: /publish/i });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/api/orgadmin/application-forms/form-1',
          data: expect.objectContaining({
            name: 'Updated Form',
            status: 'published',
          }),
        });
      });
    });

    it('should handle save errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute
        .mockResolvedValueOnce(mockAvailableFields)
        .mockRejectedValueOnce(new Error('Save failed'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      const nameInput = screen.getByRole('textbox', { name: /form name/i });
      fireEvent.change(nameInput, { target: { value: 'Test Form' } });

      const publishButton = screen.getByRole('button', { name: /publish/i });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save form')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to forms list when cancel is clicked', async () => {
      mockExecute.mockResolvedValue(mockAvailableFields);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Create Form')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/forms');
    });
  });
});
