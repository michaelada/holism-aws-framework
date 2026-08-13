import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import RevenueReportPage from '../RevenueReportPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';

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

// The page resolves its copy through the shell's i18n; returning the key keeps
// these assertions stable and independent of translation wording.
vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'count' in options ? `${key}:${options.count}` : key,
    i18n: { language: 'en-GB' },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
}));

/** Rows in the shape the backend's RevenueReportData actually returns. */
const REVENUE_ROWS = [
  {
    source: 'events',
    totalRevenue: 30000,
    transactionCount: 150,
    averageTransaction: 200,
    currency: 'EUR',
  },
  {
    source: 'memberships',
    totalRevenue: 20000,
    transactionCount: 100,
    averageTransaction: 200,
    currency: 'EUR',
  },
  {
    source: 'merchandise',
    totalRevenue: 10000,
    transactionCount: 50,
    averageTransaction: 200,
    currency: 'EUR',
  },
];

describe('RevenueReportPage', () => {
  const mockExecute = vi.fn();

  const mockApi = (overrides: Record<string, unknown> = {}) => {
    vi.mocked(useApiModule.useApiGet).mockReturnValue({
      data: null,
      error: null,
      loading: false,
      execute: mockExecute,
      reset: vi.fn(),
      ...overrides,
    } as any);
  };

  /*
   * The page holds two API hooks: `useApiGet` for the report it displays, and
   * a plain `useApi` for the export, which asks for a workbook rather than
   * JSON. Auto-mocking the module leaves the second returning undefined.
   */
  const mockExportExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExportExecute.mockResolvedValue(new Blob(['workbook']));
    vi.mocked(useApiModule.useApi).mockReturnValue({
      data: null,
      error: null,
      loading: false,
      execute: mockExportExecute,
      reset: vi.fn(),
    } as any);

    global.URL.createObjectURL = vi.fn(() => 'blob:report');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Report data fetching', () => {
    it('should call execute on mount to fetch revenue report data', () => {
      mockApi({ loading: true });

      renderWithProviders(<RevenueReportPage />);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should not fetch until the organisation is known', () => {
      mockApi({ loading: true });

      renderWithProviders(<RevenueReportPage />, { organisation: null });

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should request the organisation-scoped revenue endpoint', () => {
      mockApi({ loading: true });

      renderWithProviders(<RevenueReportPage />);

      const url = vi.mocked(useApiModule.useApiGet).mock.calls[0][0];
      expect(url).toContain('/api/orgadmin/organisations/org-1/reports/revenue');
      expect(url).toContain('startDate=');
      expect(url).toContain('endDate=');
    });

    it('should display loading skeletons while fetching data', () => {
      mockApi({ loading: true });

      const { container } = renderWithProviders(<RevenueReportPage />);

      expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('should display error message when data fetching fails', () => {
      mockApi({ error: 'Network error' });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Date range filtering', () => {
    beforeEach(() => mockApi({ data: REVENUE_ROWS }));

    it('should render date range filters', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByLabelText('reporting.filters.startDate')).toBeInTheDocument();
      expect(screen.getByLabelText('reporting.filters.endDate')).toBeInTheDocument();
    });

    it('should default to a range ending today', () => {
      renderWithProviders(<RevenueReportPage />);

      const today = new Date().toISOString().split('T')[0];
      expect(screen.getByLabelText('reporting.filters.endDate')).toHaveValue(today);
    });

    it('should default the start date earlier than the end date', () => {
      renderWithProviders(<RevenueReportPage />);

      const start = (screen.getByLabelText('reporting.filters.startDate') as HTMLInputElement).value;
      const end = (screen.getByLabelText('reporting.filters.endDate') as HTMLInputElement).value;
      expect(start < end).toBe(true);
    });

    it('should update the date range when changed', () => {
      renderWithProviders(<RevenueReportPage />);

      const startDate = screen.getByLabelText('reporting.filters.startDate');
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });

      expect(startDate).toHaveValue('2024-01-01');
    });
  });

  describe('Summary cards', () => {
    beforeEach(() => mockApi({ data: REVENUE_ROWS }));

    it('should display total revenue summed from the source rows', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.summary.totalRevenue')).toBeInTheDocument();
      expect(screen.getByText('EUR 60000.00')).toBeInTheDocument();
    });

    it('should display total transactions summed from the source rows', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.summary.totalTransactions')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('should display the derived average transaction value', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.summary.avgTransaction')).toBeInTheDocument();
      // 60000 / 300
      expect(screen.getByText('EUR 200.00')).toBeInTheDocument();
    });

    it('should display the highest-earning source', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.summary.topSource')).toBeInTheDocument();
      // The top-source card renders the same source label as the list below it
      expect(screen.getAllByText('reporting.revenue.sources.events').length).toBe(2);
    });

    it('should show a zero average when there are no transactions', () => {
      mockApi({ data: [] });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getAllByText('EUR 0.00').length).toBeGreaterThan(0);
    });
  });

  describe('Revenue by source', () => {
    it('should render the revenue by source section', () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.revenueBySource')).toBeInTheDocument();
    });

    it('should display every revenue source', () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getAllByText('reporting.revenue.sources.events').length).toBeGreaterThan(0);
      expect(screen.getByText('reporting.revenue.sources.memberships')).toBeInTheDocument();
      expect(screen.getByText('reporting.revenue.sources.merchandise')).toBeInTheDocument();
    });

    it('should display revenue amounts with currency formatting', () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('EUR 30000.00')).toBeInTheDocument();
      expect(screen.getByText('EUR 20000.00')).toBeInTheDocument();
      expect(screen.getByText('EUR 10000.00')).toBeInTheDocument();
    });

    it('should display transaction counts for each source', () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.table.transactions:150')).toBeInTheDocument();
      expect(screen.getByText('reporting.revenue.table.transactions:100')).toBeInTheDocument();
    });

    it('should display each source share as a percentage of the total', () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);

      // 30000/60000, 20000/60000, 10000/60000
      expect(screen.getByText('50.0%')).toBeInTheDocument();
      expect(screen.getByText('33.3%')).toBeInTheDocument();
      expect(screen.getByText('16.7%')).toBeInTheDocument();
    });

    it('should display a progress bar for each source', () => {
      mockApi({ data: REVENUE_ROWS });

      const { container } = renderWithProviders(<RevenueReportPage />);

      expect(container.querySelectorAll('.MuiLinearProgress-root')).toHaveLength(
        REVENUE_ROWS.length
      );
    });

    it('should display an info message when no revenue data is found', () => {
      mockApi({ data: [] });

      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.noData')).toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    const clickExport = () =>
      fireEvent.click(
        screen.getByText('reporting.exportToExcel').closest('button')!
      );

    it('should render the export button', () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);

      expect(
        screen.getByText('reporting.exportToExcel')
      ).toBeInTheDocument();
    });

    it('should disable the export button while loading', () => {
      mockApi({ loading: true });

      renderWithProviders(<RevenueReportPage />);

      expect(
        screen.getByText('reporting.exportToExcel').closest('button')
      ).toBeDisabled();
    });

    /**
     * The point of the whole exercise: the button downloads the workbook the
     * server builds, over the range the page is showing, rather than logging
     * to the console as it used to.
     */
    it('should download the report for the filters on screen', async () => {
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);
      clickExport();

      await waitFor(() =>
        expect(mockExportExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/orgadmin/organisations/org-1/reports/export',
            responseType: 'blob',
            params: expect.objectContaining({ reportType: 'revenue' }),
          })
        )
      );
    });

    it('should say so when the export fails', async () => {
      mockExportExecute.mockRejectedValue(new Error('Failed to export report'));
      mockApi({ data: REVENUE_ROWS });

      renderWithProviders(<RevenueReportPage />);
      clickExport();

      expect(
        await screen.findByText('reporting.exportFailed')
      ).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => mockApi({ data: REVENUE_ROWS }));

    it('should render back button', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.backToReports')).toBeInTheDocument();
    });

    it('should navigate back to reporting when back button is clicked', () => {
      renderWithProviders(<RevenueReportPage />);

      fireEvent.click(screen.getByText('reporting.revenue.backToReports'));

      expect(mockNavigate).toHaveBeenCalledWith('/reporting');
    });
  });

  describe('Page layout', () => {
    beforeEach(() => mockApi({ data: REVENUE_ROWS }));

    it('should render page title', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.title')).toBeInTheDocument();
    });

    it('should render page description', () => {
      renderWithProviders(<RevenueReportPage />);

      expect(screen.getByText('reporting.revenue.subtitle')).toBeInTheDocument();
    });
  });
});
