/**
 * Finding one item in a club shop that has grown past a screenful.
 *
 * The three filters compose, and the stock filter is the awkward one: an item a
 * club does not count stock for has no stock level at all, so it has to be
 * treated as available rather than dropped. Dropping it hides items that are
 * perfectly on sale, and a club concludes the shop is broken.
 *
 * Page furniture is covered by MerchandiseTypesListPage.test.tsx; this file is
 * about which items survive the filters and what the row actions do.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MerchandiseTypesListPage from '../MerchandiseTypesListPage';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@aws-web-framework/orgadmin-shell', async () =>
  (await import('@aws-web-framework/orgadmin-core/test/shellMock')).createShellMock()
);

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Test Org' } }),
}));

type Value = { name: string; price: number; stockQuantity?: number };

const type = (over: Record<string, unknown> = {}) => ({
  id: 'mt-1',
  name: 'Club Polo Shirt',
  description: 'Embroidered with the club crest',
  status: 'active',
  images: [],
  optionTypes: [] as { name: string; optionValues: Value[] }[],
  trackStockLevels: false,
  ...over,
});

const withStock = (name: string, quantities: number[], lowStockAlert?: number) =>
  type({
    id: `mt-${name}`,
    name,
    trackStockLevels: true,
    lowStockAlert,
    optionTypes: [
      { name: 'Size', optionValues: quantities.map((q, i) => ({ name: `V${i}`, price: 10, stockQuantity: q })) },
    ],
  });

const renderList = async (types: unknown[]) => {
  mockExecute.mockResolvedValue(types);
  render(
    <BrowserRouter>
      <MerchandiseTypesListPage />
    </BrowserRouter>
  );
  await waitFor(() => expect(mockExecute).toHaveBeenCalled());
  return waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0));
};

/** Names shown in the table body, in order. */
const listedNames = () =>
  Array.from(document.querySelectorAll('tbody tr')).map(
    (row) => row.querySelector('td:nth-child(2) p')?.textContent ?? ''
  );

const search = (text: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

/** Choose a filter option by its stored value, which does not move between locales. */
const chooseFilter = (index: number, value: string) => {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[index]);
  const listbox = screen.getByRole('listbox');
  fireEvent.click(listbox.querySelector(`[data-value="${value}"]`)!);
};

const rowActions = (rowIndex = 0) =>
  within(document.querySelectorAll('tbody tr')[rowIndex] as HTMLElement).getAllByRole('button');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MerchandiseTypesListPage — searching', () => {
  it('matches on the item name, whatever case it was typed in', async () => {
    await renderList([type({ id: 'a', name: 'Club Polo Shirt' }), type({ id: 'b', name: 'Kit Bag' })]);

    search('polo');

    await waitFor(() => expect(listedNames()).toEqual(['Club Polo Shirt']));
  });

  it('matches on the description too, since that is where the detail lives', async () => {
    await renderList([
      type({ id: 'a', name: 'Kit Bag', description: 'Waterproof, holds a full kit' }),
      type({ id: 'b', name: 'Polo', description: 'Cotton' }),
    ]);

    search('waterproof');

    await waitFor(() => expect(listedNames()).toEqual(['Kit Bag']));
  });

  it('shows everything again when the search is cleared', async () => {
    await renderList([type({ id: 'a', name: 'Polo' }), type({ id: 'b', name: 'Kit Bag' })]);

    search('polo');
    await waitFor(() => expect(listedNames()).toHaveLength(1));
    search('');

    await waitFor(() => expect(listedNames()).toHaveLength(2));
  });
});

describe('MerchandiseTypesListPage — filtering by status', () => {
  it('narrows to the items still on sale', async () => {
    await renderList([
      type({ id: 'a', name: 'On Sale', status: 'active' }),
      type({ id: 'b', name: 'Withdrawn', status: 'inactive' }),
    ]);

    chooseFilter(0, 'active');

    await waitFor(() => expect(listedNames()).toEqual(['On Sale']));
  });

  it('combines with the search rather than replacing it', async () => {
    await renderList([
      type({ id: 'a', name: 'Polo Shirt', status: 'active' }),
      type({ id: 'b', name: 'Polo Shirt Retired', status: 'inactive' }),
      type({ id: 'c', name: 'Kit Bag', status: 'active' }),
    ]);

    search('polo');
    chooseFilter(0, 'active');

    await waitFor(() => expect(listedNames()).toEqual(['Polo Shirt']));
  });
});

