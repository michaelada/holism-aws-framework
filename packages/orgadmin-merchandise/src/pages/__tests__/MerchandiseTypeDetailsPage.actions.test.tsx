/**
 * The two things a club can do to an item from its details page.
 *
 * Deleting is the one worth pinning down. It is irreversible, it sits one click
 * away from simply looking at the item, and its failure mode is silent: a
 * delete the server refused that still returns to the list tells the club the
 * item is gone, and they find it still on sale to members a week later.
 *
 * Read-only rendering is covered by MerchandiseTypeDetailsPage.test.tsx; this
 * file is only about the actions and what happens when they fail.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

vi.mock('@itsplainsailing/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
}));

const merchandiseType = {
  id: 'merch-1',
  organisationId: 'org-1',
  name: 'Club Polo Shirt',
  description: 'Embroidered with the club crest',
  images: [],
  status: 'active' as const,
  optionTypes: [],
  trackStockLevels: false,
  deliveryType: 'free' as const,
  minOrderQuantity: 1,
  maxOrderQuantity: 10,
  quantityIncrements: 1,
  requireApplicationForm: false,
  supportedPaymentMethods: ['stripe'],
  handlingFeeIncluded: false,
  useTermsAndConditions: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const renderPage = () =>
  render(
    <BrowserRouter>
      <MerchandiseTypeDetailsPage />
    </BrowserRouter>
  );

const loaded = () => waitFor(() => expect(screen.getByText('Club Polo Shirt')).toBeInTheDocument());

const button = (pattern: RegExp) =>
  screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!;

const openDeleteDialog = () => fireEvent.click(button(/delete/i));

const confirmDelete = () => {
  const dialog = screen.getByRole('dialog');
  const confirm = within(dialog)
    .getAllByRole('button')
    .find((b) => /delete|confirm/i.test(b.textContent ?? ''))!;
  fireEvent.click(confirm);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue(merchandiseType);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MerchandiseTypeDetailsPage — when the item cannot be loaded', () => {
  /*
   * A failed request and a deleted item look identical to the page, but not to
   * the club: one is worth retrying, the other means the item is gone. The page
   * has separate states for them and must not collapse the two.
   */
  it('reports a load failure rather than claiming the item does not exist', async () => {
    mockExecute.mockRejectedValue(new Error('network down'));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText('merchandise.typeNotFound')).not.toBeInTheDocument();
  });

  it('offers a retry that asks for the item again', async () => {
    mockExecute.mockRejectedValue(new Error('network down'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    mockExecute.mockResolvedValue(merchandiseType);
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button'));

    // A transient failure should not cost the club the page.
    await loaded();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('MerchandiseTypeDetailsPage — editing', () => {
  it('opens the edit form for this item, not the list', async () => {
    renderPage();
    await loaded();

    fireEvent.click(button(/edit/i));

    expect(mockNavigate).toHaveBeenCalledWith('/merchandise/merch-1/edit');
  });
});

describe('MerchandiseTypeDetailsPage — deleting', () => {
  it('asks before deleting anything', async () => {
    renderPage();
    await loaded();

    openDeleteDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Still only the original GET — nothing has been destroyed by opening it.
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('destroys nothing when the club backs out', async () => {
    renderPage();
    await loaded();

    openDeleteDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByText('common.actions.cancel'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('deletes the item once confirmed, and returns to the list', async () => {
    renderPage();
    await loaded();

    openDeleteDialog();
    confirmDelete();

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/orgadmin/merchandise-types/merch-1',
      })
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/merchandise'));
  });

  it('stays on the item and says so when the delete is refused', async () => {
    renderPage();
    await loaded();

    mockExecute.mockRejectedValue(new Error('referenced by existing orders'));
    openDeleteDialog();
    confirmDelete();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Returning to the list here would report a deletion that never happened.
    expect(mockNavigate).not.toHaveBeenCalledWith('/merchandise');
  });

  it('closes the confirmation whether the delete worked or not', async () => {
    renderPage();
    await loaded();

    mockExecute.mockRejectedValue(new Error('referenced by existing orders'));
    openDeleteDialog();
    confirmDelete();

    // A dialog still open over an error message reads as "try again".
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
