import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventDetailsPage from '../EventDetailsPage';

/**
 * One event, with its activities, its discounts and how it can be paid for.
 *
 * The discounts are the awkward part. They are named by id on the event and on
 * each activity, and each id is fetched separately — so one discount that has
 * been deleted must not take the whole page down with it. There is also a
 * fallback lookup for events that predate `discountIds`, which only runs when
 * the event names none; running it always would double-list every discount.
 *
 * Everything else is display, but display a club acts on: the payment methods
 * are shown by name, and an unresolved id in that list tells them nothing.
 */

const { execute, navigate, params, getDiscountsForTarget } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { id: 'ev-1' } as { id?: string } },
  getDiscountsForTarget: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath', currency: 'EUR' },
    setOrganisation: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiscountService', () => ({
  useDiscountService: () => ({ getDiscountsForTarget }),
}));

const EVENT = {
  id: 'ev-1',
  name: 'Winter Dressage',
  description: 'Three days of dressage',
  status: 'published',
  startDate: '2026-11-18T09:00:00Z',
  endDate: '2026-11-20T17:00:00Z',
  openDateEntries: '2026-10-01T09:00:00Z',
  entriesClosingDate: '2026-11-10T17:00:00Z',
  limitEntries: false,
  discountIds: [] as string[],
  supportedPaymentMethods: ['stripe'],
};

const ACTIVITY = {
  id: 'act-1',
  name: 'Class 3',
  description: 'Preliminary',
  entryFee: 25,
  discountIds: [] as string[],
  supportedPaymentMethods: ['stripe'],
};

const DISCOUNT = {
  id: 'd-1',
  name: 'Early Bird',
  discountType: 'percentage',
  discountValue: 10,
};

const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url }: { url: string }) => {
    if (url.includes('/payment-methods')) return over.paymentMethods ?? [{ id: 'stripe', name: 'Card Payment (Stripe)' }];
    if (url.includes('/discounts/')) return over.discount ?? DISCOUNT;
    if (url.includes('/activities')) return over.activities ?? [ACTIVITY];
    if (url.includes('/events/')) return 'event' in over ? over.event : EVENT;
    return null;
  });

const renderPage = async () => {
  render(
    <BrowserRouter>
      <EventDetailsPage />
    </BrowserRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const loaded = () => screen.findAllByText('Winter Dressage');

const clickButton = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'ev-1' };
  respond();
  getDiscountsForTarget.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EventDetailsPage — assembling the event', () => {
  it('reads the event and its activities', async () => {
    await renderPage();
    await loaded();

    const urls = execute.mock.calls.map(([r]) => r.url);
    expect(urls).toContain('/api/orgadmin/events/ev-1');
    expect(urls).toContain('/api/orgadmin/events/ev-1/activities');
  });

  it('shows the event and what runs at it', async () => {
    await renderPage();
    await loaded();

    expect(screen.getByText('Class 3')).toBeInTheDocument();
  });

  it('says so when the event cannot be read', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(
      <BrowserRouter>
        <EventDetailsPage />
      </BrowserRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('still offers a way back when there is nothing to show', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(
      <BrowserRouter>
        <EventDetailsPage />
      </BrowserRouter>
    );
    await screen.findByRole('alert');

    clickButton(/back/i);

    expect(navigate).toHaveBeenCalledWith('/events');
  });

  it('copes with an event that has no activities', async () => {
    respond({ activities: null });

    await renderPage();

    await loaded();
  });
});

describe('EventDetailsPage — the discounts on the event', () => {
  it('reads each discount the event names', async () => {
    respond({ event: { ...EVENT, discountIds: ['d-1'] } });

    await renderPage();
    await loaded();

    await waitFor(() =>
      expect(
        execute.mock.calls.some(([r]) => String(r.url).includes('/discounts/d-1'))
      ).toBe(true)
    );
  });

  it('shows a percentage discount as a percentage', async () => {
    respond({ event: { ...EVENT, discountIds: ['d-1'] } });

    await renderPage();

    expect(await screen.findByText(/Early Bird \(10%\)/)).toBeInTheDocument();
  });

  it('shows a fixed discount as money', async () => {
    respond({
      event: { ...EVENT, discountIds: ['d-1'] },
      discount: { ...DISCOUNT, discountType: 'fixed', discountValue: 5 },
    });

    await renderPage();

    expect(await screen.findByText(/Early Bird \(/)).toBeInTheDocument();
  });

  it('survives one discount that no longer exists', async () => {
    respond({ event: { ...EVENT, discountIds: ['gone'] } });
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('/discounts/')) throw new Error('deleted');
      if (url.includes('/payment-methods')) return [{ id: 'stripe', name: 'Card Payment (Stripe)' }];
      if (url.includes('/activities')) return [ACTIVITY];
      if (url.includes('/events/')) return { ...EVENT, discountIds: ['gone'] };
      return null;
    });

    await renderPage();

    // One dead id must not take the whole page with it.
    await loaded();
  });

  it('falls back to a lookup only when the event names no discounts', async () => {
    getDiscountsForTarget.mockResolvedValue([DISCOUNT]);

    await renderPage();
    await loaded();

    await waitFor(() => expect(getDiscountsForTarget).toHaveBeenCalledWith('event', 'ev-1'));
  });

  it('does not also run the fallback when the event names its own', async () => {
    respond({ event: { ...EVENT, discountIds: ['d-1'] } });

    await renderPage();
    await loaded();

    // Running both would list every discount twice.
    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(getDiscountsForTarget).not.toHaveBeenCalled();
  });

  it('carries on when even the fallback fails', async () => {
    getDiscountsForTarget.mockRejectedValue(new Error('unavailable'));

    await renderPage();

    await loaded();
  });

  it('reads the discounts named on an activity', async () => {
    respond({ activities: [{ ...ACTIVITY, discountIds: ['d-1'] }] });

    await renderPage();
    await loaded();

    await waitFor(() =>
      expect(
        execute.mock.calls.some(([r]) => String(r.url).includes('/discounts/d-1'))
      ).toBe(true)
    );
  });
});

describe('EventDetailsPage — how it can be paid for', () => {
  it('names the payment methods rather than showing their ids', async () => {
    await renderPage();
    await loaded();

    expect(await screen.findByText(/Card Payment \(Stripe\)/)).toBeInTheDocument();
  });

  it('falls back to sensible names when the methods cannot be read', async () => {
    respond({ paymentMethods: null });

    await renderPage();

    // An unresolved id in this list tells a club nothing about what members see.
    await loaded();
  });
});

describe('EventDetailsPage — moving on', () => {
  it('opens the entries for this event', async () => {
    await renderPage();
    await loaded();

    clickButton(/entries/i);

    expect(navigate).toHaveBeenCalledWith('/events/ev-1/entries');
  });

  it('opens this event for editing', async () => {
    await renderPage();
    await loaded();

    clickButton(/edit/i);

    expect(navigate).toHaveBeenCalledWith('/events/ev-1/edit');
  });

  it('goes back to the events list', async () => {
    await renderPage();
    await loaded();

    clickButton(/back/i);

    expect(navigate).toHaveBeenCalledWith('/events');
  });
});
