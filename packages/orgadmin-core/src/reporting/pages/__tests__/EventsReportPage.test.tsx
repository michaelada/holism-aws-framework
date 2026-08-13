import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import EventsReportPage from '../EventsReportPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { resolveTranslation, formatCurrencyMock } from '../../../test/i18nTestUtils';

vi.mock('../../../hooks/useApi');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () => ({
  formatCurrency: (value: number, currency: string) => formatCurrencyMock(value, currency),
}));

vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () => ({
  formatDate: (date: Date) => date.toISOString().split('T')[0],
}));

/** Rows in the shape the backend's EventsReportData actually returns. */
const EVENT_ROWS = [
  {
    eventId: 'event-1',
    eventName: 'Summer Regatta',
    startDate: '2024-06-01T00:00:00.000Z',
    endDate: '2024-06-03T00:00:00.000Z',
    totalEntries: 120,
    totalRevenue: 6000,
    activities: [
      { activityId: 'act-1', activityName: 'Junior Race', entries: 40, revenue: 2000 },
      { activityId: 'act-2', activityName: 'Senior Race', entries: 80, revenue: 4000 },
    ],
  },
  {
    eventId: 'event-2',
    eventName: 'Winter Series',
    startDate: '2024-11-01T00:00:00.000Z',
    endDate: '2024-11-02T00:00:00.000Z',
    totalEntries: 60,
    totalRevenue: 3000,
    activities: [],
  },
];

describe('EventsReportPage', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Report data fetching', () => {
    it('should call execute on mount to fetch events report data', () => {
      mockApi({ loading: true });

      renderWithProviders(<EventsReportPage />);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should not fetch until the organisation is known', () => {
      mockApi({ loading: true });

      renderWithProviders(<EventsReportPage />, { organisation: null });

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should request the organisation-scoped events endpoint', () => {
      mockApi({ loading: true });

      renderWithProviders(<EventsReportPage />);

      expect(vi.mocked(useApiModule.useApiGet).mock.calls[0][0]).toContain(
        '/api/orgadmin/organisations/org-1/reports/events'
      );
    });

    it('should display loading skeletons while fetching data', () => {
      mockApi({ loading: true });

      const { container } = renderWithProviders(<EventsReportPage />);

      expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('should display an error message when data fetching fails', () => {
      mockApi({ error: 'Network error' });

      renderWithProviders(<EventsReportPage />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Date range filtering', () => {
    beforeEach(() => mockApi({ data: EVENT_ROWS }));

    it('should render date range filters', () => {
      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByLabelText(resolveTranslation('reporting.filters.startDate'))
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(resolveTranslation('reporting.filters.endDate'))
      ).toBeInTheDocument();
    });

    it('should default to a range ending today', () => {
      renderWithProviders(<EventsReportPage />);

      const today = new Date().toISOString().split('T')[0];
      expect(screen.getByLabelText(resolveTranslation('reporting.filters.endDate'))).toHaveValue(
        today
      );
    });

    it('should update the date range when changed', () => {
      renderWithProviders(<EventsReportPage />);

      const startDate = screen.getByLabelText(resolveTranslation('reporting.filters.startDate'));
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });

      expect(startDate).toHaveValue('2024-01-01');
    });
  });

  describe('Summary cards', () => {
    beforeEach(() => mockApi({ data: EVENT_ROWS }));

    it('should count the events returned', () => {
      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.summary.totalEvents'))
      ).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should total entries across every event', () => {
      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.summary.totalEntries'))
      ).toBeInTheDocument();
      expect(screen.getByText('180')).toBeInTheDocument();
    });

    it('should total revenue across every event', () => {
      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.summary.totalRevenue'))
      ).toBeInTheDocument();
      expect(screen.getByText(formatCurrencyMock(9000))).toBeInTheDocument();
    });
  });

  describe('Event details table', () => {
    it('should render the event details table', () => {
      mockApi({ data: EVENT_ROWS });

      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.eventDetails'))
      ).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render a row per event', () => {
      mockApi({ data: EVENT_ROWS });

      renderWithProviders(<EventsReportPage />);

      expect(screen.getByText('Summer Regatta')).toBeInTheDocument();
      expect(screen.getByText('Winter Series')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(EVENT_ROWS.length + 1);
    });

    it('should show entries and revenue per event', () => {
      mockApi({ data: EVENT_ROWS });

      renderWithProviders(<EventsReportPage />);

      const row = screen.getByText('Summer Regatta').closest('tr')!;
      expect(within(row).getByText('120')).toBeInTheDocument();
      expect(within(row).getByText(formatCurrencyMock(6000))).toBeInTheDocument();
    });

    it("should list each event's activities", () => {
      mockApi({ data: EVENT_ROWS });

      renderWithProviders(<EventsReportPage />);

      const row = screen.getByText('Summer Regatta').closest('tr')!;
      expect(within(row).getByText(/Junior Race/)).toBeInTheDocument();
      expect(within(row).getByText(/Senior Race/)).toBeInTheDocument();
    });

    it('should display an info message when no events are found', () => {
      mockApi({ data: [] });

      renderWithProviders(<EventsReportPage />);

      expect(screen.getByText(resolveTranslation('reporting.events.noData'))).toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    it('should render the export button', () => {
      mockApi({ data: EVENT_ROWS });

      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.exportToCSV'))
      ).toBeInTheDocument();
    });

    it('should disable the export button while loading', () => {
      mockApi({ loading: true });

      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.exportToCSV')).closest('button')
      ).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => mockApi({ data: EVENT_ROWS }));

    it('should render the back button', () => {
      renderWithProviders(<EventsReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.events.backToReports'))
      ).toBeInTheDocument();
    });

    it('should navigate back to reporting when the back button is clicked', () => {
      renderWithProviders(<EventsReportPage />);

      fireEvent.click(screen.getByText(resolveTranslation('reporting.events.backToReports')));

      expect(mockNavigate).toHaveBeenCalledWith('/reporting');
    });
  });

  describe('Page layout', () => {
    beforeEach(() => mockApi({ data: EVENT_ROWS }));

    it('should render the page title', () => {
      renderWithProviders(<EventsReportPage />);

      expect(screen.getByText(resolveTranslation('reporting.events.title'))).toBeInTheDocument();
    });

    it('should render the page subtitle', () => {
      renderWithProviders(<EventsReportPage />);

      expect(screen.getByText(resolveTranslation('reporting.events.subtitle'))).toBeInTheDocument();
    });
  });
});
