import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ReportingDashboardPage from '../ReportingDashboardPage';
import * as useApiModule from '../../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Wrapper component for router
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ReportingDashboardPage', () => {
  const mockExecute = vi.fn();

  const mockReportingData = {
    events: {
      total: 25,
      upcoming: 10,
      completed: 15,
      totalAttendance: 500,
      trend: 'up' as const,
      trendPercentage: 15.5,
    },
    members: {
      total: 150,
      active: 120,
      new: 20,
      renewals: 30,
      trend: 'up' as const,
      trendPercentage: 10.2,
    },
    revenue: {
      total: 50000,
      events: 30000,
      memberships: 15000,
      merchandise: 5000,
      trend: 'stable' as const,
      trendPercentage: 0.5,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Report data fetching', () => {
    it('should call execute on mount to fetch reporting data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

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

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display error message when data fetching fails', () => {
      const errorMessage = 'Failed to fetch reporting data';
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: errorMessage,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should display info message when no data is available', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(
        screen.getByText(/No reporting data available for the selected date range/)
      ).toBeInTheDocument();
    });
  });

  describe('Date range filtering', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockReportingData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render date range selector', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('should have default date range of last month', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement;

      expect(startDateInput.value).toBeTruthy();
      expect(endDateInput.value).toBeTruthy();
    });

    it('should update start date when changed', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      expect(startDateInput.value).toBe('2024-01-01');
    });

    it('should update end date when changed', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement;
      fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });

      expect(endDateInput.value).toBe('2024-12-31');
    });
  });

  describe('Metric card rendering', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockReportingData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render all three metric cards when data is loaded', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Members')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('should display correct events metrics with trend', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText(/10 upcoming, 15 completed/)).toBeInTheDocument();
      expect(screen.getByText(/15.5%/)).toBeInTheDocument();
    });

    it('should display correct members metrics with trend', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText(/120 active, 20 new, 30 renewals/)).toBeInTheDocument();
      expect(screen.getByText(/10.2%/)).toBeInTheDocument();
    });

    it('should display correct revenue metrics with currency formatting', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(/€50,000.00/)).toBeInTheDocument();
      expect(screen.getByText(/Events: €30,000.00/)).toBeInTheDocument();
    });

    it('should display trend indicators correctly', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      // Check for trend arrows
      expect(screen.getByText(/↑ 15.5%/)).toBeInTheDocument();
      expect(screen.getByText(/↑ 10.2%/)).toBeInTheDocument();
      expect(screen.getByText(/→ 0.5%/)).toBeInTheDocument();
    });
  });

  describe('Quick links to detailed reports', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockReportingData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render quick links section', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Detailed Reports')).toBeInTheDocument();
    });

    it('should render links to all detailed report pages', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Events Report')).toBeInTheDocument();
      expect(screen.getByText('Members Report')).toBeInTheDocument();
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockReportingData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render export button', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Export Report')).toBeInTheDocument();
    });

    it('should disable export button when loading', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      const exportButton = screen.getByText('Export Report').closest('button');
      expect(exportButton).toBeDisabled();
    });

    it('should disable export button when no data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      const exportButton = screen.getByText('Export Report').closest('button');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Page layout', () => {
    it('should render page title', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockReportingData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    });

    it('should render page description', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockReportingData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(
        screen.getByText('High-level metrics and trends for your organisation')
      ).toBeInTheDocument();
    });
  });
});
