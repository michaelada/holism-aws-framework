import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DiscountUsagePage, { basePathFor, statusColour } from '../DiscountUsagePage';

/**
 * What a discount has actually done.
 *
 * The list's *View Usage* icon has always navigated to `…/discounts/:id/stats`
 * and no module registered that path, so every club that clicked it got Page
 * Not Found. These tests are about the page it was reaching for — and about the
 * two things it must not do: report a discount nobody has used as though the
 * numbers had failed to load, and print uuids where a club expects names.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: 'discount-1' }),
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Kildare', currency: 'EUR' },
    setOrganisation: vi.fn(),
  }),
}));

const discount = (over: Record<string, unknown> = {}) => ({
  id: 'discount-1',
  name: 'Family membership 10%',
  code: 'FAMILY10',
  status: 'active',
  discountType: 'percentage',
  discountValue: 10,
  ...over,
});

const usage = (over: Record<string, unknown> = {}) => ({
  totalUses: 4,
  remainingUses: 36,
  totalDiscountGiven: 60,
  averageDiscountAmount: 15,
  topUsers: [
    { userId: 'user-1', name: 'Aoife Byrne', usageCount: 3, totalDiscountReceived: 45 },
    { userId: 'user-2', name: 'Conor McGrath', usageCount: 1, totalDiscountReceived: 15 },
  ],
  ...over,
});

const answer = (detail: unknown, stats: unknown) =>
  execute.mockImplementation(({ url }: { url: string }) =>
    Promise.resolve(url.endsWith('/stats') ? stats : detail)
  );

const renderPage = (props = {}) =>
  render(
    <BrowserRouter>
      <DiscountUsagePage {...props} />
    </BrowserRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  answer(discount(), usage());
});

describe('DiscountUsagePage', () => {
  it('leads with the discount, so the numbers belong to something', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Family membership 10%' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/FAMILY10/)).toBeInTheDocument();
  });

  it('reads the discount and its usage together', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Family membership 10%' });
    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/discounts/discount-1?organisationId=org-1',
    });
    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/discounts/discount-1/stats',
    });
  });

  it('shows what it was used and what it took off', async () => {
    renderPage();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('EUR 60.00')).toBeInTheDocument();
    expect(screen.getByText('36')).toBeInTheDocument();
    // The average appears again in the table below, against the member whose
    // one use it was — the figure at the top is the card beside "Total".
    expect(screen.getAllByText('EUR 15.00').length).toBe(2);
  });

  it('says a discount has no cap rather than showing nought left', async () => {
    // `0` remaining reads as a discount that has run out — the opposite.
    answer(discount(), usage({ remainingUses: undefined }));
    renderPage();

    expect(await screen.findByText('No limit')).toBeInTheDocument();
  });

  it('names who used it', async () => {
    renderPage();

    expect(await screen.findByText('Aoife Byrne')).toBeInTheDocument();
    expect(screen.getByText('Conor McGrath')).toBeInTheDocument();
    // Not the id the club has no way to read.
    expect(screen.queryByText('user-1')).not.toBeInTheDocument();
  });

  it('still counts a use by somebody since removed', async () => {
    answer(
      discount(),
      usage({ topUsers: [{ userId: 'user-9', usageCount: 2, totalDiscountReceived: 30 }] })
    );
    renderPage();

    expect(await screen.findByText('Member no longer on record')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('says a new discount has not been used, rather than looking broken', async () => {
    /*
     * The ordinary case for one just created. A table of nothing under four
     * zeroes reads as a page that failed to load.
     */
    answer(
      discount(),
      usage({
        totalUses: 0,
        totalDiscountGiven: 0,
        averageDiscountAmount: 0,
        topUsers: [],
      })
    );
    renderPage();

    expect(await screen.findByText('This discount has not been used yet.')).toBeInTheDocument();
  });

  it('reports a failure rather than an empty discount', async () => {
    answer(null, null);
    renderPage();

    expect(await screen.findByText('We could not load this discount.')).toBeInTheDocument();
  });

  it('goes back to the discounts of the module it was opened from', async () => {
    // The page is shared; the section it belongs to is not.
    renderPage({ moduleType: 'memberships' });

    (await screen.findByRole('button', { name: 'Back to discounts' })).click();
    expect(navigate).toHaveBeenCalledWith('/members/discounts');
  });

  it('opens the discount for editing where it lives', async () => {
    renderPage({ moduleType: 'calendar' });

    (await screen.findByRole('button', { name: 'Edit' })).click();
    expect(navigate).toHaveBeenCalledWith('/calendar/discounts/discount-1/edit');
  });
});

describe('basePathFor', () => {
  it('maps each module to its own section', () => {
    expect(basePathFor('memberships')).toBe('/members');
    expect(basePathFor('merchandise')).toBe('/merchandise');
    expect(basePathFor('calendar')).toBe('/calendar');
    expect(basePathFor('registrations')).toBe('/registrations');
  });

  it('falls back to events, which is where the page lives', () => {
    expect(basePathFor('events')).toBe('/events');
    expect(basePathFor('something-new')).toBe('/events');
  });
});

describe('statusColour', () => {
  it('marks an expired discount as something to notice', () => {
    expect(statusColour('active')).toBe('success');
    expect(statusColour('expired')).toBe('error');
    expect(statusColour('inactive')).toBe('default');
  });
});
