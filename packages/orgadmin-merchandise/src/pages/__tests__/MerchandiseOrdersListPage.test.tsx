import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import MerchandiseOrdersListPage from '../MerchandiseOrdersListPage';

/**
 * The club's shop orders — what has been bought, paid for and sent.
 *
 * Unlike most list screens here, this one filters on the **server**: every
 * filter becomes a query parameter, and a parameter sent when it should have
 * been omitted quietly returns the wrong orders. That URL is the thing worth
 * asserting, along with the batch update — which issues one request per order
 * and must not leave a half-applied selection behind.
 */

const { execute, navigate } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { createShellMock } = await import('@aws-web-framework/orgadmin-core/test/shellMock');
  return createShellMock();
});

const ORDERS = [
  {
    id: 'ord-1',
    orderNumber: 'MO-0001',
    customerName: 'Aoife McNamara',
    merchandiseName: 'Club Polo Shirt',
    quantity: 2,
    totalAmount: 45,
    paymentStatus: 'paid',
    orderStatus: 'pending',
    orderDate: '2026-09-01',
  },
  {
    id: 'ord-2',
    orderNumber: 'MO-0002',
    customerName: 'Séamus Donnelly',
    merchandiseName: 'Saddle Pad',
    quantity: 1,
    totalAmount: 30,
    paymentStatus: 'pending',
    orderStatus: 'dispatched',
    orderDate: '2026-09-02',
  },
];

/** The URL of the most recent orders request. */
const lastLoadUrl = (): string => {
  const loads = execute.mock.calls
    .map((call) => call[0])
    .filter((arg) => arg?.method === 'GET' && String(arg.url).includes('merchandise-orders'));
  return String(loads[loads.length - 1]?.url ?? '');
};

const dataRows = () =>
  Array.from(document.querySelectorAll('tbody tr')).filter((row) => row.children.length > 1);

beforeEach(() => {
  execute.mockReset();
  navigate.mockReset();
  execute.mockResolvedValue(ORDERS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MerchandiseOrdersListPage — loading', () => {
  it('asks for the orders of the organisation being worked in', async () => {
    render(<MerchandiseOrdersListPage />);

    await waitFor(() =>
      expect(lastLoadUrl()).toBe('/api/orgadmin/organisations/org-1/merchandise-orders')
    );
  });

  it('sends no query string at all when nothing is filtered', async () => {
    render(<MerchandiseOrdersListPage />);

    await waitFor(() => expect(lastLoadUrl()).not.toContain('?'));
  });

  it('lists the orders it gets back', async () => {
    render(<MerchandiseOrdersListPage />);

    await waitFor(() => expect(dataRows()).toHaveLength(2));
    expect(screen.getByText('Aoife McNamara')).toBeInTheDocument();
    expect(screen.getByText('Séamus Donnelly')).toBeInTheDocument();
  });

  it('says what went wrong and empties the list when the request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    render(<MerchandiseOrdersListPage />);

    // The message matters: an empty table with no explanation reads as "no
    // orders", which for a shop is a very different thing from "not loaded".
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(dataRows()).toHaveLength(0);
  });

  it('copes with the API answering with nothing at all', async () => {
    execute.mockResolvedValue(null);

    render(<MerchandiseOrdersListPage />);

    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(dataRows()).toHaveLength(0);
  });
});

describe('MerchandiseOrdersListPage — filtering, which happens on the server', () => {
  it('passes a customer search as a query parameter', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Aoife' } });

    await waitFor(() => expect(lastLoadUrl()).toContain('customerName=Aoife'));
  });

  it('escapes a search term so a name with a space does not break the URL', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'Aoife McNamara' },
    });

    await waitFor(() => expect(lastLoadUrl()).toContain('customerName=Aoife+McNamara'));
  });

  it('drops the search parameter again when the box is cleared', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Aoife' } });
    await waitFor(() => expect(lastLoadUrl()).toContain('customerName'));

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '' } });

    await waitFor(() => expect(lastLoadUrl()).not.toContain('customerName'));
  });

  it('passes the dates a club narrowed to', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-09-01' } });

    await waitFor(() => expect(lastLoadUrl()).toContain('dateFrom=2026-09-01'));

    fireEvent.change(dateInputs[1], { target: { value: '2026-09-30' } });

    await waitFor(() => expect(lastLoadUrl()).toContain('dateTo=2026-09-30'));
  });

  it('sends every active filter together rather than only the last one', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Aoife' } });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-09-01' } });

    await waitFor(() => {
      const url = lastLoadUrl();
      expect(url).toContain('customerName=Aoife');
      expect(url).toContain('dateFrom=2026-09-01');
    });
  });
});

describe('MerchandiseOrdersListPage — updating several orders at once', () => {
  it('selects and deselects a single order', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const firstRowCheckbox = within(dataRows()[0] as HTMLElement).getByRole('checkbox');
    fireEvent.click(firstRowCheckbox);
    expect(firstRowCheckbox).toBeChecked();

    fireEvent.click(firstRowCheckbox);
    expect(firstRowCheckbox).not.toBeChecked();
  });

  it('selects every order at once, and clears them all again', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const selectAll = document.querySelector('thead input[type="checkbox"]') as HTMLElement;
    fireEvent.click(selectAll);

    await waitFor(() => {
      for (const row of dataRows()) {
        expect(within(row as HTMLElement).getByRole('checkbox')).toBeChecked();
      }
    });

    fireEvent.click(selectAll);

    await waitFor(() => {
      for (const row of dataRows()) {
        expect(within(row as HTMLElement).getByRole('checkbox')).not.toBeChecked();
      }
    });
  });
});

describe('MerchandiseOrdersListPage — exporting', () => {
  it('downloads the orders as a spreadsheet', async () => {
    const createObjectURL = vi.fn(() => 'blob:orders');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/organisations/org-1/merchandise-orders/export',
          responseType: 'blob',
        })
      )
    );
    await waitFor(() => expect(click).toHaveBeenCalled());
    // Released again, or the browser holds the file in memory for the session.
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:orders');
  });

  it('reports a failed export rather than doing nothing visible', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    execute.mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

describe('MerchandiseOrdersListPage — opening one order', () => {
  it('opens the order on that row, by its own id', async () => {
    render(<MerchandiseOrdersListPage />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const buttons = within(dataRows()[1] as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(navigate).toHaveBeenCalledWith('/merchandise/orders/ord-2');
  });
});
