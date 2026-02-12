import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MembersReportPage from '../MembersReportPage';
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

describe('MembersReportPage', () => {
  const mockExecute = vi.fn();

  const mockMembersReportData = {
    membershipTypes: [
      {
        id: '1',
        name: 'Gold Membership',
        totalMembers: 100,
        activeMembers: 85,
        newMembers: 15,
        renewals: 70,
        expiringMembers: 10,
        revenue: 10000,
      },
      {
        id: '2',
        name: 'Silver Membership',
        totalMembers: 150,
        activeMembers: 120,
        newMembers: 30,
        renewals: 90,
        expiringMembers: 15,
        revenue: 7500,
      },
    ],
    summary: {
      totalMembers: 250,
      activeMembers: 205,
      newMembers: 45,
      renewals: 160,
      expiringMembers: 25,
      totalRevenue: 17500,
      growthRate: 12.5,
      retentionRate: 78.0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Report data fetching', () => {
    it('should call execute on mount to fetch members report data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<MembersReportPage />, { wrapper: RouterWrapper });

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

      render(<MembersReportPage />, { wrapper: RouterWrapper });

      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display error message when data fetching fails', () => {
      const errorMessage = 'Failed to fetch members report';
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: errorMessage,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render date range filters', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('should render status filter', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      // Check that the Status select exists by finding the FormControl
      const statusElements = screen.getAllByText('Status');
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should update filters when changed', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      expect(startDateInput.value).toBe('2024-01-01');
    });
  });

  describe('Summary cards', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should display total members summary', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Members')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('205 active')).toBeInTheDocument();
    });

    it('should display new members summary with growth rate', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('New Members')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText(/12.5% growth/)).toBeInTheDocument();
    });

    it('should display renewals summary with retention rate', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      const renewalsCards = screen.getAllByText('Renewals');
      expect(renewalsCards.length).toBeGreaterThan(0);
      expect(screen.getByText('160')).toBeInTheDocument();
      expect(screen.getByText(/78.0% retention/)).toBeInTheDocument();
    });

    it('should display total revenue summary', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText(/€17,500.00/)).toBeInTheDocument();
      expect(screen.getByText('25 expiring soon')).toBeInTheDocument();
    });

    it('should display growth trend icon correctly', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      // Check for trending up icon (positive growth)
      const trendIcons = document.querySelectorAll('[data-testid="TrendingUpIcon"]');
      expect(trendIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Membership types table', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render membership types table with headers', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Membership Type')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
      const renewalsElements = screen.getAllByText('Renewals');
      expect(renewalsElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Expiring')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('should display all membership types in the table', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Gold Membership')).toBeInTheDocument();
      expect(screen.getByText('Silver Membership')).toBeInTheDocument();
    });

    it('should display membership metrics correctly', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('should display revenue with currency formatting', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(/€10,000.00/)).toBeInTheDocument();
      expect(screen.getByText(/€7,500.00/)).toBeInTheDocument();
    });

    it('should display expiring members with warning chips', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      const tenElements = screen.getAllByText('10');
      expect(tenElements.length).toBeGreaterThan(0);
      const fifteenElements = screen.getAllByText('15');
      expect(fifteenElements.length).toBeGreaterThan(0);
    });

    it('should display info message when no membership data found', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: {
          membershipTypes: [],
          summary: {
            totalMembers: 0,
            activeMembers: 0,
            newMembers: 0,
            renewals: 0,
            expiringMembers: 0,
            totalRevenue: 0,
            growthRate: 0,
            retentionRate: 0,
          },
        },
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(
        screen.getByText(/No membership data found for the selected filters/)
      ).toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render export button', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

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

      render(<MembersReportPage />, { wrapper: RouterWrapper });

      const exportButton = screen.getByText('Export to CSV').closest('button');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render back button', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('should navigate back when back button is clicked', () => {
      render(<MembersReportPage />, { wrapper: RouterWrapper });

      const backButton = screen.getByText('Back to Reports');
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/reporting');
    });
  });

  describe('Page layout', () => {
    it('should render page title', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Members Report')).toBeInTheDocument();
    });

    it('should render page description', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockMembersReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<MembersReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Membership growth and retention analysis')).toBeInTheDocument();
    });
  });
});
