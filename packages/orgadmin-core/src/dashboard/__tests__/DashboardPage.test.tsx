import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '../pages/DashboardPage';
import * as useApiModule from '../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../hooks/useApi');

describe('DashboardPage', () => {
  const mockExecute = vi.fn();

  const mockDashboardData = {
    events: {
      total: 25,
      upcoming: 10,
      active: 5,
    },
    members: {
      total: 150,
      active: 120,
      expiringSoon: 15,
    },
    revenue: {
      total: 50000,
      thisMonth: 5000,
      lastMonth: 4500,
    },
    payments: {
      total: 200,
      pending: 10,
      completed: 190,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard data fetching', () => {
    it('should call execute on mount to fetch dashboard data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should display loading skeletons while fetching data', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: null,
        loading: true,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

      // Check for skeleton elements (MUI Skeleton components)
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display error message when data fetching fails', () => {
      const errorMessage = 'Failed to fetch dashboard data';
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: null,
        error: errorMessage,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

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

      render(<DashboardPage />);

      expect(
        screen.getByText('No dashboard data available. Please check back later.')
      ).toBeInTheDocument();
    });
  });

  describe('Metric card rendering', () => {
    beforeEach(() => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockDashboardData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });
    });

    it('should render all four metric cards when data is loaded', () => {
      render(<DashboardPage />);

      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Members')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Payments')).toBeInTheDocument();
    });

    it('should display correct events metrics', () => {
      render(<DashboardPage />);

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('10 upcoming, 5 active')).toBeInTheDocument();
    });

    it('should display correct members metrics', () => {
      render(<DashboardPage />);

      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('120 active, 15 expiring soon')).toBeInTheDocument();
    });

    it('should display correct revenue metrics with currency formatting', () => {
      render(<DashboardPage />);

      // Check for formatted currency values
      expect(screen.getByText(/€50,000.00/)).toBeInTheDocument();
      expect(screen.getByText(/€5,000.00 this month/)).toBeInTheDocument();
    });

    it('should display correct payments metrics', () => {
      render(<DashboardPage />);

      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('10 pending, 190 completed')).toBeInTheDocument();
    });

    it('should render metric cards with appropriate icons', () => {
      const { container } = render(<DashboardPage />);

      // Check that SVG icons are rendered (MUI icons render as SVG)
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThanOrEqual(4);
    });

    it('should render metric cards in a grid layout', () => {
      const { container } = render(<DashboardPage />);

      // Check for MUI Grid container
      const gridContainer = container.querySelector('.MuiGrid-container');
      expect(gridContainer).toBeInTheDocument();

      // Check for Grid items
      const gridItems = container.querySelectorAll('.MuiGrid-item');
      expect(gridItems.length).toBe(4);
    });
  });

  describe('Dashboard page layout', () => {
    it('should render page title', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockDashboardData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should render page description', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockDashboardData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

      expect(
        screen.getByText("Overview of your organisation's key metrics")
      ).toBeInTheDocument();
    });
  });

  describe('Currency formatting', () => {
    it('should format revenue values as EUR currency', () => {
      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: mockDashboardData,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

      // Check that currency is formatted with EUR symbol
      const revenueElements = screen.getAllByText(/€/);
      expect(revenueElements.length).toBeGreaterThan(0);
    });

    it('should handle zero revenue correctly', () => {
      const dataWithZeroRevenue = {
        ...mockDashboardData,
        revenue: {
          total: 0,
          thisMonth: 0,
          lastMonth: 0,
        },
      };

      vi.mocked(useApiModule.useApiGet).mockReturnValue({
        data: dataWithZeroRevenue,
        error: null,
        loading: false,
        execute: mockExecute,
        reset: vi.fn(),
      });

      render(<DashboardPage />);

      // Check that zero revenue is displayed (multiple instances expected)
      const zeroRevenueElements = screen.getAllByText(/€0.00/);
      expect(zeroRevenueElements.length).toBeGreaterThan(0);
    });
  });
});
