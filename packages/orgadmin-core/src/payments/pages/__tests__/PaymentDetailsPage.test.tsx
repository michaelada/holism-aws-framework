/**
 * Unit tests for PaymentDetailsPage component
 * Tests payment details rendering and refund flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PaymentDetailsPage from '../PaymentDetailsPage';
import * as useApiModule from '../../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockPayment = {
  id: '1',
  date: '2024-01-15T10:00:00Z',
  amount: 50.00,
  status: 'paid' as const,
  type: 'event' as const,
  paymentMethod: 'card' as const,
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerPhone: '+44 1234 567890',
  transactionId: 'txn_123456789',
  relatedTransaction: {
    id: 'evt_001',
    name: 'Summer Festival 2024',
    type: 'Event',
  },
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const mockRefundedPayment = {
  ...mockPayment,
  id: '2',
  status: 'refunded' as const,
  refundReason: 'Customer requested cancellation',
  refundedAt: '2024-01-20T10:00:00Z',
};

describe('PaymentDetailsPage', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Setup default mock implementation
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const renderComponent = (paymentId = '1') => {
    return render(
      <BrowserRouter>
        <Routes>
          <Route path="/payments/:id" element={<PaymentDetailsPage />} />
        </Routes>
      </BrowserRouter>,
      { wrapper: ({ children }) => <div>{children}</div> }
    );
  };

  describe('Payment Details Rendering', () => {
    it('should render the page title and back button', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      // Navigate to the payment details page
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment Details')).toBeInTheDocument();
      });
    });

    it('should load and display payment details on mount', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/payments/1',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('£50.00')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching payment', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      expect(screen.getByText('Loading payment details...')).toBeInTheDocument();
    });

    it('should display not found message when payment does not exist', async () => {
      mockExecute.mockResolvedValue(null);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment not found')).toBeInTheDocument();
      });
    });

    it('should display payment information correctly', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment Information')).toBeInTheDocument();
        expect(screen.getByText('£50.00')).toBeInTheDocument();
        expect(screen.getByText('paid')).toBeInTheDocument();
        expect(screen.getByText('card')).toBeInTheDocument();
        expect(screen.getByText('txn_123456789')).toBeInTheDocument();
      });
    });

    it('should display customer information correctly', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Customer Information')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('+44 1234 567890')).toBeInTheDocument();
      });
    });

    it('should display related transaction information', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Related Transaction')).toBeInTheDocument();
        expect(screen.getByText('Event')).toBeInTheDocument();
        expect(screen.getByText('Summer Festival 2024')).toBeInTheDocument();
        expect(screen.getByText('evt_001')).toBeInTheDocument();
      });
    });

    it('should display refund information for refunded payments', async () => {
      mockExecute.mockResolvedValue(mockRefundedPayment);
      
      window.history.pushState({}, '', '/payments/2');
      renderComponent('2');

      await waitFor(() => {
        expect(screen.getByText('Refund Information')).toBeInTheDocument();
        expect(screen.getByText('Customer requested cancellation')).toBeInTheDocument();
      });
    });
  });

  describe('Refund Flow', () => {
    it('should show refund button for paid payments', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /request refund/i })).toBeInTheDocument();
      });
    });

    it('should not show refund button for refunded payments', async () => {
      mockExecute.mockResolvedValue(mockRefundedPayment);
      
      window.history.pushState({}, '', '/payments/2');
      renderComponent('2');

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /request refund/i })).not.toBeInTheDocument();
      });
    });

    it('should open refund dialog when refund button is clicked', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to refund/i)).toBeInTheDocument();
      });
    });

    it('should disable confirm button when refund reason is empty', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
        expect(confirmButton).toBeDisabled();
      });
    });

    it('should enable confirm button when refund reason is provided', async () => {
      mockExecute.mockResolvedValue(mockPayment);
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText('Refund Reason');
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
        expect(confirmButton).not.toBeDisabled();
      });
    });

    it('should call refund API when confirm is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce(mockPayment) // Initial load
        .mockResolvedValueOnce({}) // Refund request
        .mockResolvedValueOnce(mockRefundedPayment); // Reload after refund
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText('Refund Reason');
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/payments/1/refund',
          data: {
            reason: 'Customer request',
          },
        });
      });
    });

    it('should close dialog after successful refund', async () => {
      mockExecute
        .mockResolvedValueOnce(mockPayment) // Initial load
        .mockResolvedValueOnce({}) // Refund request
        .mockResolvedValueOnce(mockRefundedPayment); // Reload after refund
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText('Refund Reason');
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText(/are you sure you want to refund/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment not found')).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle refund errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute
        .mockResolvedValueOnce(mockPayment) // Initial load
        .mockRejectedValueOnce(new Error('Refund failed')); // Refund request fails
      
      window.history.pushState({}, '', '/payments/1');
      renderComponent();

      await waitFor(() => {
        const refundButton = screen.getByRole('button', { name: /request refund/i });
        fireEvent.click(refundButton);
      });

      const reasonInput = screen.getByLabelText('Refund Reason');
      fireEvent.change(reasonInput, { target: { value: 'Customer request' } });

      const confirmButton = screen.getByRole('button', { name: /confirm refund/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
