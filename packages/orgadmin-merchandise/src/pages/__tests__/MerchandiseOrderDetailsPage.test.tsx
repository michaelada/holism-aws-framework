import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MerchandiseOrderDetailsPage from '../MerchandiseOrderDetailsPage';

/**
 * One order in a club shop, and the two things a club does to it: move it
 * along, and write down what happened.
 *
 * A status change can send an email to the member, so the page has to pass that
 * choice through to the server rather than deciding for itself — an update
 * silently emailing everyone, or silently emailing nobody, is the difference
 * between a shop people trust and one they chase.
 *
 * Notes and status are separate saves against separate endpoints. Sharing one
 * would mean writing a half-finished note every time an order is marked
 * shipped.
 */

const { execute, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  params: { current: { id: 'ord-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => vi.fn(),
  useParams: () => params.current,
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { createShellMock } = await import('@itsplainsailing/orgadmin-core/test/shellMock');
  return createShellMock();
});

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath', currency: 'EUR' },
    setOrganisation: vi.fn(),
  }),
}));

const ORDER = {
  id: 'ord-1',
  orderNumber: 'ORD-0001',
  orderStatus: 'pending',
  paymentStatus: 'paid',
  customerName: 'Aoife Byrne',
  customerEmail: 'aoife@example.com',
  merchandiseType: { id: 'mt-1', name: 'Club Polo Shirt' },
  adminNotes: '',
  quantity: 1,
  selectedOptions: { Size: 'Large' },
  unitPrice: 25,
  subtotal: 25,
  deliveryFee: 0,
  totalPrice: 25,
  createdAt: '2026-06-10T10:00:00Z',
};

const renderPage = async (order: unknown = ORDER) => {
  execute.mockResolvedValue(order);
  render(
    <BrowserRouter>
      <MerchandiseOrderDetailsPage />
    </BrowserRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

/** The heading identifies the order by its id. */
const loaded = () => screen.findByText(/ord-1/i);

const writes = () => execute.mock.calls.map(([r]) => r).filter((r) => r.method === 'PUT');

const writeTo = (fragment: string) => writes().find((r) => r.url.includes(fragment));

const clickButton = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

const notesBox = () => screen.getByPlaceholderText(/notes/i);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'ord-1' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MerchandiseOrderDetailsPage — showing the order', () => {
  it('reads the order named in the route', async () => {
    await renderPage();
    await loaded();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/merchandise-orders/ord-1',
    });
  });

  it('shows what was ordered and by whom', async () => {
    await renderPage();
    await loaded();

    expect(screen.getByText(/Club Polo Shirt/)).toBeInTheDocument();
    expect(screen.getByText(/Aoife Byrne/)).toBeInTheDocument();
  });

  it('shows the notes already written on the order', async () => {
    await renderPage({ ...ORDER, adminNotes: 'Collected in person' });
    await loaded();

    expect(notesBox()).toHaveValue('Collected in person');
  });

  it('shows an order whose item has no options to list', async () => {
    // `Object.entries(null)` throws, and a thrown render is a blank page.
    await renderPage({ ...ORDER, selectedOptions: null });

    await loaded();
  });

  it('says the order does not exist rather than showing a blank page', async () => {
    await renderPage(null);

    expect(await screen.findByText(/orderNotFound|not found/i)).toBeInTheDocument();
  });

  it('reports a failed load separately from a missing order', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(
      <BrowserRouter>
        <MerchandiseOrderDetailsPage />
      </BrowserRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('MerchandiseOrderDetailsPage — moving the order along', () => {
  const openStatusDialog = async () => {
    clickButton(/status|update/i);
    return screen.findByRole('dialog');
  };

  it('asks before changing anything', async () => {
    await renderPage();
    await loaded();

    await openStatusDialog();

    expect(writes()).toHaveLength(0);
  });

  it('writes the new status against this order', async () => {
    await renderPage();
    await loaded();
    const dialog = await openStatusDialog();

    fireEvent.click(within(dialog).getAllByRole('button').find((b) => /update|save/i.test(b.textContent ?? ''))!);

    await waitFor(() =>
      expect(writeTo('/status')).toMatchObject({
        url: '/api/orgadmin/merchandise-orders/ord-1/status',
      })
    );
  });

  it('passes the club’s decision about emailing the member through to the server', async () => {
    await renderPage();
    await loaded();
    const dialog = await openStatusDialog();

    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getAllByRole('button').find((b) => /update|save/i.test(b.textContent ?? ''))!);

    // Deciding this on the member's behalf either spams them or leaves them
    // wondering where their order is.
    await waitFor(() => expect(writeTo('/status')).toBeDefined());
    expect(writeTo('/status')!.data.sendEmail).toBe(false);
  });

  it('re-reads the order so the screen matches what was written', async () => {
    await renderPage();
    await loaded();
    const dialog = await openStatusDialog();

    fireEvent.click(within(dialog).getAllByRole('button').find((b) => /update|save/i.test(b.textContent ?? ''))!);

    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === 'GET').length).toBeGreaterThan(1)
    );
  });

  it('says so when the status could not be changed', async () => {
    await renderPage();
    await loaded();
    const dialog = await openStatusDialog();
    execute.mockRejectedValue(new Error('refused'));

    fireEvent.click(within(dialog).getAllByRole('button').find((b) => /update|save/i.test(b.textContent ?? ''))!);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('MerchandiseOrderDetailsPage — the club’s own notes', () => {
  it('saves the notes on their own endpoint, not with the status', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(notesBox(), { target: { value: 'Left with the yard manager' } });
    clickButton(/save/i);

    await waitFor(() =>
      expect(writeTo('/notes')).toMatchObject({
        url: '/api/orgadmin/merchandise-orders/ord-1/notes',
        data: { adminNotes: 'Left with the yard manager' },
      })
    );
    expect(writeTo('/status')).toBeUndefined();
  });

  it('says so when the notes could not be saved', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('refused'));

    fireEvent.change(notesBox(), { target: { value: 'Left with the yard manager' } });
    clickButton(/save/i);

    // Silently failing here loses what the club just wrote down.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('saves an emptied note as a deliberate clearing', async () => {
    await renderPage({ ...ORDER, adminNotes: 'Old note' });
    await loaded();

    fireEvent.change(notesBox(), { target: { value: '' } });
    clickButton(/save/i);

    await waitFor(() => expect(writeTo('/notes')).toBeDefined());
    expect(writeTo('/notes')!.data.adminNotes).toBe('');
  });
});

describe('MerchandiseOrderDetailsPage — printing', () => {
  it('prints the order without leaving the page', async () => {
    await renderPage();
    await loaded();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});

    clickButton(/print/i);

    expect(print).toHaveBeenCalled();
  });
});
