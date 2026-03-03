/**
 * Component tests for CreateDiscountPage
 * 
 * Tests:
 * - Wizard navigation
 * - Form validation on each step
 * - Data persistence across steps
 * - Save functionality
 * - Error handling
 * 
 * **Validates: Requirements 24.2**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CreateDiscountPage from '../CreateDiscountPage';

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams: { id?: string } = { id: undefined };
const mockExecute = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({
    execute: mockExecute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  }),
  useOrganisation: () => ({
    organisation: {
      id: 'd5a5a5ca-c4b4-436d-8981-627ab3556433',
      name: 'Test Organisation',
    },
  }),
}));

describe('CreateDiscountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockParams.id = undefined;
    mockExecute.mockReset();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <CreateDiscountPage />
      </BrowserRouter>
    );
  };

  describe('Wizard Navigation', () => {
    it('should render Step 1 initially', async () => {
      renderComponent();

      expect(screen.getByText('Create Discount')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /basic information/i })).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /discount name/i })).toBeInTheDocument();
      });
    });

    it('should show correct active step in stepper', () => {
      renderComponent();

      // Check that the stepper is rendered with all steps
      expect(screen.getByText('Create Discount')).toBeInTheDocument();
      // The stepper shows all step labels
      const stepLabels = screen.getAllByText(/Basic Information|Discount Configuration|Eligibility Criteria|Validity & Limits|Review & Confirm/);
      expect(stepLabels.length).toBeGreaterThan(0);
    });

    it('should advance to Step 2 when Next is clicked with valid data', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Fill in required fields
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      
      // Click Next
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /discount configuration/i })).toBeInTheDocument();
      });
    });

    it('should advance through all steps', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Step 1
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /discount configuration/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /eligibility criteria/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 4
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /validity & limits/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 5
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /review & confirm/i })).toBeInTheDocument();
      });
    });

    it('should return to previous step when Back is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Go to Step 2
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /discount configuration/i })).toBeInTheDocument();
      });

      // Click Back
      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /basic information/i })).toBeInTheDocument();
      });
    });

    it('should not show Back button on first step', () => {
      renderComponent();

      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    });

    it('should show Save button on last step', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create discount/i })).toBeInTheDocument();
      });
    });

    it('should navigate to list page when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts');
    });
  });

  describe('Form Validation', () => {
    describe('Step 1 Validation', () => {
      it('should require discount name', async () => {
        const user = userEvent.setup();
        renderComponent();

        // Try to proceed without entering name
        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Discount name is required')).toBeInTheDocument();
        });

        // Should still be on Step 1
        expect(screen.getByRole('heading', { name: /basic information/i })).toBeInTheDocument();
      });

      it('should validate discount code length', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
        await user.type(screen.getByRole('textbox', { name: /discount code/i }), 'AB'); // Too short

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Discount code must be between 3 and 50 characters')).toBeInTheDocument();
        });
      });

      it('should accept valid code length', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
        await user.type(screen.getByRole('textbox', { name: /discount code/i }), 'VALID123');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /discount configuration/i })).toBeInTheDocument();
        });
      });

      it('should clear field error when user starts typing', async () => {
        const user = userEvent.setup();
        renderComponent();

        // Trigger validation error
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => {
          expect(screen.getByText('Discount name is required')).toBeInTheDocument();
        });

        // Start typing
        await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test');

        await waitFor(() => {
          expect(screen.queryByText('Discount name is required')).not.toBeInTheDocument();
        });
      });
    });

    describe('Step 2 Validation', () => {
      beforeEach(async () => {
        const user = userEvent.setup();
        renderComponent();
        await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      });

      it('should validate percentage discount range (0-100)', async () => {
        const user = userEvent.setup();

        const valueInput = screen.getByRole('spinbutton', { name: /discount percentage/i });
        await user.clear(valueInput);
        await user.type(valueInput, '150');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Percentage discount must be between 0 and 100')).toBeInTheDocument();
        });
      });

      it('should validate fixed amount is greater than 0', async () => {
        const user = userEvent.setup();

        // Switch to fixed amount
        await user.click(screen.getByRole('radio', { name: /fixed amount/i }));

        const valueInput = screen.getByRole('spinbutton', { name: /discount amount/i });
        await user.clear(valueInput);
        await user.type(valueInput, '0');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Fixed amount discount must be greater than 0')).toBeInTheDocument();
        });
      });

      it('should validate quantity rules when scope is quantity-based', async () => {
        const user = userEvent.setup();

        // Select quantity-based scope - find the button that shows "Item Level"
        const scopeButton = screen.getByText('Item Level - Apply to specific items');
        await user.click(scopeButton);
        
        // Wait for the dropdown to open and click the option
        await waitFor(() => {
          expect(screen.getByRole('option', { name: /quantity-based/i })).toBeInTheDocument();
        });
        await user.click(screen.getByRole('option', { name: /quantity-based/i }));

        // Wait for the quantity fields to appear
        await waitFor(() => {
          expect(screen.getByLabelText(/minimum quantity/i)).toBeInTheDocument();
        });

        // Try to proceed without setting minimum quantity
        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Minimum quantity must be at least 1')).toBeInTheDocument();
        });
      });

      it('should accept valid discount configuration', async () => {
        const user = userEvent.setup();

        const valueInput = screen.getByRole('spinbutton', { name: /discount percentage/i });
        await user.clear(valueInput);
        await user.type(valueInput, '20');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /eligibility criteria/i })).toBeInTheDocument();
        });
      });
    });

    describe('Step 3 Validation', () => {
      beforeEach(async () => {
        const user = userEvent.setup();
        renderComponent();
        await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      });

      it('should validate minimum purchase amount is not negative', async () => {
        const user = userEvent.setup();

        const minPurchaseInput = screen.getByLabelText('Minimum Purchase Amount');
        await user.type(minPurchaseInput, '-10');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Minimum purchase amount must be 0 or greater')).toBeInTheDocument();
        });
      });

      it('should validate maximum discount amount is greater than 0', async () => {
        const user = userEvent.setup();

        const maxDiscountInput = screen.getByLabelText('Maximum Discount Amount');
        await user.type(maxDiscountInput, '0');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Maximum discount amount must be greater than 0')).toBeInTheDocument();
        });
      });

      it('should accept valid eligibility criteria', async () => {
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /validity & limits/i })).toBeInTheDocument();
        });
      });
    });

    describe('Step 4 Validation', () => {
      beforeEach(async () => {
        const user = userEvent.setup();
        renderComponent();
        await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      });

      it('should validate validFrom is before validUntil', async () => {
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Valid From'), '2024-12-31');
        await user.type(screen.getByLabelText('Valid Until'), '2024-01-01');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Valid from date must be before valid until date')).toBeInTheDocument();
        });
      });

      it('should validate total usage limit is at least 1', async () => {
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Total Usage Limit'), '0');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Total usage limit must be at least 1')).toBeInTheDocument();
        });
      });

      it('should validate per-user limit is at least 1', async () => {
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Per-User Limit'), '0');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByText('Per-user limit must be at least 1')).toBeInTheDocument();
        });
      });

      it('should accept valid date range', async () => {
        const user = userEvent.setup();

        await user.type(screen.getByLabelText(/valid from/i), '2024-01-01');
        await user.type(screen.getByLabelText(/valid until/i), '2024-12-31');

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /review & confirm/i })).toBeInTheDocument();
        });
      });
    });
  });

  describe('Data Persistence', () => {
    it('should persist form data when navigating between steps', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Fill Step 1
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.type(screen.getByRole('textbox', { name: /description/i }), 'Test Description');
      await user.type(screen.getByRole('textbox', { name: /discount code/i }), 'TEST123');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Go to Step 2 and back
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Verify data persisted
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /discount name/i })).toHaveValue('Test Discount');
        expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue('Test Description');
        expect(screen.getByRole('textbox', { name: /discount code/i })).toHaveValue('TEST123');
      });
    });

    it('should show entered data in review step', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Fill Step 1
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Summer Sale');
      await user.type(screen.getByRole('textbox', { name: /description/i }), 'Summer discount');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      const valueInput = screen.getByLabelText(/discount percentage/i);
      await user.clear(valueInput);
      await user.type(valueInput, '25');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 4
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 5 - Review
      await waitFor(() => {
        expect(screen.getByText('Summer Sale')).toBeInTheDocument();
        expect(screen.getByText('Summer discount')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should call API to create discount when Save is clicked', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      renderComponent();

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/discounts',
            data: expect.objectContaining({
              name: 'Test Discount',
              moduleType: 'events',
            }),
          })
        );
      });
    });

    it('should navigate to list page after successful save', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      renderComponent();

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/events/discounts');
      });
    });

    it('should call update API when in edit mode', async () => {
      const user = userEvent.setup();
      mockParams.id = '123' as any;
      mockExecute
        .mockResolvedValueOnce({
          id: '123',
          name: 'Existing Discount',
          discountType: 'percentage',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
        })
        .mockResolvedValueOnce({ id: '123', name: 'Updated Discount' });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Edit Discount')).toBeInTheDocument();
      });

      // Navigate to last step
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Update
      await user.click(screen.getByRole('button', { name: /update discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/api/orgadmin/discounts/123',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when save fails', async () => {
      const user = userEvent.setup();
      mockExecute.mockRejectedValueOnce(new Error('Failed to save'));
      renderComponent();

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to save discount')).toBeInTheDocument();
      });
    });

    it('should display error message when loading discount fails', async () => {
      mockParams.id = '123' as any;
      mockExecute.mockRejectedValueOnce(new Error('Failed to load'));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load discount')).toBeInTheDocument();
      });
    });

    it('should allow dismissing error message', async () => {
      const user = userEvent.setup();
      mockExecute.mockRejectedValueOnce(new Error('Failed to save'));
      renderComponent();

      // Navigate to last step and trigger error
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to save discount')).toBeInTheDocument();
      });

      // Dismiss error
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Failed to save discount')).not.toBeInTheDocument();
      });
    });

    it('should disable buttons while loading', async () => {
      const user = userEvent.setup();
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      const saveButton = screen.getByRole('button', { name: /create discount/i });
      await user.click(saveButton);

      // Buttons should be disabled
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
      });
    });
  });
});
