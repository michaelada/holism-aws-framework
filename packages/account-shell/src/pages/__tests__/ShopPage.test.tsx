import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShopPage from '../ShopPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { CatalogueMerchandise } from '../../types/account';

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

const item = (over: Partial<CatalogueMerchandise> = {}): CatalogueMerchandise => ({
  id: 'item-1',
  name: 'Club polo',
  description: 'Navy, embroidered crest',
  images: [],
  fromPrice: 2500,
  optionTypes: [
    {
      id: 'opt-size',
      name: 'Size',
      values: [{ id: 'val-l', name: 'Large', price: 2500, stockQuantity: null }],
    },
  ],
  minOrderQuantity: 1,
  maxOrderQuantity: null,
  quantityIncrements: null,
  deliveryType: 'free',
  deliveryFee: 0,
  trackStockLevels: false,
  applicationFormId: null,
  termsAndConditions: null,
  handlingFeeIncluded: false,
  supportedPaymentMethodIds: ['pm-card'],
  available: true,
  unavailableReason: null,
  ...over,
});

/**
 * D9 — the club shop.
 *
 * The price shown is a *from* price, because an item's real price is the sum of
 * the options chosen and none has been chosen yet. Sold-out items stay on the
 * shelf with a label: a member who was told about the new polo is better served
 * by "out of stock" than by a shop that behaves as though it never existed.
 */
describe('ShopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    mockExecute.mockResolvedValue([item()]);
  });

  it('lists what the club sells, with a from-price', async () => {
    renderWithProviders(<ShopPage />);

    expect(await screen.findByText('Club polo')).toBeInTheDocument();
    expect(screen.getByText(/From €25\.00/)).toBeInTheDocument();
  });

  it('asks the server for the catalogue, not for one item at a time', async () => {
    renderWithProviders(<ShopPage />);

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/api/account/${contextValue.orgCode}/catalogue/merchandise`,
        })
      )
    );
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('opens the item when the card is pressed', async () => {
    renderWithProviders(<ShopPage />);

    await userEvent.click(await screen.findByText('Club polo'));

    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/shop/item-1`);
  });

  it('marks a sold-out item rather than hiding it', async () => {
    mockExecute.mockResolvedValue([
      item({ available: false, unavailableReason: 'out-of-stock' }),
    ]);
    renderWithProviders(<ShopPage />);

    expect(await screen.findByText('Club polo')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('marks a withdrawn item as not on sale', async () => {
    mockExecute.mockResolvedValue([item({ available: false, unavailableReason: 'not-on-sale' })]);
    renderWithProviders(<ShopPage />);

    expect(await screen.findByText('Not on sale')).toBeInTheDocument();
  });

  it('says so when the shop is empty', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<ShopPage />);

    expect(await screen.findByText(/nothing in the shop/i)).toBeInTheDocument();
  });

  it('reports a failure to load rather than showing an empty shop', async () => {
    mockExecute.mockRejectedValue(new Error('network'));
    renderWithProviders(<ShopPage />);

    expect(await screen.findByText(/could not load the shop/i)).toBeInTheDocument();
  });

  /** A club that has uploaded no picture still gets a tidy card. */
  it('renders an item with no image', async () => {
    mockExecute.mockResolvedValue([item({ images: [] })]);
    renderWithProviders(<ShopPage />);

    expect(await screen.findByText('Club polo')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  /**
   * The image carries no information the name does not, so its alt text is
   * empty and it is invisible to a screen reader by design — which is why this
   * looks for the element rather than a role.
   */
  it('shows the image when there is one', async () => {
    mockExecute.mockResolvedValue([item({ images: ['https://example.test/polo.jpg'] })]);
    const { container } = renderWithProviders(<ShopPage />);

    await screen.findByText('Club polo');

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.test/polo.jpg'
    );
  });
});
