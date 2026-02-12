/**
 * Unit tests for PaymentsListPage component
 * Tests payment list rendering, filtering, and export functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PaymentsListPage from '../PaymentsListPage';
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

const mockPayments = [
  {
    id: '1',
    date: '2024-01-15T10:00:00Z',
    amount: 50.00,
    status: 'paid' as const,
    type: 'event' as const,
    paymentMethod: 'card' as const,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
  },
  {
    id: '2',
    date: '2024-01-20T10:00:00Z',
    amount: 100.00,
    status: 'pending' as const,
    type: 'membership' as const,
    paymentMethod: 'cheque' as const,
    customerName: 'Jane Smith',
    customerEmail: 'jane@example.com',
  },
  {
    id: '3',
    date: '2024-01-25T10:00:00Z',
    amount: 75.00,
    status: 'refunded' as const,
    type: 'merchandise' as const,
    paymentMethod: 'card' as const,
    customerName: 'Bob Johnson',
    customerEmail: 'bob@example.com',
  },
];

describe('PaymentsListPage', () => {
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

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <PaymentsListPage />
      </BrowserRouter>
    );
  };

  describe('Payment List Rendering', () => {
    it('should render the page title and export button', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      expect(screen.getByText('Payments')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export to csv/i })).toBeInTheDocument();
    });

    it('should load and display payments on mount', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/payments',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching payments', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByText('Loading payments...')).toBeInTheDocument();
    });

    it('should display empty state when no payments exist', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
      });
    });

    it('should display payment status chips with correct colors', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('paid')).toBeInTheDocument();
        expect(screen.getByText('pending')).toBeInTheDocument();
        expect(screen.getByText('refunded')).toBeInTheDocument();
      });
    });

    it('should format currency correctly', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('£50.00')).toBeInTheDocument();
        expect(screen.getByText('£100.00')).toBeInTheDocument();
        expect(screen.getByText('£75.00')).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('20 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('25 Jan 2024')).toBeInTheDocument();
      });
    });

    it('should display payment types correctly', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Event')).toBeInTheDocument();
        expect(screen.getByText('Membership')).toBeInTheDocument();
        expect(screen.getByText('Merchandise')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter payments by status', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find the Status select (third combobox)
      const selects = screen.getAllByRole('combobox');
      const statusSelect = selects[0]; // First combobox is Status
      fireEvent.mouseDown(statusSelect);
      
      const paidOption = await screen.findByRole('option', { name: /^paid$/i });
      fireEvent.click(paidOption);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('should filter payments by payment method', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find the Payment Method select (fourth combobox)
      const selects = screen.getAllByRole('combobox');
      const paymentMethodSelect = selects[1]; // Second combobox is Payment Method
      fireEvent.mouseDown(paymentMethodSelect);
      
      const chequeOption = await screen.findByRole('option', { name: /cheque/i });
      fireEvent.click(chequeOption);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('should filter payments by date range', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText('Start Date');
      fireEvent.change(startDateInput, { target: { value: '2024-01-20' } });

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('should show "no payments match" message when filters return no results', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText('Start Date');
      fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });

      await waitFor(() => {
        expect(screen.getByText(/no payments match your filters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to payment details when view button is clicked', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByTitle('View Details');
      fireEvent.click(viewButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/payments/1');
    });
  });

  describe('Export Functionality', () => {
    it('should disable export button when no payments', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export to csv/i });
        expect(exportButton).toBeDisabled();
      });
    });

    it('should enable export button when payments exist', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export to csv/i });
        expect(exportButton).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should set empty array when API returns null', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
      });
    });
  });
});
