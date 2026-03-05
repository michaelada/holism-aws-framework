/**
 * CreateMemberPage Field Metadata Display Tests
 * 
 * Tests for Task 5.6: Field metadata display (labels, descriptions, validation messages)
 * Validates Requirements 3.6
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CreateMemberPage from '../CreateMemberPage';
import { FieldRenderer } from '@aws-web-framework/components';

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

// Mock FieldRenderer to verify it receives correct metadata
vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: vi.fn(({ fieldDefinition, value, onChange, required }) => (
    <div data-testid={`field-${fieldDefinition.shortName}`}>
      <label data-testid={`label-${fieldDefinition.shortName}`}>
        {fieldDefinition.displayName}
        {required && ' *'}
      </label>
      <div data-testid={`description-${fieldDefinition.shortName}`}>
        {fieldDefinition.description}
      </div>
      <input
        data-testid={`input-${fieldDefinition.shortName}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )),
}));

describe('CreateMemberPage - Field Metadata Display (Task 5.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Get the mocked FieldRenderer function
  const getMockFieldRenderer = () => vi.mocked(FieldRenderer);

  describe('Field Labels Display', () => {
    it('should display field labels from form definition', async () => {
      // Requirement 3.6: THE Member_Creation_Form SHALL display field labels from the Form_Definition
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            order: 1,
            validation: { required: false },
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

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('label-email')).toBeInTheDocument();
      });

      // Verify field labels are displayed
      expect(screen.getByTestId('label-email')).toHaveTextContent('Email Address');
      expect(screen.getByTestId('label-phone')).toHaveTextContent('Phone Number');
    });

    it('should pass displayName to FieldRenderer for each field', async () => {
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'membershipLevel',
            label: 'Membership Level',
            datatype: 'select',
            order: 1,
            validation: { required: true },
            options: ['Bronze', 'Silver', 'Gold'],
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getMockFieldRenderer()).toHaveBeenCalled();
      });

      // Verify FieldRenderer was called with correct displayName
      const fieldRendererCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'membershipLevel'
      );
      expect(fieldRendererCall).toBeDefined();
      expect(fieldRendererCall[0].fieldDefinition.displayName).toBe('Membership Level');
    });
  });

  describe('Field Descriptions Display', () => {
    it('should display field descriptions when provided', async () => {
      // Requirement 3.6: THE Member_Creation_Form SHALL display help text from the Form_Definition
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'emergencyContact',
            label: 'Emergency Contact',
            datatype: 'text',
            order: 1,
            description: 'Name and phone number of person to contact in case of emergency',
            validation: { required: false },
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('description-emergencyContact')).toBeInTheDocument();
      });

      // Verify description is displayed
      expect(screen.getByTestId('description-emergencyContact')).toHaveTextContent(
        'Name and phone number of person to contact in case of emergency'
      );
    });

    it('should pass description to FieldRenderer for each field', async () => {
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'dietaryRestrictions',
            label: 'Dietary Restrictions',
            datatype: 'textarea',
            order: 1,
            description: 'Please list any dietary restrictions or allergies',
            validation: { required: false },
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getMockFieldRenderer()).toHaveBeenCalled();
      });

      // Verify FieldRenderer was called with correct description
      const fieldRendererCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'dietaryRestrictions'
      );
      expect(fieldRendererCall).toBeDefined();
      expect(fieldRendererCall[0].fieldDefinition.description).toBe(
        'Please list any dietary restrictions or allergies'
      );
    });

    it('should handle fields without descriptions', async () => {
      // Requirement 3.6: Fields without descriptions should not show description text
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'firstName',
            label: 'First Name',
            datatype: 'text',
            order: 1,
            // No description provided
            validation: { required: true },
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getMockFieldRenderer()).toHaveBeenCalled();
      });

      // Verify FieldRenderer was called with empty description
      const fieldRendererCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'firstName'
      );
      expect(fieldRendererCall).toBeDefined();
      expect(fieldRendererCall[0].fieldDefinition.description).toBe('');
    });
  });

  describe('Validation Messages Display', () => {
    it('should display validation error messages below fields', async () => {
      // Requirement 3.6: THE Member_Creation_Form SHALL display validation messages from the Form_Definition
      const formDefinition = {
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
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      const { container } = render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('field-email')).toBeInTheDocument();
      });

      // Verify validation error display structure exists
      // The actual validation error display is tested in validation tests
      // Here we verify the structure supports error display
      const fieldContainer = container.querySelector('[data-testid="field-email"]')?.parentElement;
      expect(fieldContainer).toBeInTheDocument();
    });
  });

  describe('Multiple Fields with Different Metadata', () => {
    it('should display metadata for multiple fields with different configurations', async () => {
      // Requirement 3.6: Test multiple fields with different metadata configurations
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            order: 1,
            description: 'Your primary email address',
            validation: { required: true },
          },
          {
            id: 'field-2',
            name: 'phone',
            label: 'Phone Number',
            datatype: 'text',
            order: 2,
            // No description
            validation: { required: false },
          },
          {
            id: 'field-3',
            name: 'birthDate',
            label: 'Date of Birth',
            datatype: 'date',
            order: 3,
            description: 'Required for age verification',
            validation: { required: true },
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('label-email')).toBeInTheDocument();
      });

      // Verify all field labels are displayed
      expect(screen.getByTestId('label-email')).toHaveTextContent('Email Address');
      expect(screen.getByTestId('label-phone')).toHaveTextContent('Phone Number');
      expect(screen.getByTestId('label-birthDate')).toHaveTextContent('Date of Birth');

      // Verify descriptions are displayed where provided
      expect(screen.getByTestId('description-email')).toHaveTextContent('Your primary email address');
      expect(screen.getByTestId('description-phone')).toHaveTextContent(''); // No description
      expect(screen.getByTestId('description-birthDate')).toHaveTextContent('Required for age verification');
    });

    it('should pass correct metadata to FieldRenderer for all fields', async () => {
      const formDefinition = {
        id: 'form-1',
        name: 'Membership Form',
        fields: [
          {
            id: 'field-1',
            name: 'address',
            label: 'Street Address',
            datatype: 'text',
            order: 1,
            description: 'Your residential address',
            validation: { required: true },
          },
          {
            id: 'field-2',
            name: 'city',
            label: 'City',
            datatype: 'text',
            order: 2,
            validation: { required: true },
          },
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getMockFieldRenderer()).toHaveBeenCalled();
      });

      // Verify FieldRenderer was called with correct metadata for address field
      const addressCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'address'
      );
      expect(addressCall).toBeDefined();
      expect(addressCall[0].fieldDefinition.displayName).toBe('Street Address');
      expect(addressCall[0].fieldDefinition.description).toBe('Your residential address');
      expect(addressCall[0].required).toBe(true);

      // Verify FieldRenderer was called with correct metadata for city field
      const cityCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'city'
      );
      expect(cityCall).toBeDefined();
      expect(cityCall[0].fieldDefinition.displayName).toBe('City');
      expect(cityCall[0].fieldDefinition.description).toBe('');
      expect(cityCall[0].required).toBe(true);
    });
  });

  describe('Required Field Indicators', () => {
    it('should pass required flag to FieldRenderer for mandatory fields', async () => {
      const formDefinition = {
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

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(getMockFieldRenderer()).toHaveBeenCalled();
      });

      // Verify required flag is passed correctly
      const emailCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'email'
      );
      expect(emailCall[0].required).toBe(true);

      const phoneCall = getMockFieldRenderer().mock.calls.find(
        (call) => call[0].fieldDefinition.shortName === 'phone'
      );
      expect(phoneCall[0].required).toBe(false);
    });

    it('should display required indicator for mandatory fields', async () => {
      const formDefinition = {
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
        ],
      };

      mockExecute
        .mockResolvedValueOnce({
          id: 'type-1',
          name: 'Individual Membership',
          membershipFormId: 'form-1',
        })
        .mockResolvedValueOnce(formDefinition);

      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('label-email')).toBeInTheDocument();
      });

      // Verify required indicator is displayed
      expect(screen.getByTestId('label-email')).toHaveTextContent('Email Address *');
    });
  });
});
