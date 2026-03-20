/**
 * Merchandise Type Details Page Tests
 * 
 * Tests API integration, loading/error/not-found states, and read-only section rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MerchandiseTypeDetailsPage from '../MerchandiseTypeDetailsPage';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'merch-1' }),
  };
});

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
}));

const mockMerchandiseType = {
  id: 'merch-1',
  organisationId: 'org-1',
  name: 'Test T-Shirt',
  description: 'A great t-shirt',
  images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  status: 'active' as const,
  optionTypes: [
    {
      id: 'opt-1',
      merchandiseTypeId: 'merch-1',
      name: 'Size',
      order: 0,
      optionValues: [
        { id: 'val-1', optionTypeId: 'opt-1', name: 'Small', price: 10, order: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: 'val-2', optionTypeId: 'opt-1', name: 'Large', price: 15, order: 1, createdAt: new Date(), updatedAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  trackStockLevels: true,
  lowStockAlert: 5,
  outOfStockBehavior: 'show_unavailable' as const,
  deliveryType: 'fixed' as const,
  deliveryFee: 3.5,
  minOrderQuantity: 1,
  maxOrderQuantity: 100,
  quantityIncrements: 1,
  requireApplicationForm: false,
  supportedPaymentMethods: ['stripe', 'pay-offline'],
  handlingFeeIncluded: true,
  useTermsAndConditions: true,
  termsAndConditions: 'Some terms',
  adminNotificationEmails: 'admin@test.com',
  customConfirmationMessage: 'Thank you for your order!',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MerchandiseTypeDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockExecute.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    expect(screen.getByText('common.messages.loading')).toBeInTheDocument();
  });

  it('should call GET API on mount with correct URL', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/merchandise-types/merch-1',
      });
    });
  });

  it('should show not found message when API returns null', async () => {
    mockExecute.mockResolvedValue(null);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('merchandise.typeNotFound')).toBeInTheDocument();
    });
  });

  it('should render merchandise type name and basic info', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Test T-Shirt')).toBeInTheDocument();
    });
    expect(screen.getByText('A great t-shirt')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('should render option types with values and prices', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Size')).toBeInTheDocument();
    });
    // Option values are rendered as chips with name and price
    expect(screen.getByText(/Small/)).toBeInTheDocument();
    expect(screen.getByText(/Large/)).toBeInTheDocument();
  });

  it('should render stock tracking info when enabled', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/merchandise\.stock\.tracking/)).toBeInTheDocument();
    });
  });

  it('should render payment methods', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('stripe')).toBeInTheDocument();
    });
    expect(screen.getByText('pay-offline')).toBeInTheDocument();
  });

  it('should render email configuration', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/admin@test.com/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Thank you for your order!/)).toBeInTheDocument();
  });

  it('should render images gallery', async () => {
    mockExecute.mockResolvedValue(mockMerchandiseType);
    render(
      <BrowserRouter>
        <MerchandiseTypeDetailsPage />
      </BrowserRouter>
    );
    await waitFor(() => {
      const images = screen.getAllByRole('img');
      expect(images.length).toBe(2);
    });
  });
});
