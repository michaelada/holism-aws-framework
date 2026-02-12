import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RevenueReportPage from '../RevenueReportPage';
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

// Wrapper component for router
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('RevenueReportPage', () => {
  const mockExecute = vi.fn();

  const mockRevenueReportData = {
    sources: [
      {
        source: 'events' as const,
        amount: 30000,
        percentage: 50.0,
        transactionCount: 150,
      },
      {
        source: 'memberships' as const,
        amount: 20000,
        percentage: 33.3,
        transactionCount: 100,
      },
      {
        source: 'merchandise' as const,
        amount: 10000,
        percentage: 16.7,
        transactionCount: 50,
      },
    ],
    monthlyBreakdown: [
      {
        month: 'January 2024',
        events: 10000,
        memberships: 5000,
        merchandise: 2000,
        calendar: 1000,
        registrations: 500,
        tickets: 500,
        total: 19000,
      },
      {
        month: 'February 2024',
        events: 12000,
        memberships: 6000,
        merchandise: 3000,
        calendar: 1500,
        registrations: 1000,
        tickets: 1000,
        total: 24500,
      },
    ],
    summary: {
      totalRevenue: 60000,
      totalTransactions: 300,
      averageTransactionValue: 200,
      topSource: 'events',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Report data fetching', () => {
    it('should call execute on mount to fetch revenue report data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should display loading skeletons while fetching data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display error message when data fetching fails', () => {
      const errorMessage = 'Failed to fetch revenue report';
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: errorMessage,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Date range filtering', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render date range filters', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('should have default date range of last 6 months', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement;

      expect(startDateInput.value).toBeTruthy();
      expect(endDateInput.value).toBeTruthy();
    });

    it('should update date range when changed', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      expect(startDateInput.value).toBe('2024-01-01');
    });
  });

  describe('Summary cards', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should display total revenue summary', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText(/€60,000.00/)).toBeInTheDocument();
    });

    it('should display total transactions summary', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Transactions')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('should display average transaction value', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Avg Transaction')).toBeInTheDocument();
      expect(screen.getByText(/€200.00/)).toBeInTheDocument();
    });

    it('should display top revenue source', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Top Source')).toBeInTheDocument();
      const eventsElements = screen.getAllByText('events');
      expect(eventsElements.length).toBeGreaterThan(0);
    });
  });

  describe('Revenue by source', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render revenue by source section', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Revenue by Source')).toBeInTheDocument();
    });

    it('should display all revenue sources', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const eventsElements = screen.getAllByText('events');
      expect(eventsElements.length).toBeGreaterThan(0);
      expect(screen.getByText('memberships')).toBeInTheDocument();
      expect(screen.getByText('merchandise')).toBeInTheDocument();
    });

    it('should display revenue amounts with currency formatting', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const thirtyKElements = screen.getAllByText(/€30,000.00/);
      expect(thirtyKElements.length).toBeGreaterThan(0);
      const twentyKElements = screen.getAllByText(/€20,000.00/);
      expect(twentyKElements.length).toBeGreaterThan(0);
      const tenKElements = screen.getAllByText(/€10,000.00/);
      expect(tenKElements.length).toBeGreaterThan(0);
    });

    it('should display transaction counts for each source', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('150 transactions')).toBeInTheDocument();
      expect(screen.getByText('100 transactions')).toBeInTheDocument();
      expect(screen.getByText('50 transactions')).toBeInTheDocument();
    });

    it('should display percentage for each source', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('50.0%')).toBeInTheDocument();
      expect(screen.getByText('33.3%')).toBeInTheDocument();
      expect(screen.getByText('16.7%')).toBeInTheDocument();
    });

    it('should display progress bars for each source', () => {
      const { container } = render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const progressBars = container.querySelectorAll('.MuiLinearProgress-root');
      expect(progressBars.length).toBe(3);
    });

    it('should display info message when no revenue data found', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: {
          sources: [],
          monthlyBreakdown: [],
          summary: {
            totalRevenue: 0,
            totalTransactions: 0,
            averageTransactionValue: 0,
            topSource: '',
          },
        },
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(/No revenue data found for the selected date range/)).toBeInTheDocument();
    });
  });

  describe('Monthly breakdown table', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render monthly breakdown table with headers', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Memberships')).toBeInTheDocument();
      expect(screen.getByText('Merchandise')).toBeInTheDocument();
      expect(screen.getByText('Calendar')).toBeInTheDocument();
      expect(screen.getByText('Registrations')).toBeInTheDocument();
      expect(screen.getByText('Tickets')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('should display all months in the table', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('January 2024')).toBeInTheDocument();
      expect(screen.getByText('February 2024')).toBeInTheDocument();
    });

    it('should display monthly revenue with currency formatting', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const tenKElements = screen.getAllByText(/€10,000.00/);
      expect(tenKElements.length).toBeGreaterThan(0);
      const twelveKElements = screen.getAllByText(/€12,000.00/);
      expect(twelveKElements.length).toBeGreaterThan(0);
      const nineteenKElements = screen.getAllByText(/€19,000.00/);
      expect(nineteenKElements.length).toBeGreaterThan(0);
      const twentyFourKElements = screen.getAllByText(/€24,500.00/);
      expect(twentyFourKElements.length).toBeGreaterThan(0);
    });

    it('should display info message when no monthly breakdown available', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: {
          sources: mockRevenueReportData.sources,
          monthlyBreakdown: [],
          summary: mockRevenueReportData.summary,
        },
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(
        screen.getByText(/No monthly breakdown data available for the selected date range/)
      ).toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render export button', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Export to CSV')).toBeInTheDocument();
    });

    it('should disable export button when loading', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const exportButton = screen.getByText('Export to CSV').closest('button');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render back button', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('should navigate back when back button is clicked', () => {
      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      const backButton = screen.getByText('Back to Reports');
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/reporting');
    });
  });

  describe('Page layout', () => {
    it('should render page title', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    it('should render page description', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockRevenueReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<RevenueReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Revenue breakdown by source and trends')).toBeInTheDocument();
    });
  });
});
