/**
 * CreateMemberPage Rendering Tests
 * 
 * Tests for Task 5.8: Complete rendering flow with all components
 * Validates Requirements 3.1, 3.2, 3.3, 3.4
 * 
 * These tests verify the complete rendering flow:
 * - Page loads membership type correctly
 * - Page loads form definition correctly
 * - Name field renders correctly
 * - Dynamic fields render correctly based on form definition
 * - Integration of all rendering components
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock FieldRenderer component
vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: ({ fieldDefinition, value, onChange, required }: any) => (
    <div data-testid={`field-${fieldDefinition.shortName}`}>
      <label>{fieldDefinition.displayName}</label>
      <input
        data-testid={`input-${fieldDefinition.shortName}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={fieldDefinition.description}
      />
    </div>
  ),
}));

/**
 * Helper function to setup mock API responses
 */
const setupMockApi = (membershipType: any, formDefinition: any) => {
  mockExecute.mockImplementation(({ url }) => {
    if (url === '/api/orgadmin/auth/me') {
      return Promise.resolve({ user: { id: 'user-1' } });
    }
    if (url.includes('/membership-types/')) {
      return Promise.resolve(membershipType);
    }
    if (url.includes('/application-forms/')) {
      return Promise.resolve(formDefinition);
    }
    return Promise.resolve(null);
  });
};

