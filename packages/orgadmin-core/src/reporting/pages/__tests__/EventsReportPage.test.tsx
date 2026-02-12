import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventsReportPage from '../EventsReportPage';
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

describe('EventsReportPage', () => {
  const mockExecute = vi.fn();

  const mockEventsReportData = {
    events: [
      {
        id: '1',
        name: 'Summer Festival',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        status: 'completed' as const,
        totalEntries: 150,
        totalRevenue: 15000,
        activities: [
          { name: 'Workshop A', entries: 50, revenue: 5000 },
          { name: 'Workshop B', entries: 100, revenue: 10000 },
        ],
      },
      {
        id: '2',
        name: 'Winter Conference',
        startDate: '2024-12-10',
        endDate: '2024-12-12',
        status: 'published' as const,
        totalEntries: 200,
        totalRevenue: 25000,
        activities: [
          { name: 'Keynote', entries: 200, revenue: 25000 },
        ],
      },
    ],
    summary: {
      totalEvents: 2,
      totalEntries: 350,
      totalRevenue: 40000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Report data fetching', () => {
    it('should call execute on mount to fetch events report data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<EventsReportPage />, { wrapper: RouterWrapper });

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

      render(<EventsReportPage />, { wrapper: RouterWrapper });

      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display error message when data fetching fails', () => {
      const errorMessage = 'Failed to fetch events report';
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: errorMessage,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render date range filters', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('should render status filter', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      // Check that the Status select exists by finding the FormControl
      const statusElements = screen.getAllByText('Status');
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should update start date when changed', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement;
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      expect(startDateInput.value).toBe('2024-01-01');
    });

    it('should update end date when changed', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement;
      fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });

      expect(endDateInput.value).toBe('2024-12-31');
    });
  });

  describe('Summary cards', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should display total events summary', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Events')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display total entries summary', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Entries')).toBeInTheDocument();
      expect(screen.getByText('350')).toBeInTheDocument();
    });

    it('should display total revenue summary with currency formatting', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText(/€40,000.00/)).toBeInTheDocument();
    });
  });

  describe('Events table', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render events table with headers', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Event Name')).toBeInTheDocument();
      expect(screen.getByText('Date Range')).toBeInTheDocument();
      const statusElements = screen.getAllByText('Status');
      expect(statusElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Entries')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Activities')).toBeInTheDocument();
    });

    it('should display all events in the table', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Summer Festival')).toBeInTheDocument();
      expect(screen.getByText('Winter Conference')).toBeInTheDocument();
    });

    it('should display event entries and revenue', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      const fifteenKElements = screen.getAllByText(/€15,000.00/);
      expect(fifteenKElements.length).toBeGreaterThan(0);
      const twentyFiveKElements = screen.getAllByText(/€25,000.00/);
      expect(twentyFiveKElements.length).toBeGreaterThan(0);
    });

    it('should display event status chips', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('published')).toBeInTheDocument();
    });

    it('should display activity information', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('2 activities')).toBeInTheDocument();
      expect(screen.getByText('1 activities')).toBeInTheDocument();
      expect(screen.getByText(/Workshop A: 50 entries/)).toBeInTheDocument();
    });

    it('should display info message when no events found', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: { events: [], summary: { totalEvents: 0, totalEntries: 0, totalRevenue: 0 } },
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(
        screen.getByText(/No events found for the selected filters/)
      ).toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render export button', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

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

      render(<EventsReportPage />, { wrapper: RouterWrapper });

      const exportButton = screen.getByText('Export to CSV').closest('button');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render back button', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('should navigate back when back button is clicked', () => {
      render(<EventsReportPage />, { wrapper: RouterWrapper });

      const backButton = screen.getByText('Back to Reports');
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/reporting');
    });
  });

  describe('Page layout', () => {
    it('should render page title', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Events Report')).toBeInTheDocument();
    });

    it('should render page description', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockEventsReportData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<EventsReportPage />, { wrapper: RouterWrapper });

      expect(screen.getByText('Event attendance and revenue analysis')).toBeInTheDocument();
    });
  });
});
