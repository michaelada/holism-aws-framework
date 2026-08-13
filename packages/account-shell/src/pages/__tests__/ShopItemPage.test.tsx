import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShopItemPage from '../ShopItemPage';
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
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ itemId: 'item-1' }),
  };
});

const sizes = {
  id: 'opt-size',
  name: 'Size',
  values: [
    { id: 'val-s', name: 'Small', price: 2500, stockQuantity: null },
    { id: 'val-l', name: 'Large', price: 2750, stockQuantity: null },
  ],
};

const item = (over: Partial<CatalogueMerchandise> = {}): CatalogueMerchandise => ({
  id: 'item-1',
  name: 'Club polo',
  description: 'Navy',
  images: [],
  fromPrice: 2500,
  optionTypes: [sizes],
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

/** Routes by URL: the catalogue, the form, the submission, the basket. */
const respond = (over: Partial<CatalogueMerchandise> = {}, form?: Record<string, unknown>) => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) => {
    if (request.method === 'POST' && request.url.includes('form-submissions')) {
      return Promise.resolve({ id: 'sub-1' });
    }
    if (request.method === 'POST') return Promise.resolve({});
    if (request.url.includes('/forms/')) return Promise.resolve(form ?? null);
    return Promise.resolve([item(over)]);
  });
};

/** MUI opens on mouseDown, not click (CLAUDE.md §3.4). */
const chooseSize = async (name: string) => {
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: /Size/ }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name }));
};

/**
 * The figure on the Total row.
 *
 * Scoped rather than searched for globally: with free delivery the subtotal and
 * the total are the same number, and a bare text query would match both and
 * fail without saying which line was wrong.
 */
const totalRow = () => screen.getByText('Total').parentElement as HTMLElement;

/**
 * D10 — one item, its options, and what it will cost.
 *
 * The substance of this screen is that **the price is arithmetic**: an item has
 * no price of its own, only its option values do, so nothing can be quoted
 * until every option is answered. The same sum runs again server-side when the
 * order is created, and that is the one that decides what is charged.
 */