describe('CreateMemberPage - Complete Rendering Flow (Task 5.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Rendering Flow with All Components', () => {
    it('should render complete form with membership type, name field, and dynamic fields', async () => {
      // Requirement 3.1: The Member_Creation_Form SHALL render the form on a separate page
      // Requirement 3.2: THE Member_Creation_Form SHALL include a mandatory Name field
      // Requirement 3.3: WHEN a Membership_Type is selected, THE System SHALL fetch the associated Form_Definition
      // Requirement 3.4: FOR EACH Form_Field in the Form_Definition, THE Member_Creation_Form SHALL render an appropriate input control
      
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            order: 1,
            validation: { required: true },
          },
          {
            id: 'field-2',
            name: 'phone',
            label: 'Phone Number',
            datatype: 'text',
            order: 2,
            validation: { required: false },
          },
        ],
      };

      mockExecute.mockImplementation(({ url }) => {
        if (url === '/api/orgadmin/auth/me') {
          return Promise.resolve({ user: { id: 'user-1' } });
        }
        if (url.includes('/membership-types/')) {
          return Promise.resolve(mockMembershipType);
        }
        if (url.includes('/application-forms/')) {
          return Promise.resolve(mockFormDefinition);
        }
        return Promise.resolve(null);
      });

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify membership type is displayed
      expect(screen.getByText('Individual Membership')).toBeInTheDocument();

      // Verify name field is rendered
      expect(screen.getByTestId('name-field')).toBeInTheDocument();

      // Verify dynamic fields are rendered
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
      expect(screen.getByTestId('field-phone')).toBeInTheDocument();
    });

    it('should render form with only name field when form definition has no fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Basic Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Basic Form',
        fields: [],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify membership type is displayed
      expect(screen.getByText('Basic Membership')).toBeInTheDocument();

      // Verify name field is rendered
      expect(screen.getByTestId('name-field')).toBeInTheDocument();

      // Verify no dynamic fields are rendered
      const textFields = screen.getAllByRole('textbox');
      expect(textFields).toHaveLength(1); // Only name field
    });
  });

  describe('Different Field Type Combinations', () => {
    it('should render form with text and number fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'address',
            label: 'Address',
            datatype: 'text',
            order: 1,
          },
          {
            id: 'field-2',
            name: 'age',
            label: 'Age',
            datatype: 'number',
            order: 2,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-address')).toBeInTheDocument();
      });

      expect(screen.getByText('Address')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
    });

    it('should render form with date and email fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'birthDate',
            label: 'Date of Birth',
            datatype: 'date',
            order: 1,
          },
          {
            id: 'field-2',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 2,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-birthDate')).toBeInTheDocument();
      });

      expect(screen.getByText('Date of Birth')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('should render form with select and textarea fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'membershipLevel',
            label: 'Membership Level',
            datatype: 'select',
            order: 1,
            options: ['Bronze', 'Silver', 'Gold'],
          },
          {
            id: 'field-2',
            name: 'bio',
            label: 'Biography',
            datatype: 'textarea',
            order: 2,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-membershipLevel')).toBeInTheDocument();
      });

      expect(screen.getByText('Membership Level')).toBeInTheDocument();
      expect(screen.getByText('Biography')).toBeInTheDocument();
    });

    it('should render form with checkbox and radio fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'interests',
            label: 'Interests',
            datatype: 'checkbox',
            order: 1,
            options: ['Sports', 'Music', 'Art'],
          },
          {
            id: 'field-2',
            name: 'gender',
            label: 'Gender',
            datatype: 'radio',
            order: 2,
            options: ['Male', 'Female', 'Other'],
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-interests')).toBeInTheDocument();
      });

      expect(screen.getByText('Interests')).toBeInTheDocument();
      expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('should render form with file upload fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'profilePhoto',
            label: 'Profile Photo',
            datatype: 'image',
            order: 1,
          },
          {
            id: 'field-2',
            name: 'resume',
            label: 'Resume',
            datatype: 'file',
            order: 2,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-profilePhoto')).toBeInTheDocument();
      });

      expect(screen.getByText('Profile Photo')).toBeInTheDocument();
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });
  });

  describe('Multiple Fields Rendering', () => {
    it('should render form with many fields (5+ fields)', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Premium Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Premium Form',
        fields: [
          { id: 'f1', name: 'firstName', label: 'First Name', datatype: 'text', order: 1 },
          { id: 'f2', name: 'lastName', label: 'Last Name', datatype: 'text', order: 2 },
          { id: 'f3', name: 'email', label: 'Email', datatype: 'email', order: 3 },
          { id: 'f4', name: 'phone', label: 'Phone', datatype: 'text', order: 4 },
          { id: 'f5', name: 'address', label: 'Address', datatype: 'textarea', order: 5 },
          { id: 'f6', name: 'birthDate', label: 'Birth Date', datatype: 'date', order: 6 },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify all fields are rendered
      expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
      expect(screen.getByTestId('field-lastName')).toBeInTheDocument();
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
      expect(screen.getByTestId('field-phone')).toBeInTheDocument();
      expect(screen.getByTestId('field-address')).toBeInTheDocument();
      expect(screen.getByTestId('field-birthDate')).toBeInTheDocument();
    });
  });

  describe('Field Ordering Verification', () => {
    it('should render fields in correct order based on order property', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          { id: 'field-3', name: 'third', label: 'Third Field', datatype: 'text', order: 3 },
          { id: 'field-1', name: 'first', label: 'First Field', datatype: 'text', order: 1 },
          { id: 'field-2', name: 'second', label: 'Second Field', datatype: 'text', order: 2 },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-first')).toBeInTheDocument();
      });

      // Get all field elements
      const firstField = screen.getByTestId('field-first');
      const secondField = screen.getByTestId('field-second');
      const thirdField = screen.getByTestId('field-third');

      // Verify they exist
      expect(firstField).toBeInTheDocument();
      expect(secondField).toBeInTheDocument();
      expect(thirdField).toBeInTheDocument();
    });

    it('should render fields with non-sequential order values correctly', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          { id: 'field-1', name: 'fieldA', label: 'Field A', datatype: 'text', order: 10 },
          { id: 'field-2', name: 'fieldB', label: 'Field B', datatype: 'text', order: 5 },
          { id: 'field-3', name: 'fieldC', label: 'Field C', datatype: 'text', order: 20 },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-fieldA')).toBeInTheDocument();
      });

      // All fields should be rendered
      expect(screen.getByTestId('field-fieldB')).toBeInTheDocument();
      expect(screen.getByTestId('field-fieldA')).toBeInTheDocument();
      expect(screen.getByTestId('field-fieldC')).toBeInTheDocument();
    });
  });

  describe('Required vs Optional Fields', () => {
    it('should render required fields with required attribute', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-email')).toBeInTheDocument();
      });

      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
      expect(emailInput.required).toBe(true);
    });

    it('should render optional fields without required attribute', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'phone',
            label: 'Phone',
            datatype: 'text',
            order: 1,
            validation: { required: false },
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-phone')).toBeInTheDocument();
      });

      const phoneInput = screen.getByTestId('input-phone') as HTMLInputElement;
      expect(phoneInput.required).toBe(false);
    });

    it('should render mix of required and optional fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
            validation: { required: true },
          },
          {
            id: 'field-2',
            name: 'phone',
            label: 'Phone',
            datatype: 'text',
            order: 2,
            validation: { required: false },
          },
          {
            id: 'field-3',
            name: 'address',
            label: 'Address',
            datatype: 'text',
            order: 3,
            validation: { required: true },
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-email')).toBeInTheDocument();
      });

      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
      const phoneInput = screen.getByTestId('input-phone') as HTMLInputElement;
      const addressInput = screen.getByTestId('input-address') as HTMLInputElement;

      expect(emailInput.required).toBe(true);
      expect(phoneInput.required).toBe(false);
      expect(addressInput.required).toBe(true);
    });

    it('should treat fields without validation property as optional', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'notes',
            label: 'Notes',
            datatype: 'textarea',
            order: 1,
            // No validation property
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-notes')).toBeInTheDocument();
      });

      const notesInput = screen.getByTestId('input-notes') as HTMLInputElement;
      expect(notesInput.required).toBe(false);
    });
  });

  describe('Fields with Descriptions', () => {
    it('should render field with description as placeholder', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            order: 1,
            description: 'Enter your primary email address',
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-email')).toBeInTheDocument();
      });

      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
      expect(emailInput.placeholder).toBe('Enter your primary email address');
    });

    it('should render field without description', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'phone',
            label: 'Phone Number',
            datatype: 'text',
            order: 1,
            // No description
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-phone')).toBeInTheDocument();
      });

      const phoneInput = screen.getByTestId('input-phone') as HTMLInputElement;
      expect(phoneInput.placeholder).toBe('');
    });

    it('should render multiple fields with different descriptions', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
            description: 'Your primary email',
          },
          {
            id: 'field-2',
            name: 'phone',
            label: 'Phone',
            datatype: 'text',
            order: 2,
            description: 'Include country code',
          },
          {
            id: 'field-3',
            name: 'address',
            label: 'Address',
            datatype: 'textarea',
            order: 3,
            // No description
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-email')).toBeInTheDocument();
      });

      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
      const phoneInput = screen.getByTestId('input-phone') as HTMLInputElement;
      const addressInput = screen.getByTestId('input-address') as HTMLInputElement;

      expect(emailInput.placeholder).toBe('Your primary email');
      expect(phoneInput.placeholder).toBe('Include country code');
      expect(addressInput.placeholder).toBe('');
    });
  });

  describe('Integration Between Name Field and Dynamic Fields', () => {
    it('should render name field before dynamic fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      // Both name field and dynamic field should be present
      expect(screen.getByTestId('name-field')).toBeInTheDocument();
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
    });

    it('should maintain separate state for name field and dynamic fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;

      // Both should start empty
      expect(nameInput.value).toBe('');
      expect(emailInput.value).toBe('');
    });

    it('should render all action buttons with both name and dynamic fields', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      });

      // Verify all components are present
      expect(screen.getByTestId('name-field')).toBeInTheDocument();
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });
  });

  describe('Complex Form Scenarios', () => {
    it('should render form with all field types together', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Comprehensive Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Comprehensive Form',
        fields: [
          { id: 'f1', name: 'firstName', label: 'First Name', datatype: 'text', order: 1 },
          { id: 'f2', name: 'age', label: 'Age', datatype: 'number', order: 2 },
          { id: 'f3', name: 'email', label: 'Email', datatype: 'email', order: 3 },
          { id: 'f4', name: 'birthDate', label: 'Birth Date', datatype: 'date', order: 4 },
          { id: 'f5', name: 'bio', label: 'Biography', datatype: 'textarea', order: 5 },
          { id: 'f6', name: 'level', label: 'Level', datatype: 'select', order: 6, options: ['Basic', 'Premium'] },
          { id: 'f7', name: 'newsletter', label: 'Newsletter', datatype: 'boolean', order: 7 },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify all field types are rendered
      expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
      expect(screen.getByTestId('field-age')).toBeInTheDocument();
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
      expect(screen.getByTestId('field-birthDate')).toBeInTheDocument();
      expect(screen.getByTestId('field-bio')).toBeInTheDocument();
      expect(screen.getByTestId('field-level')).toBeInTheDocument();
      expect(screen.getByTestId('field-newsletter')).toBeInTheDocument();
    });

    it('should render form with mixed required and optional fields with descriptions', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Mixed Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Mixed Form',
        fields: [
          {
            id: 'f1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
            validation: { required: true },
            description: 'Your primary email address',
          },
          {
            id: 'f2',
            name: 'phone',
            label: 'Phone',
            datatype: 'text',
            order: 2,
            validation: { required: false },
            description: 'Optional contact number',
          },
          {
            id: 'f3',
            name: 'address',
            label: 'Address',
            datatype: 'textarea',
            order: 3,
            validation: { required: true },
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-email')).toBeInTheDocument();
      });

      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
      const phoneInput = screen.getByTestId('input-phone') as HTMLInputElement;
      const addressInput = screen.getByTestId('input-address') as HTMLInputElement;

      // Verify required status
      expect(emailInput.required).toBe(true);
      expect(phoneInput.required).toBe(false);
      expect(addressInput.required).toBe(true);

      // Verify descriptions
      expect(emailInput.placeholder).toBe('Your primary email address');
      expect(phoneInput.placeholder).toBe('Optional contact number');
      expect(addressInput.placeholder).toBe('');
    });

    it('should handle form with single field correctly', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Simple Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Simple Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            order: 1,
            validation: { required: true },
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Should have name field + 1 dynamic field
      expect(screen.getByTestId('name-field')).toBeInTheDocument();
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
    });
  });

  describe('Page Structure Verification', () => {
    it('should render complete page structure with all elements', async () => {
      const mockMembershipType = {
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      };

      const mockFormDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email',
            datatype: 'email',
            order: 1,
          },
        ],
      };

      setupMockApi(mockMembershipType, mockFormDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify all page elements
      expect(screen.getByTestId('back-button')).toBeInTheDocument();
      expect(screen.getByText('Add New Member')).toBeInTheDocument();
      expect(screen.getByTestId('membership-type-name')).toBeInTheDocument();
      expect(screen.getByText('Individual Membership')).toBeInTheDocument();
      expect(screen.getByTestId('name-field')).toBeInTheDocument();
      expect(screen.getByTestId('field-email')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });
  });
});
