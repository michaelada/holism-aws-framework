/**
 * Unit tests for LodgementsPage component
 * Tests lodgement history rendering and breakdown by payment method
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LodgementsPage from '../LodgementsPage';
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

const mockLodgements = [
  {
    id: '1',
    date: '2024-01-15T10:00:00Z',
    totalAmount: 500.00,
    cardAmount: 300.00,
    chequeAmount: 150.00,
    offlineAmount: 50.00,
    transactionCount: 10,
    status: 'completed' as const,
  },
  {
    id: '2',
    date: '2024-01-20T10:00:00Z',
    totalAmount: 750.00,
    cardAmount: 500.00,
    chequeAmount: 200.00,
    offlineAmount: 50.00,
    transactionCount: 15,
    status: 'completed' as const,
  },
  {
    id: '3',
    date: '2024-01-25T10:00:00Z',
    totalAmount: 400.00,
    cardAmount: 250.00,
    chequeAmount: 100.00,
    offlineAmount: 50.00,
    transactionCount: 8,
    status: 'pending' as const,
  },
];

describe('LodgementsPage', () => {
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
        <LodgementsPage />
      </BrowserRouter>
    );
  };

  describe('Lodgements Rendering', () => {
    it('should render the page title and back button', () => {
      mockExecute.mockResolvedValue({ lodgements: [] });
      renderComponent();

      expect(screen.getByText('Lodgements')).toBeInTheDocument();
    });

    it('should load and display lodgements on mount', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/payments/lodgements',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('20 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('25 Jan 2024')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching lodgements', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByText('Loading lodgements...')).toBeInTheDocument();
    });

    it('should display empty state when no lodgements exist', async () => {
      mockExecute.mockResolvedValue({ lodgements: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no lodgements yet/i)).toBeInTheDocument();
      });
    });

    it('should format currency correctly', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('£500.00')).toBeInTheDocument();
        expect(screen.getByText('£750.00')).toBeInTheDocument();
        expect(screen.getByText('£400.00')).toBeInTheDocument();
      });
    });

    it('should display transaction counts', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
      });
    });

    it('should display lodgement status', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        const completedStatuses = screen.getAllByText('completed');
        const pendingStatuses = screen.getAllByText('pending');
        
        expect(completedStatuses.length).toBeGreaterThan(0);
        expect(pendingStatuses.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total lodged summary', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Total Lodged')).toBeInTheDocument();
        expect(screen.getByText('£1,650.00')).toBeInTheDocument(); // 500 + 750 + 400
        expect(screen.getByText('3 lodgements')).toBeInTheDocument();
      });
    });

    it('should display card payments summary', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Card Payments')).toBeInTheDocument();
        expect(screen.getByText('£1,050.00')).toBeInTheDocument(); // 300 + 500 + 250
      });
    });

    it('should display cheque payments summary', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Cheque Payments')).toBeInTheDocument();
        expect(screen.getByText('£450.00')).toBeInTheDocument(); // 150 + 200 + 100
      });
    });

    it('should display offline payments summary', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Offline Payments')).toBeInTheDocument();
        expect(screen.getByText('£150.00')).toBeInTheDocument(); // 50 + 50 + 50
      });
    });

    it('should calculate percentages correctly', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        // Card: 1050/1650 = 63.6%
        expect(screen.getByText('63.6% of total')).toBeInTheDocument();
        // Cheque: 450/1650 = 27.3%
        expect(screen.getByText('27.3% of total')).toBeInTheDocument();
        // Offline: 150/1650 = 9.1%
        expect(screen.getByText('9.1% of total')).toBeInTheDocument();
      });
    });

    it('should handle zero total gracefully', async () => {
      mockExecute.mockResolvedValue({ lodgements: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('£0.00')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Method Breakdown', () => {
    it('should display breakdown for each lodgement', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        // First lodgement
        expect(screen.getByText('£300.00')).toBeInTheDocument(); // Card
        expect(screen.getByText('£150.00')).toBeInTheDocument(); // Cheque
        expect(screen.getByText('£50.00')).toBeInTheDocument(); // Offline
      });
    });

    it('should show all payment methods in table headers', async () => {
      mockExecute.mockResolvedValue({ lodgements: mockLodgements });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Card')).toBeInTheDocument();
        expect(screen.getByText('Cheque')).toBeInTheDocument();
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no lodgements yet/i)).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle missing lodgements array', async () => {
      mockExecute.mockResolvedValue({});
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no lodgements yet/i)).toBeInTheDocument();
      });
    });
  });
});
