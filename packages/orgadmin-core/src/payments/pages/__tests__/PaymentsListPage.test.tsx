/**
 * Unit tests for PaymentsListPage component
 * Tests payment list rendering, filtering, and export functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PaymentsListPage, { paymentKinds } from '../PaymentsListPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('@itsplainsailing/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));

// Shell hooks (translations, onboarding, page help, capabilities, locale)
// are mocked rather than provided — see test/orgadminShellMock.
vi.mock('@itsplainsailing/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

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

/*
 * Named the way the API names a payment.
 *
 * These fixtures used to carry `date`, `status`, `type` and `customerName` —
 * fields the endpoint has never returned. The page's interface claimed the same
 * shape, so the tests and the code agreed with each other and both disagreed
 * with the server: every row rendered `Invalid Date` and
 * `common.status.undefined` in the browser while this suite stayed green.
 */
const mockPayments = [
  {
    id: '1',
    paymentDate: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T09:00:00Z',
    amount: 50.0,
    paymentStatus: 'paid',
    paymentType: 'event',
    paymentMethod: 'card',
    userName: 'John Doe',
    userEmail: 'john@example.com',
  },
  {
    id: '2',
    paymentDate: '2024-01-20T10:00:00Z',
    createdAt: '2024-01-20T09:00:00Z',
    amount: 100.0,
    paymentStatus: 'pending',
    paymentType: 'membership',
    paymentMethod: 'cheque',
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
  },
  {
    id: '3',
    paymentDate: '2024-01-25T10:00:00Z',
    createdAt: '2024-01-25T09:00:00Z',
    amount: 75.0,
    paymentStatus: 'refunded',
    paymentType: 'merchandise',
    paymentMethod: 'card',
    userName: 'Bob Johnson',
    userEmail: 'bob@example.com',
  },
];

/*
 * The club in this harness is EUR (`test/renderWithProviders`), and these
 * assertions used to read £ — the page hard-coded 'GBP' regardless of the
 * organisation, and the tests agreed with it. The currency now comes from the
 * organisation via `useCurrency()`, so the symbol follows the club.
 */
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
    return renderWithProviders(<PaymentsListPage />);
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
        expect(screen.getByText('Paid')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Refunded')).toBeInTheDocument();
      });
    });

    it('should format currency correctly', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('€50.00')).toBeInTheDocument();
        expect(screen.getByText('€100.00')).toBeInTheDocument();
        expect(screen.getByText('€75.00')).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      mockExecute.mockResolvedValue(mockPayments);
      renderComponent();

      await waitFor(() => {
        // With the time: two payments on one day are told apart by nothing else.
        expect(screen.getByText('15 Jan 2024 10:00')).toBeInTheDocument();
        expect(screen.getByText('20 Jan 2024 10:00')).toBeInTheDocument();
        expect(screen.getByText('25 Jan 2024 10:00')).toBeInTheDocument();
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

      const startDateInput = screen.getByLabelText(/Start Date/);
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

      const startDateInput = screen.getByLabelText(/Start Date/);
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

      /*
       * Found through the row rather than by position. The list opens sorted
       * newest first, so "the first view button" is not the first fixture —
       * and a test that assumes it is fails the day the default order changes
       * rather than the day navigation breaks.
       */
      const row = screen.getByText('John Doe').closest('tr')!;
      fireEvent.click(within(row).getByTitle('View Details'));

      // No `/orgadmin` prefix: the router carries it as its basename, and
      // including it here produced `/orgadmin/orgadmin/payments/1` and a 404.
      expect(mockNavigate).toHaveBeenCalledWith('/payments/1');
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

/**
 * What a payment was for.
 *
 * Everything taken through checkout carries `paymentType: 'cart'`, so the Type
 * column said "Basket" on every row and told a club nothing about what any of
 * them bought.
 */
describe('the Type column', () => {
  const t = (key: string, options: { defaultValue: string }) =>
    ({
      'payments.itemTypes.event_entry': 'Entry',
      'payments.itemTypes.membership': 'Membership',
      'payments.itemTypes.merchandise': 'Shop',
      'payments.itemTypes.booking': 'Booking',
      'payments.paymentTypes.cart': 'Basket',
      'payments.paymentTypes.event': 'Event',
    })[key] ?? options.defaultValue;

  const payment = (over: Record<string, unknown> = {}) =>
    ({
      id: '1',
      paymentDate: null,
      createdAt: '2026-08-01T10:00:00Z',
      amount: 50,
      paymentStatus: 'paid',
      paymentType: 'cart',
      paymentMethod: 'card',
      userName: null,
      userEmail: null,
      ...over,
    }) as never;

  it('names what a basket held rather than calling it a basket', () => {
    expect(
      paymentKinds(payment({ itemTypes: ['event_entry', 'membership', 'merchandise'] }), t)
    ).toBe('Entry, Membership, Shop');
  });

  it('names a single-item payment by what it bought', () => {
    expect(paymentKinds(payment({ itemTypes: ['booking'] }), t)).toBe('Booking');
  });

  it('falls back to the payment type where there are no lines', () => {
    // An older row, or one raised by hand: "Basket" is still better than blank.
    expect(paymentKinds(payment({ itemTypes: [] }), t)).toBe('Basket');
    expect(paymentKinds(payment({ paymentType: 'event' }), t)).toBe('Event');
  });

  it('shows an untranslated item type rather than a key path', () => {
    expect(paymentKinds(payment({ itemTypes: ['donation'] }), t)).toBe('donation');
  });
});