describe('ShopItemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
  });

  it('shows the item and its options', async () => {
    renderWithProviders(<ShopItemPage />);

    expect(await screen.findByText('Club polo')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Size/ })).toBeInTheDocument();
  });

  it('will not add to the basket until every option is answered', async () => {
    renderWithProviders(<ShopItemPage />);

    const add = await screen.findByRole('button', { name: 'Add to basket' });
    expect(add).toBeDisabled();
    expect(screen.getByText(/option from each list/i)).toBeInTheDocument();

    await chooseSize('Large');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
    );
  });

  it('prices the item from the option chosen, not from the item', async () => {
    renderWithProviders(<ShopItemPage />);

    // Nothing chosen: nothing to quote.
    expect(await screen.findByText('—')).toBeInTheDocument();

    await chooseSize('Large');
    await waitFor(() => expect(within(totalRow()).getByText('€27.50')).toBeInTheDocument());
  });

  it('multiplies by the quantity', async () => {
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Small');

    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '3' } });

    await waitFor(() => expect(within(totalRow()).getByText('€75.00')).toBeInTheDocument());
  });

  it('adds the delivery fee to the total and shows it as its own line', async () => {
    respond({ deliveryType: 'fixed', deliveryFee: 450 });
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Small');

    expect(await screen.findByText('€4.50')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('€29.50')).toBeInTheDocument());
  });

  /** A rules table this screen does not have; naming it beats guessing. */
  it('says delivery depends on the quantity rather than quoting a wrong figure', async () => {
    respond({ deliveryType: 'quantity_based' });
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Small');

    expect(await screen.findByText(/depends on the quantity/i)).toBeInTheDocument();
  });

  it('sends the chosen options and quantity to the basket', async () => {
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Large');
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '2' } });

    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `/api/account/${contextValue.orgCode}/cart/items`,
          data: expect.objectContaining({
            itemType: 'merchandise',
            quantity: 2,
            unitFee: 2750,
            contextRef: {
              merchandiseTypeId: 'item-1',
              selectedOptions: { 'opt-size': 'val-l' },
            },
          }),
        })
      )
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });

  it('names the chosen options on the basket line', async () => {
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Large');
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'Club polo — Large' }),
        })
      )
    );
  });

  /** One choice is not a choice; asking for it is a click that says nothing. */
  it('answers a single-value option for the member', async () => {
    respond({
      optionTypes: [
        {
          id: 'opt-size',
          name: 'Size',
          values: [{ id: 'val-one', name: 'One size', price: 1500, stockQuantity: null }],
        },
      ],
    });
    renderWithProviders(<ShopItemPage />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
    );
    expect(within(totalRow()).getByText('€15.00')).toBeInTheDocument();
  });

  describe('stock', () => {
    const withStock = (stock: number) =>
      respond({
        trackStockLevels: true,
        optionTypes: [
          {
            id: 'opt-size',
            name: 'Size',
            values: [{ id: 'val-l', name: 'Large', price: 2750, stockQuantity: stock }],
          },
        ],
      });

    it('says how many are left', async () => {
      withStock(4);
      renderWithProviders(<ShopItemPage />);

      expect(await screen.findByText(/4 left/i)).toBeInTheDocument();
    });

    it('refuses more than are left, and says how many that is', async () => {
      withStock(2);
      renderWithProviders(<ShopItemPage />);
      await screen.findByText(/2 left/i);

      fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '3' } });

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled()
      );
      expect(screen.getByText(/Only 2 left/i)).toBeInTheDocument();
    });

    /** Listed and disabled: the member needs to see it is *their size* that has gone. */
    it('keeps a sold-out size in the list, disabled', async () => {
      withStock(0);
      renderWithProviders(<ShopItemPage />);

      fireEvent.mouseDown(await screen.findByRole('combobox', { name: /Size/ }));
      const option = within(screen.getByRole('listbox')).getByRole('option', { name: /Large/ });
      expect(option).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('the club’s quantity rules', () => {
    it('starts at the smallest order the club allows', async () => {
      respond({ minOrderQuantity: 5 });
      renderWithProviders(<ShopItemPage />);

      await waitFor(() => expect(screen.getByLabelText(/Quantity/)).toHaveValue(5));
    });

    it('refuses a quantity outside the increments', async () => {
      respond({ quantityIncrements: 5 });
      renderWithProviders(<ShopItemPage />);
      await chooseSize('Small');

      fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '7' } });

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled()
      );
      expect(screen.getByText(/not available/i)).toBeInTheDocument();
    });
  });

  describe('forms and terms', () => {
    const form = {
      id: 'form-1',
      fields: [
        {
          id: 'f1',
          name: 'name_on_shirt',
          label: 'Name on shirt',
          datatype: 'text',
          order: 1,
          required: true,
        },
      ],
    };

    it('will not add until a required answer is given', async () => {
      respond({ applicationFormId: 'form-1' }, form);
      renderWithProviders(<ShopItemPage />);
      await chooseSize('Large');

      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/Name on shirt/), 'Sam');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });

    it('saves the answers before the basket line, and links the two', async () => {
      respond({ applicationFormId: 'form-1' }, form);
      renderWithProviders(<ShopItemPage />);
      await chooseSize('Large');
      await userEvent.type(screen.getByLabelText(/Name on shirt/), 'Sam');
      await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('form-submissions'),
            data: expect.objectContaining({ submissionType: 'merchandise_order' }),
          })
        )
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ formSubmissionId: 'sub-1' }),
        })
      );
    });

    it('will not add until the terms are accepted', async () => {
      respond({ termsAndConditions: '<p>No refunds after 1 June.</p>' });
      renderWithProviders(<ShopItemPage />);
      await chooseSize('Large');

      expect(await screen.findByText('No refunds after 1 June.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();

      await userEvent.click(screen.getByRole('checkbox'));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });
  });

  it('offers nothing to buy on an item that is not available', async () => {
    respond({ available: false, unavailableReason: 'out-of-stock' });
    renderWithProviders(<ShopItemPage />);

    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Size/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
  });

  it('says so when the item has gone from the catalogue', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<ShopItemPage />);

    expect(await screen.findByText(/no longer in the shop/i)).toBeInTheDocument();
  });

  /** The server re-checks; a refusal there has to reach the member. */
  it('reports a refusal from the server', async () => {
    mockExecute.mockImplementation((request: { url: string; method?: string }) => {
      if (request.method === 'POST') return Promise.reject(new Error('Only 1 left of Large'));
      return Promise.resolve([item()]);
    });
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Large');
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    expect(await screen.findByText('Only 1 left of Large')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });
});
/**
 * Adding to the basket needs the server — it re-checks stock and the options
 * chosen — so it is refused before the member fills anything in rather than
 * after.
 */
describe('ShopItemPage — offline', () => {
  const setOnline = (online: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
    setOnline(false);
  });

  afterEach(() => setOnline(true));

  it('will not add to the basket, and says why', async () => {
    renderWithProviders(<ShopItemPage />);
    await chooseSize('Large');

    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
    expect(screen.getByText(/need a connection/i)).toBeInTheDocument();
  });

  /** The item is still worth reading — a member can decide, then come back. */
  it('still shows the item and its price', async () => {
    renderWithProviders(<ShopItemPage />);

    expect(await screen.findByText('Club polo')).toBeInTheDocument();
    await chooseSize('Large');
    expect(within(totalRow()).getByText('€27.50')).toBeInTheDocument();
  });
});
