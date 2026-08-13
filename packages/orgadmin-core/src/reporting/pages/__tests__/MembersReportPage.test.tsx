import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import MembersReportPage from '../MembersReportPage';
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

/** Rows in the shape the backend's MembersReportData actually returns. */
const MEMBERSHIP_TYPE_ROWS = [
  {
    membershipTypeId: 'type-1',
    membershipTypeName: 'Full Member',
    activeMembers: 85,
    pendingMembers: 10,
    elapsedMembers: 5,
    totalMembers: 100,
    totalRevenue: 25000,
  },
  {
    membershipTypeId: 'type-2',
    membershipTypeName: 'Junior Member',
    activeMembers: 120,
    pendingMembers: 20,
    elapsedMembers: 10,
    totalMembers: 150,
    totalRevenue: 15000,
  },
];

describe('MembersReportPage', () => {
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
    it('should call execute on mount to fetch members report data', () => {
      mockApi({ loading: true });

      renderWithProviders(<MembersReportPage />);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should not fetch until the organisation is known', () => {
      mockApi({ loading: true });

      renderWithProviders(<MembersReportPage />, { organisation: null });

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should request the organisation-scoped members endpoint', () => {
      mockApi({ loading: true });

      renderWithProviders(<MembersReportPage />);

      expect(vi.mocked(useApiModule.useApiGet).mock.calls[0][0]).toContain(
        '/api/orgadmin/organisations/org-1/reports/members'
      );
    });

    it('should display loading skeletons while fetching data', () => {
      mockApi({ loading: true });

      const { container } = renderWithProviders(<MembersReportPage />);

      expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('should display an error message when data fetching fails', () => {
      mockApi({ error: 'Network error' });

      renderWithProviders(<MembersReportPage />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Date range filtering', () => {
    beforeEach(() => mockApi({ data: MEMBERSHIP_TYPE_ROWS }));

    it('should render date range filters', () => {
      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByLabelText(resolveTranslation('reporting.filters.startDate'))
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(resolveTranslation('reporting.filters.endDate'))
      ).toBeInTheDocument();
    });

    it('should default to a range ending today', () => {
      renderWithProviders(<MembersReportPage />);

      const today = new Date().toISOString().split('T')[0];
      expect(screen.getByLabelText(resolveTranslation('reporting.filters.endDate'))).toHaveValue(
        today
      );
    });

    it('should update the date range when changed', () => {
      renderWithProviders(<MembersReportPage />);

      const startDate = screen.getByLabelText(resolveTranslation('reporting.filters.startDate'));
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });

      expect(startDate).toHaveValue('2024-01-01');
    });
  });

  describe('Summary cards', () => {
    beforeEach(() => mockApi({ data: MEMBERSHIP_TYPE_ROWS }));

    it('should total members across every membership type', () => {
      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.summary.totalMembers'))
      ).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('should total pending members across every membership type', () => {
      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.summary.pendingMembers'))
      ).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('should total elapsed members across every membership type', () => {
      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.summary.elapsedMembers'))
      ).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should total revenue across every membership type', () => {
      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.summary.totalRevenue'))
      ).toBeInTheDocument();
      expect(screen.getByText(formatCurrencyMock(40000))).toBeInTheDocument();
    });
  });

  describe('Membership type breakdown', () => {
    it('should render the breakdown table', () => {
      mockApi({ data: MEMBERSHIP_TYPE_ROWS });

      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.membershipTypeBreakdown'))
      ).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render a row per membership type', () => {
      mockApi({ data: MEMBERSHIP_TYPE_ROWS });

      renderWithProviders(<MembersReportPage />);

      expect(screen.getByText('Full Member')).toBeInTheDocument();
      expect(screen.getByText('Junior Member')).toBeInTheDocument();
      // header row plus one row per membership type
      expect(screen.getAllByRole('row')).toHaveLength(MEMBERSHIP_TYPE_ROWS.length + 1);
    });

    it("should show each type's member counts", () => {
      mockApi({ data: MEMBERSHIP_TYPE_ROWS });

      renderWithProviders(<MembersReportPage />);

      const row = screen.getByText('Full Member').closest('tr')!;
      expect(within(row).getByText('100')).toBeInTheDocument();
      expect(within(row).getByText('85')).toBeInTheDocument();
      expect(within(row).getByText('10')).toBeInTheDocument();
      expect(within(row).getByText('5')).toBeInTheDocument();
    });

    it("should show each type's revenue with currency formatting", () => {
      mockApi({ data: MEMBERSHIP_TYPE_ROWS });

      renderWithProviders(<MembersReportPage />);

      expect(screen.getByText(formatCurrencyMock(25000))).toBeInTheDocument();
      expect(screen.getByText(formatCurrencyMock(15000))).toBeInTheDocument();
    });

    it('should not render the table when there are no membership types', () => {
      mockApi({ data: [] });

      renderWithProviders(<MembersReportPage />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    it('should render the export button', () => {
      mockApi({ data: MEMBERSHIP_TYPE_ROWS });

      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.exportToCSV'))
      ).toBeInTheDocument();
    });

    it('should disable the export button while loading', () => {
      mockApi({ loading: true });

      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.exportToCSV')).closest('button')
      ).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => mockApi({ data: MEMBERSHIP_TYPE_ROWS }));

    it('should render the back button', () => {
      renderWithProviders(<MembersReportPage />);

      expect(
        screen.getByText(resolveTranslation('reporting.members.backToReports'))
      ).toBeInTheDocument();
    });

    it('should navigate back to reporting when the back button is clicked', () => {
      renderWithProviders(<MembersReportPage />);

      fireEvent.click(screen.getByText(resolveTranslation('reporting.members.backToReports')));

      expect(mockNavigate).toHaveBeenCalledWith('/reporting');
    });
  });

  describe('Page layout', () => {
    beforeEach(() => mockApi({ data: MEMBERSHIP_TYPE_ROWS }));

    it('should render the page title', () => {
      renderWithProviders(<MembersReportPage />);

      expect(screen.getByText(resolveTranslation('reporting.members.title'))).toBeInTheDocument();
    });

    it('should render the page subtitle', () => {
      renderWithProviders(<MembersReportPage />);

      expect(screen.getByText(resolveTranslation('reporting.members.subtitle'))).toBeInTheDocument();
    });
  });
});
