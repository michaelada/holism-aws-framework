import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ReportingDashboardPage from '../ReportingDashboardPage';
import * as useApiModule from '../../../hooks/useApi';
import { TEST_ORGANISATION } from '../../../test/renderWithProviders';
import { OrganisationProvider } from '../../../context/OrganisationContext';

vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () => import('../../../test/orgadminShellMock'));

// Shell hooks (translations, onboarding, page help, capabilities, locale)
// are mocked rather than provided — see test/orgadminShellMock.
vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Wrapper component for router
// The dashboard reads the current organisation, so the wrapper supplies it
// alongside the router.
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <OrganisationProvider organisation={TEST_ORGANISATION}>{children}</OrganisationProvider>
  </BrowserRouter>
);

describe('ReportingDashboardPage', () => {
  const mockExecute = vi.fn();

  const mockReportingData = {
    totalEvents: 25,
    totalMembers: 150,
    totalRevenue: 50000,
    totalPayments: 320,
    recentEvents: 10,
    recentMembers: 20,
    recentRevenue: 12500,
    recentPayments: 64,
  };
;

  /*
   * The page holds two API hooks: `useApiGet` for the metrics it displays, and
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

    it('should display correct events metrics', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText(/10 in the last 30 days/)).toBeInTheDocument();
    });

    it('should display correct members metrics', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText(/20 in the last 30 days/)).toBeInTheDocument();
    });

    it('should display correct revenue metrics with currency formatting', () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(/€50,000.00/)).toBeInTheDocument();
      expect(screen.getByText(/€50,000.00/)).toBeInTheDocument();
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

      expect(screen.getAllByText('Export Report')[0]).toBeInTheDocument();
    });

    /**
     * The dashboard summarises three reports and is not one itself, so there
     * is nothing called "the dashboard report" to download. The button offers
     * the three that do exist.
     */
    it('should offer the three reports rather than exporting an unnamed one', async () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      fireEvent.click(screen.getAllByText('Export Report')[0]);

      const menu = await screen.findByRole('menu');
      expect(within(menu).getByText('Events Report')).toBeInTheDocument();
      expect(within(menu).getByText('Members Report')).toBeInTheDocument();
      expect(within(menu).getByText('Revenue Report')).toBeInTheDocument();
    });

    it('should download the chosen report over the window on screen', async () => {
      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      fireEvent.click(screen.getAllByText('Export Report')[0]);
      fireEvent.click(within(await screen.findByRole('menu')).getByText('Members Report'));

      await waitFor(() =>
        expect(mockExportExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/orgadmin/organisations/org-1/reports/export',
            responseType: 'blob',
            params: expect.objectContaining({ reportType: 'members' }),
          })
        )
      );
    });

    it('should say so when the export fails', async () => {
      mockExportExecute.mockRejectedValue(new Error('Failed to export report'));

      render(<ReportingDashboardPage />, { wrapper: RouterWrapper });

      fireEvent.click(screen.getAllByText('Export Report')[0]);
      fireEvent.click(within(await screen.findByRole('menu')).getByText('Events Report'));

      expect(
        await screen.findByText('We could not produce that report. Please try again.')
      ).toBeInTheDocument();
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

      const exportButton = screen.getAllByText('Export Report')[0].closest('button');
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

      const exportButton = screen.getAllByText('Export Report')[0].closest('button');
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
