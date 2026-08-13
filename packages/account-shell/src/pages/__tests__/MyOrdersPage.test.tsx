import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyOrdersPage from '../MyOrdersPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { AccountMerchandiseOrder } from '../../types/account';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const order = (over: Partial<AccountMerchandiseOrder> = {}): AccountMerchandiseOrder => ({
  id: 'order-1',
  merchandiseTypeId: 'item-1',
  itemName: 'Club polo',
  image: null,
  options: { Size: 'Large', Colour: 'Navy' },
  quantity: 2,
  unitPrice: 2750,
  deliveryFee: 0,
  totalPrice: 5500,
  orderDate: '2026-08-01T10:00:00.000Z',
  paymentStatus: 'paid',
  orderStatus: 'processing',
  status: 'confirmed',
  ...over,
});

/**
 * C8 — what the member has ordered.
 *
 * Two statuses, deliberately. The shared chip answers "have I paid?"; the
 * club's own order status answers "can I collect it?". One chip cannot say
 * both, and a member wants both.
 */
describe('MyOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([order()]);
  });

  it('lists the orders with what was chosen', async () => {
    renderWithProviders(<MyOrdersPage />);

    expect(await screen.findByText('Club polo')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
    expect(screen.getByText('Navy')).toBeInTheDocument();
    expect(screen.getByText('€55.00')).toBeInTheDocument();
  });

  it('shows the payment state and the club’s progress separately', async () => {
    renderWithProviders(<MyOrdersPage />);

    await screen.findByText('Club polo');
    // "have I paid?" and "can I collect it?" are different questions.
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Being prepared')).toBeInTheDocument();
  });

  it('falls back to the club’s own word for an order status it has no wording for', async () => {
    mockExecute.mockResolvedValue([order({ orderStatus: 'awaiting_supplier' })]);
    renderWithProviders(<MyOrdersPage />);

    expect(await screen.findByText('awaiting_supplier')).toBeInTheDocument();
  });

  it('shows the delivery fee only when there is one', async () => {
    renderWithProviders(<MyOrdersPage />);
    await screen.findByText('Club polo');
    expect(screen.queryByText(/Delivery/)).not.toBeInTheDocument();

    mockExecute.mockResolvedValue([order({ deliveryFee: 450 })]);
    renderWithProviders(<MyOrdersPage />);
    expect(await screen.findAllByText(/Delivery/)).not.toHaveLength(0);
  });

  it('sends a member with no orders to the shop', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<MyOrdersPage />);

    expect(await screen.findByText(/not ordered anything yet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Go to the shop' }));
    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/shop`);
  });

  it('reports a failure rather than claiming there are no orders', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<MyOrdersPage />);

    expect(await screen.findByText(/could not load your orders/i)).toBeInTheDocument();
    expect(screen.queryByText(/not ordered anything yet/i)).not.toBeInTheDocument();
  });

  it('asks only for this member’s orders in this organisation', async () => {
    renderWithProviders(<MyOrdersPage />);

    await screen.findByText('Club polo');
    expect(mockExecute).toHaveBeenCalledWith({
      url: `/api/account/${contextValue.orgCode}/orders`,
    });
  });
});
