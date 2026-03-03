/**
 * Module Context tests for CreateDiscountPage
 * 
 * Tests the moduleType prop functionality to ensure the page works correctly
 * in both events and memberships contexts.
 * 
 * **Validates: Requirements 2.2, 2.5, 6.6, 6.7**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CreateDiscountPage from '../CreateDiscountPage';

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams: { id?: string } = { id: undefined };
const mockExecute = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({
    execute: mockExecute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  }),
  useOrganisation: () => ({
    organisation: {
      id: 'd5a5a5ca-c4b4-436d-8981-627ab3556433',
      name: 'Test Organisation',
    },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  usePageHelp: vi.fn(),
  useOnboarding: () => ({
    setCurrentModule: vi.fn(),
  }),
}));

describe('CreateDiscountPage - Module Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockParams.id = undefined;
    mockExecute.mockReset();
  });

  describe('Events Module Context', () => {
    it('should set moduleType to events when creating discount', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="events" />
        </BrowserRouter>
      );

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/discounts',
            data: expect.objectContaining({
              moduleType: 'events',
            }),
          })
        );
      });
    });

    it('should navigate to events path after successful save', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="events" />
        </BrowserRouter>
      );

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/events/discounts');
      });
    });

    it('should navigate to events path when cancel is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="events" />
        </BrowserRouter>
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/events/discounts');
    });
  });

  describe('Memberships Module Context', () => {
    it('should set moduleType to memberships when creating discount', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="memberships" />
        </BrowserRouter>
      );

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/discounts',
            data: expect.objectContaining({
              moduleType: 'memberships',
            }),
          })
        );
      });
    });

    it('should navigate to memberships path after successful save', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="memberships" />
        </BrowserRouter>
      );

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/members/discounts');
      });
    });

    it('should navigate to memberships path when cancel is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="memberships" />
        </BrowserRouter>
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/members/discounts');
    });
  });

  describe('Default Module Context', () => {
    it('should default to events moduleType when not specified', async () => {
      const user = userEvent.setup();
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      
      render(
        <BrowserRouter>
          <CreateDiscountPage />
        </BrowserRouter>
      );

      // Navigate to last step
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Save
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/discounts',
            data: expect.objectContaining({
              moduleType: 'events',
            }),
          })
        );
      });
    });
  });

  describe('Edit Mode with Module Context', () => {
    it('should preserve moduleType when editing discount in events context', async () => {
      const user = userEvent.setup();
      mockParams.id = '123';
      mockExecute
        .mockResolvedValueOnce({
          id: '123',
          name: 'Existing Discount',
          discountType: 'percentage',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
          moduleType: 'events',
        })
        .mockResolvedValueOnce({ id: '123', name: 'Updated Discount' });

      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="events" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Discount')).toBeInTheDocument();
      });

      // Navigate to last step
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Update
      await user.click(screen.getByRole('button', { name: /update discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/api/orgadmin/discounts/123',
            data: expect.objectContaining({
              moduleType: 'events',
            }),
          })
        );
      });
    });

    it('should preserve moduleType when editing discount in memberships context', async () => {
      const user = userEvent.setup();
      mockParams.id = '123';
      mockExecute
        .mockResolvedValueOnce({
          id: '123',
          name: 'Existing Discount',
          discountType: 'percentage',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
          moduleType: 'memberships',
        })
        .mockResolvedValueOnce({ id: '123', name: 'Updated Discount' });

      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="memberships" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Discount')).toBeInTheDocument();
      });

      // Navigate to last step
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Click Update
      await user.click(screen.getByRole('button', { name: /update discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/api/orgadmin/discounts/123',
            data: expect.objectContaining({
              moduleType: 'memberships',
            }),
          })
        );
      });
    });
  });

  describe('Module Type Consistency', () => {
    it('should maintain moduleType throughout the wizard flow', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateDiscountPage moduleType="memberships" />
        </BrowserRouter>
      );

      // Fill in form and navigate through all steps
      await user.type(screen.getByRole('textbox', { name: /discount name/i }), 'Test Discount');
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 2
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /back/i }));
      
      // Back to Step 1
      await waitFor(() => screen.getByRole('heading', { name: /basic information/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Forward to Step 2 again
      await waitFor(() => screen.getByRole('heading', { name: /discount configuration/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 3
      await waitFor(() => screen.getByRole('heading', { name: /eligibility criteria/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 4
      await waitFor(() => screen.getByRole('heading', { name: /validity & limits/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Step 5
      await waitFor(() => screen.getByRole('heading', { name: /review & confirm/i }));

      // Verify we can still save with correct moduleType
      mockExecute.mockResolvedValueOnce({ id: '123', name: 'Test Discount' });
      await user.click(screen.getByRole('button', { name: /create discount/i }));

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              moduleType: 'memberships',
            }),
          })
        );
      });
    });
  });
});