describe('MerchandiseTypesListPage — filtering by stock', () => {
  /*
   * An item the club does not count stock for has no stock level to compare.
   * Excluding it from "in stock" hides items that are on sale and sellable.
   */
  it('counts an untracked item as available', async () => {
    await renderList([type({ id: 'a', name: 'Untracked', trackStockLevels: false })]);

    chooseFilter(1, 'in_stock');

    await waitFor(() => expect(listedNames()).toEqual(['Untracked']));
  });

  it('finds the items that have run out', async () => {
    await renderList([
      withStock('Sold Out', [0, 5], 2),
      withStock('Plenty', [40, 30], 2),
    ]);

    chooseFilter(1, 'out_of_stock');

    await waitFor(() => expect(listedNames()).toEqual(['Sold Out']));
  });

  it('finds the items running low, without counting the ones already gone', async () => {
    await renderList([
      withStock('Running Low', [2, 30], 5),
      withStock('Sold Out', [0], 5),
      withStock('Plenty', [40], 5),
    ]);

    chooseFilter(1, 'low_stock');

    // A size at zero makes the whole item out of stock, not merely low.
    await waitFor(() => expect(listedNames()).toEqual(['Running Low']));
  });

  it('leaves untracked items out of a low-stock search', async () => {
    await renderList([
      withStock('Running Low', [2], 5),
      type({ id: 'u', name: 'Untracked', trackStockLevels: false }),
    ]);

    chooseFilter(1, 'low_stock');

    // There is no stock level to be low; listing it would be a false alarm.
    await waitFor(() => expect(listedNames()).toEqual(['Running Low']));
  });

  it('treats stock as fine when the club set no low-stock threshold', async () => {
    await renderList([withStock('No Threshold', [1], undefined)]);

    chooseFilter(1, 'in_stock');

    await waitFor(() => expect(listedNames()).toEqual(['No Threshold']));
  });
});

describe('MerchandiseTypesListPage — what each row shows', () => {
  it('shows a single price when every option costs the same', async () => {
    await renderList([
      type({
        optionTypes: [{ name: 'Size', optionValues: [{ name: 'S', price: 25 }, { name: 'L', price: 25 }] }],
      }),
    ]);

    await waitFor(() => expect(screen.getByText('€25.00')).toBeInTheDocument());
  });

  it('shows a range when the options differ in price', async () => {
    await renderList([
      type({
        optionTypes: [{ name: 'Size', optionValues: [{ name: 'S', price: 25 }, { name: 'XL', price: 32 }] }],
      }),
    ]);

    await waitFor(() => expect(screen.getByText('€25.00 - €32.00')).toBeInTheDocument());
  });

  it('says so plainly when an item has no options priced yet', async () => {
    await renderList([type({ optionTypes: [] })]);

    // An empty price cell reads as free.
    await waitFor(() => expect(listedNames()).toHaveLength(1));
    expect(document.querySelector('tbody tr td:nth-child(5)')?.textContent).not.toBe('');
  });
});

describe('MerchandiseTypesListPage — row actions', () => {
  it('opens the item that was clicked', async () => {
    await renderList([type({ id: 'mt-7' })]);

    fireEvent.click(rowActions()[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/merchandise/mt-7');
  });

  it('edits the item that was clicked', async () => {
    await renderList([type({ id: 'mt-7' })]);

    fireEvent.click(rowActions()[1]);

    expect(mockNavigate).toHaveBeenCalledWith('/merchandise/mt-7/edit');
  });

  it('asks before deleting, and destroys nothing if the club backs out', async () => {
    await renderList([type({ id: 'mt-7' })]);
    const callsAfterLoad = mockExecute.mock.calls.length;

    fireEvent.click(rowActions()[2]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button')[0]);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockExecute).toHaveBeenCalledTimes(callsAfterLoad);
  });

  it('deletes the item that was chosen and reloads the list', async () => {
    await renderList([type({ id: 'mt-7', name: 'Polo' }), type({ id: 'mt-8', name: 'Kit Bag' })]);

    fireEvent.click(rowActions(1)[2]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button')[1]);

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/orgadmin/merchandise-types/mt-8',
      })
    );
    // The list has to be re-read, or the deleted row stays on screen.
    await waitFor(() =>
      expect(
        mockExecute.mock.calls.filter(([req]) => req.method === 'GET').length
      ).toBeGreaterThan(1)
    );
  });

  it('reports a refused delete instead of pretending it worked', async () => {
    await renderList([type({ id: 'mt-7' })]);

    mockExecute.mockRejectedValue(new Error('referenced by orders'));
    fireEvent.click(rowActions()[2]);
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button')[1]);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('MerchandiseTypesListPage — when the list cannot be loaded', () => {
  it('says the load failed rather than showing an empty shop', async () => {
    mockExecute.mockRejectedValue(new Error('network down'));
    render(
      <BrowserRouter>
        <MerchandiseTypesListPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('copes with a server that answers with nothing at all', async () => {
    mockExecute.mockResolvedValue(null);
    render(
      <BrowserRouter>
        <MerchandiseTypesListPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    // No rows, but no crash either.
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
