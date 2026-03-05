/**
 * CreateMemberPage Name Field Tests
 * 
 * Tests for Task 5.3: Name field rendering and validation
 * Validates Requirements 3.2
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('CreateMemberPage - Name Field (Task 5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock responses
    mockExecute
      .mockResolvedValueOnce({
        id: 'type-1',
        name: 'Individual Membership',
        membershipFormId: 'form-1',
      })
      .mockResolvedValueOnce({
        id: 'form-1',
        name: 'Membership Form',
        fields: [],
      });
  });

  describe('Name Field Rendering', () => {
    it('should render name field correctly', async () => {
      // Requirement 3.2: THE Member_Creation_Form SHALL include a mandatory Name field
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      const nameField = screen.getByTestId('name-field');
      expect(nameField).toBeVisible();
    });

    it('should render name field with correct label', async () => {
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
      });
    });

    it('should mark name field as required', async () => {
      // Requirement 3.2: Mandatory Name field
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
      expect(nameInput.required).toBe(true);
    });

    it('should render name field above dynamic form fields placeholder', async () => {
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      const nameField = screen.getByTestId('name-field');
      
      // Name field should be rendered
      expect(nameField).toBeInTheDocument();
      
      // Since the mock form definition has no fields, there should be no dynamic fields rendered
      // The name field should be the only input field visible
      const textFields = screen.getAllByRole('textbox');
      expect(textFields).toHaveLength(1); // Only the name field
    });
  });

  describe('Name Field State Management', () => {
    it('should update formData when name field changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
      
      await user.type(nameInput, 'John Doe');
      
      expect(nameInput.value).toBe('John Doe');
    });

    it('should clear validation error when user starts typing', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
      const submitButton = screen.getByTestId('submit-button');
      
      // Trigger validation by submitting with empty name
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
      
      // Start typing - error should clear
      await user.type(nameInput, 'J');
      
      await waitFor(() => {
        expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
      });
    });

    it('should preserve name value when navigating between fields', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
      
      await user.type(nameInput, 'Jane Smith');
      await user.tab(); // Move focus away
      
      expect(nameInput.value).toBe('Jane Smith');
    });
  });

  describe('Name Field Validation - Required', () => {
    it('should show validation error for empty name on blur', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      
      // Focus and blur without entering value
      await user.click(nameInput);
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty name on submit', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('submit-button');
      
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for whitespace-only name', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      
      await user.type(nameInput, '   ');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
    });

    it('should not show validation error for valid name', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      
      await user.type(nameInput, 'Valid Name');
      await user.tab();
      
      // Wait a bit to ensure no error appears
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
    });
  });

  describe('Name Field Validation - Length', () => {
    it('should accept name with minimum length (1 character)', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      
      await user.type(nameInput, 'A');
      await user.tab();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(screen.queryByText(/Name must be at least/i)).not.toBeInTheDocument();
    });

    it('should show validation error for name exceeding max length (255 characters)', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      const longName = 'A'.repeat(256); // 256 characters
      
      await user.type(nameInput, longName);
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/Name must not exceed 255 characters/i)).toBeInTheDocument();
      });
    });

    it('should accept name at max length (255 characters)', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      const maxLengthName = 'A'.repeat(255); // Exactly 255 characters
      
      await user.type(nameInput, maxLengthName);
      await user.tab();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(screen.queryByText(/Name must not exceed/i)).not.toBeInTheDocument();
    });
  });

  describe('Name Field Validation Display', () => {
    it('should display validation error as helper text', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('submit-button');
      
      await user.click(submitButton);
      
      await waitFor(() => {
        const errorText = screen.getByText(/Name is required/i);
        expect(errorText).toBeInTheDocument();
        // Helper text should be associated with the field
        expect(errorText.tagName.toLowerCase()).toBe('p');
      });
    });

    it('should show error state with red border when invalid', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-field')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('submit-button');
      
      await user.click(submitButton);
      
      await waitFor(() => {
        const nameInput = screen.getByTestId('name-input');
        // MUI TextField with error prop adds aria-invalid attribute
        expect(nameInput.getAttribute('aria-invalid')).toBe('true');
      });
    });

    it('should remove error state when validation passes', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      const submitButton = screen.getByTestId('submit-button');
      
      // Trigger validation error
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
      
      // Fix the error
      await user.type(nameInput, 'Valid Name');
      
      await waitFor(() => {
        expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Name Field Validation Timing', () => {
    it('should validate on blur', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      
      // Focus the field
      await user.click(nameInput);
      
      // No error yet
      expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
      
      // Blur the field
      await user.tab();
      
      // Error should appear after blur
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
    });

    it('should validate on submit attempt', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      // No error initially
      expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);
      
      // Error should appear after submit attempt
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
    });

    it('should not validate on initial render', async () => {
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      // No validation error should be shown initially
      expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
    });
  });

  describe('Name Field Integration with Form Submission', () => {
    it('should prevent form submission when name is invalid', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('submit-button');
      
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
      
      // Form should not be submitted (no additional API calls beyond initial load)
      expect(mockExecute).toHaveBeenCalledTimes(2); // Only initial load calls
    });

    it('should allow form submission when name is valid', async () => {
      const user = userEvent.setup();
      
      render(
        <MemoryRouter initialEntries={['/members/create?typeId=type-1']}>
          <CreateMemberPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-input');
      const submitButton = screen.getByTestId('submit-button');
      
      await user.type(nameInput, 'John Doe');
      await user.click(submitButton);
      
      // No validation error should appear
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
    });
  });
});
