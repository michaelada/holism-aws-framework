/**
 * Module Context tests for DiscountsListPage
 * 
 * Tests the moduleType prop functionality to ensure the page works correctly
 * in both events and memberships contexts.
 * 
 * **Validates: Requirements 2.1, 2.5, 2.6**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DiscountsListPage from '../DiscountsListPage';
import * as useApiModule from '@aws-web-framework/orgadmin-core';
import type { Discount } from '../../types/discount.types';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock orgadmin-shell hooks
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  usePageHelp: vi.fn(),
  useOnboarding: () => ({
    setCurrentModule: vi.fn(),
  }),
}));

const mockDiscounts: Discount[] = [
  {
    id: '1',
    organisationId: 'org-1',
    moduleType: 'memberships',
    name: 'Membership Discount',
    description: 'Discount for memberships',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'item',
    status: 'active',
    combinable: true,
    priority: 1,
    usageLimits: {
      currentUsageCount: 5,
    },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  },
];

describe('DiscountsListPage - Module Context', () => {
  const mockExecute = vi.fn();
  const mockOrganisation = { id: 'org-1', name: 'Test Organisation' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });

    vi.mocked(useApiModule.useOrganisation).mockReturnValue({
      organisation: mockOrganisation,
      setOrganisation: vi.fn(),
    });
  });

  describe('Events Module Context', () => {
    it('should display "Event Discounts" title when moduleType is events', () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="events" />
        </BrowserRouter>
      );

      expect(screen.getByText('Event Discounts')).toBeInTheDocument();
    });

    it('should call API with events moduleType', async () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="events" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/events',
        });
      });
    });

    it('should navigate to events path when creating discount', async () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="events" />
        </BrowserRouter>
      );

      const createButton = screen.getByRole('button', { name: /create discount/i });
      fireEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts/new');
    });

    it('should navigate to events path when editing discount', async () => {
      mockExecute.mockResolvedValue({ discounts: mockDiscounts });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="events" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Membership Discount')).toBeInTheDocument();
      });

      const editIcons = screen.getAllByTestId('EditIcon');
      const editButton = editIcons[0].closest('button');
      if (editButton) {
        fireEvent.click(editButton);
      }

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts/1/edit');
    });

    it('should navigate to events path when viewing stats', async () => {
      mockExecute.mockResolvedValue({ discounts: mockDiscounts });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="events" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Membership Discount')).toBeInTheDocument();
      });

      const statsIcons = screen.getAllByTestId('AssessmentIcon');
      const statsButton = statsIcons[0].closest('button');
      if (statsButton) {
        fireEvent.click(statsButton);
      }

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts/1/stats');
    });
  });

  describe('Memberships Module Context', () => {
    it('should display "Membership Discounts" title when moduleType is memberships', () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="memberships" />
        </BrowserRouter>
      );

      expect(screen.getByText('Membership Discounts')).toBeInTheDocument();
    });

    it('should call API with memberships moduleType', async () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="memberships" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/memberships',
        });
      });
    });

    it('should navigate to memberships path when creating discount', async () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="memberships" />
        </BrowserRouter>
      );

      const createButton = screen.getByRole('button', { name: /create discount/i });
      fireEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/members/discounts/new');
    });

    it('should navigate to memberships path when editing discount', async () => {
      mockExecute.mockResolvedValue({ discounts: mockDiscounts });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="memberships" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Membership Discount')).toBeInTheDocument();
      });

      const editIcons = screen.getAllByTestId('EditIcon');
      const editButton = editIcons[0].closest('button');
      if (editButton) {
        fireEvent.click(editButton);
      }

      expect(mockNavigate).toHaveBeenCalledWith('/members/discounts/1/edit');
    });

    it('should navigate to memberships path when viewing stats', async () => {
      mockExecute.mockResolvedValue({ discounts: mockDiscounts });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="memberships" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Membership Discount')).toBeInTheDocument();
      });

      const statsIcons = screen.getAllByTestId('AssessmentIcon');
      const statsButton = statsIcons[0].closest('button');
      if (statsButton) {
        fireEvent.click(statsButton);
      }

      expect(mockNavigate).toHaveBeenCalledWith('/members/discounts/1/stats');
    });
  });

  describe('Default Module Context', () => {
    it('should default to events moduleType when not specified', () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage />
        </BrowserRouter>
      );

      expect(screen.getByText('Event Discounts')).toBeInTheDocument();
    });

    it('should call API with events moduleType by default', async () => {
      mockExecute.mockResolvedValue({ discounts: [] });
      render(
        <BrowserRouter>
          <DiscountsListPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/events',
        });
      });
    });
  });

  describe('API Call Verification', () => {
    it('should include correct moduleType in all API calls for memberships', async () => {
      mockExecute.mockResolvedValue({ discounts: mockDiscounts });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="memberships" />
        </BrowserRouter>
      );

      // Initial load
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/memberships',
        });
      });

      // Toggle status
      mockExecute.mockClear();
      mockExecute.mockResolvedValue(undefined);

      const toggleIcons = screen.getAllByTestId('ToggleOffIcon');
      const toggleButton = toggleIcons[0].closest('button');
      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/api/orgadmin/discounts/1',
          data: {
            organisationId: 'org-1',
            status: 'inactive',
          },
        });
      });
    });

    it('should include correct moduleType in all API calls for events', async () => {
      mockExecute.mockResolvedValue({ discounts: mockDiscounts });
      render(
        <BrowserRouter>
          <DiscountsListPage moduleType="events" />
        </BrowserRouter>
      );

      // Initial load
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/organisations/org-1/discounts/events',
        });
      });
    });
  });
});
