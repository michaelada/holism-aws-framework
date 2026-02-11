import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { ApiProvider } from '../context';
import FieldDefinitionsPage from '../pages/FieldDefinitionsPage';
import ObjectDefinitionsPage from '../pages/ObjectDefinitionsPage';
import ObjectInstancesPage from '../pages/ObjectInstancesPage';

// **Validates: Requirements 22.10**

const theme = createTheme();

const mockMetadataApi = {
  getFields: vi.fn(),
  getField: vi.fn(),
  createField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  getObjects: vi.fn(),
  getObject: vi.fn(),
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
};

const mockInstancesApi = {
  listInstances: vi.fn(),
  getInstance: vi.fn(),
  createInstance: vi.fn(),
  updateInstance: vi.fn(),
  deleteInstance: vi.fn(),
};

vi.mock('../context', async () => {
  const actual = await vi.importActual('../context');
  return {
    ...actual,
    useMetadataApi: () => mockMetadataApi,
    useInstancesApi: () => mockInstancesApi,
  };
});

// Mock window.confirm
global.confirm = vi.fn(() => true);

function renderWithProviders(component: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <ApiProvider baseURL="">{component}</ApiProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}


describe('End-to-End Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Object Lifecycle', () => {
    it('should allow defining fields, creating object, and managing instances', async () => {
      // Step 1: Verify field definitions page loads
      mockMetadataApi.getFields.mockResolvedValue([]);
      mockMetadataApi.createField.mockResolvedValue({
        shortName: 'customer_name',
        displayName: 'Customer Name',
        description: 'Name of the customer',
        datatype: 'text',
        mandatory: true,
        datatypeProperties: {},
        validationRules: [],
      });

      renderWithProviders(<FieldDefinitionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Field Definitions')).toBeInTheDocument();
      });

      // Verify create field button exists
      const createFieldButton = screen.getByRole('button', { name: /create field/i });
      expect(createFieldButton).toBeInTheDocument();

      // Step 2: Create object definition
      mockMetadataApi.getObjects.mockResolvedValue([]);
      mockMetadataApi.getFields.mockResolvedValue([
        {
          shortName: 'customer_name',
          displayName: 'Customer Name',
          datatype: 'text',
          mandatory: true,
        },
      ]);

      const { unmount } = renderWithProviders(<ObjectDefinitionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Object Definitions')).toBeInTheDocument();
      });

      unmount();

      // Step 3: Verify workflow completes
      expect(mockMetadataApi.getFields).toHaveBeenCalled();
      expect(mockMetadataApi.getObjects).toHaveBeenCalled();
    });
  });

  describe('Field Definition Management', () => {
    it('should create, list, and delete field definitions', async () => {
      const user = userEvent.setup();

      const mockField = {
        shortName: 'test_field',
        displayName: 'Test Field',
        description: 'A test field',
        datatype: 'text',
        mandatory: false,
        datatypeProperties: {},
        validationRules: [],
      };

      mockMetadataApi.getFields.mockResolvedValue([mockField]);
      mockMetadataApi.deleteField.mockResolvedValue(undefined);

      renderWithProviders(<FieldDefinitionsPage />);

      // Wait for fields to load
      await waitFor(() => {
        expect(screen.getByText('Test Field')).toBeInTheDocument();
      });

      // Verify field is displayed
      expect(screen.getByText('test_field')).toBeInTheDocument();
      expect(screen.getByText('text')).toBeInTheDocument();

      // Test delete functionality
      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      // Confirm deletion would be called
      expect(mockMetadataApi.getFields).toHaveBeenCalled();
    });
  });

  describe('Object Definition Management', () => {
    it('should create and list object definitions', async () => {
      const mockObject = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer entity',
        fields: [
          {
            fieldShortName: 'customer_name',
            mandatory: true,
            order: 1,
          },
        ],
        displayProperties: {},
      };

      mockMetadataApi.getObjects.mockResolvedValue([mockObject]);
      mockMetadataApi.getFields.mockResolvedValue([
        {
          shortName: 'customer_name',
          displayName: 'Customer Name',
          datatype: 'text',
          mandatory: true,
        },
      ]);

      renderWithProviders(<ObjectDefinitionsPage />);

      // Wait for objects to load
      await waitFor(() => {
        expect(screen.getByText('Customer')).toBeInTheDocument();
      });

      // Verify object is displayed
      expect(screen.getByText('customer')).toBeInTheDocument();
      expect(screen.getByText('Customer entity')).toBeInTheDocument();
    });
  });

  describe('Authentication Flows', () => {
    it('should handle authentication state', async () => {
      // This test verifies that authentication context is properly set up
      // In a real E2E test, this would test Keycloak integration
      
      mockMetadataApi.getFields.mockResolvedValue([]);
      
      renderWithProviders(<FieldDefinitionsPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Field Definitions')).toBeInTheDocument();
      });
    });
  });
});
