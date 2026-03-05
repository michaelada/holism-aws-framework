/**
 * Example Test for Existing Document Field Without Capability
 * 
 * Feature: document-management-capability-consolidation
 * 
 * This test validates Requirement 5.3: When an organization has existing document upload
 * fields but does NOT have document-management capability after migration, the EditFieldPage
 * should allow viewing the field but prevent changing the datatype.
 * 
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import EditFieldPage from '../EditFieldPage';

// Mock dependencies
const mockExecute = vi.fn();
const mockNavigate = vi.fn();
const mockHasCapability = vi.fn();

vi.mock('../../../hooks/useApi', () => ({
  useApi: () => ({
    execute: mockExecute,
  }),
}));

vi.mock('../../../context/OrganisationContext', () => ({
  useOrganisation: () => ({
    organisation: {
      id: 'test-org-id',
      name: 'Test Organization',
    },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  useCapabilities: () => ({
    capabilities: [], // No capabilities
    loading: false,
    error: null,
    hasCapability: mockHasCapability,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFilteredFieldTypes', () => ({
  useFilteredFieldTypes: () => [
    // Without document-management capability, file and image are filtered out
    'text',
    'textarea',
    'number',
    'email',
    'phone',
    'date',
    'time',
    'datetime',
    'boolean',
    'select',
    'multiselect',
    'radio',
    'checkbox',
  ],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'existing-file-field-id' }),
    useNavigate: () => mockNavigate,
  };
});

describe('Feature: document-management-capability-consolidation - Requirement 5.3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Organization does NOT have document-management capability
    mockHasCapability.mockReturnValue(false);
  });

  describe('Example: Organization with existing file field but no document-management capability', () => {
    it('should allow viewing the existing file field', async () => {
      // Arrange: Mock API to return an existing file field
      mockExecute.mockResolvedValueOnce({
        id: 'existing-file-field-id',
        label: 'Upload Document',
        description: 'Please upload your document',
        datatype: 'file',
        options: [],
      });

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Page should load and display the field data
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify field label is displayed
      const labelInput = screen.getByLabelText(/fieldLabel/i);
      expect(labelInput).toHaveValue('Upload Document');

      // Verify field description is displayed
      const descriptionInput = screen.getByLabelText(/fieldDescription/i);
      expect(descriptionInput).toHaveValue('Please upload your document');
    });

    it('should display a warning message that datatype cannot be changed', async () => {
      // Arrange: Mock API to return an existing file field
      mockExecute.mockResolvedValueOnce({
        id: 'existing-file-field-id',
        label: 'Upload Document',
        description: 'Please upload your document',
        datatype: 'file',
        options: [],
      });

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Wait for page to load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify warning message is displayed (this is the key indicator)
      const warningMessage = screen.getByText(/datatypeLockedNoCapability/i);
      expect(warningMessage).toBeInTheDocument();
    });

    it('should still allow editing other field properties (label, description)', async () => {
      // Arrange: Mock API to return an existing file field
      mockExecute.mockResolvedValueOnce({
        id: 'existing-file-field-id',
        label: 'Upload Document',
        description: 'Please upload your document',
        datatype: 'file',
        options: [],
      });

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Wait for page to load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify label input is NOT disabled
      const labelInput = screen.getByLabelText(/fieldLabel/i);
      expect(labelInput).not.toBeDisabled();

      // Verify description input is NOT disabled
      const descriptionInput = screen.getByLabelText(/fieldDescription/i);
      expect(descriptionInput).not.toBeDisabled();
    });
  });

  describe('Example: Organization with existing image field but no document-management capability', () => {
    it('should allow viewing the existing image field', async () => {
      // Arrange: Mock API to return an existing image field
      mockExecute.mockResolvedValueOnce({
        id: 'existing-image-field-id',
        label: 'Profile Photo',
        description: 'Upload your profile photo',
        datatype: 'image',
        options: [],
      });

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Page should load and display the field data
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify field label is displayed
      const labelInput = screen.getByLabelText(/fieldLabel/i);
      expect(labelInput).toHaveValue('Profile Photo');

      // Verify field description is displayed
      const descriptionInput = screen.getByLabelText(/fieldDescription/i);
      expect(descriptionInput).toHaveValue('Upload your profile photo');
    });

    it('should display a warning message that datatype cannot be changed', async () => {
      // Arrange: Mock API to return an existing image field
      mockExecute.mockResolvedValueOnce({
        id: 'existing-image-field-id',
        label: 'Profile Photo',
        description: 'Upload your profile photo',
        datatype: 'image',
        options: [],
      });

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Wait for page to load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify warning message is displayed
      const warningMessage = screen.getByText(/datatypeLockedNoCapability/i);
      expect(warningMessage).toBeInTheDocument();
    });
  });

  describe('Example: Organization with existing non-document field and no document-management capability', () => {
    it('should allow full editing of non-document fields', async () => {
      // Arrange: Mock API to return an existing text field
      mockExecute.mockResolvedValueOnce({
        id: 'existing-text-field-id',
        label: 'Full Name',
        description: 'Enter your full name',
        datatype: 'text',
        options: [],
      });

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Wait for page to load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify no warning message is displayed for non-document fields
      expect(screen.queryByText(/datatypeLockedNoCapability/i)).not.toBeInTheDocument();

      // Verify all inputs are enabled
      expect(screen.getByLabelText(/fieldLabel/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/fieldDescription/i)).not.toBeDisabled();
    });
  });

  describe('Scenario: Migration preserves existing document fields', () => {
    it('should demonstrate that existing file fields remain accessible after migration', async () => {
      // This test demonstrates the scenario described in Requirement 5.3:
      // After migration, an organization may have existing document fields
      // but not have the document-management capability.
      // The system should preserve these fields and allow viewing them.

      // Arrange: Mock API to return an existing file field
      // This simulates a field that existed before the migration
      mockExecute.mockResolvedValueOnce({
        id: 'pre-migration-file-field',
        label: 'Legacy Document Upload',
        description: 'This field existed before capability consolidation',
        datatype: 'file',
        options: [],
      });

      // Organization does not have document-management capability
      mockHasCapability.mockReturnValue(false);

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Field should be viewable
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify field data is displayed
      expect(screen.getByLabelText(/fieldLabel/i)).toHaveValue('Legacy Document Upload');
      expect(screen.getByLabelText(/fieldDescription/i)).toHaveValue(
        'This field existed before capability consolidation'
      );

      // Verify datatype is locked (warning message is shown)
      expect(screen.getByText(/datatypeLockedNoCapability/i)).toBeInTheDocument();

      // Verify other properties can still be edited
      expect(screen.getByLabelText(/fieldLabel/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/fieldDescription/i)).not.toBeDisabled();
    });

    it('should demonstrate that existing image fields remain accessible after migration', async () => {
      // Arrange: Mock API to return an existing image field
      mockExecute.mockResolvedValueOnce({
        id: 'pre-migration-image-field',
        label: 'Legacy Photo Upload',
        description: 'This image field existed before capability consolidation',
        datatype: 'image',
        options: [],
      });

      // Organization does not have document-management capability
      mockHasCapability.mockReturnValue(false);

      // Act: Render the EditFieldPage
      render(
        <BrowserRouter>
          <EditFieldPage />
        </BrowserRouter>
      );

      // Assert: Field should be viewable
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Verify field data is displayed
      expect(screen.getByLabelText(/fieldLabel/i)).toHaveValue('Legacy Photo Upload');
      expect(screen.getByLabelText(/fieldDescription/i)).toHaveValue(
        'This image field existed before capability consolidation'
      );

      // Verify datatype is locked (warning message is shown)
      expect(screen.getByText(/datatypeLockedNoCapability/i)).toBeInTheDocument();
    });
  });
});
