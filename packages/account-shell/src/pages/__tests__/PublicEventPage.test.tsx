/**
 * One public event — the page a search result points at.
 *
 * The assertions worth having are about URLs and about what a stranger is told
 * before they commit. A club posts a link in March and renames the event in
 * May; the link must still work, and it must not leave one event indexable at
 * two addresses.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import PublicEventPage from '../PublicEventPage';
import { setupI18n } from '../../test/renderWithProviders';
import type { PublicEvent } from '../../types/publicEvents';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let params = { orgCode: 'khpc', slug: 'spring-show-a1b2c3d4' };

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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => params };
});

const activity = (over: Partial<PublicEvent['activities'][0]> = {}) => ({
  id: 'act-1',
  name: 'Grade 1 — 80cm',
  description: null,
  fee: 2500,
  entriesLimit: 40,
  placesRemaining: 12,
  membersOnly: false,
  membersOnlyScope: null,
  ...over,
});

const event = (over: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'ev-1',
  slug: 'spring-show-a1b2c3d4',
  name: 'Spring Show Jumping League',
  description: 'Four rounds over the spring.',
  startDate: '2026-09-09T00:00:00.000Z',
  endDate: '2026-09-09T00:00:00.000Z',
  entriesOpenDate: '2026-08-01T00:00:00.000Z',
  entriesClosingDate: '2026-09-02T00:00:00.000Z',
  entriesLimit: 120,
  placesRemaining: 112,
  eventType: 'Show Jumping',
  venue: { name: 'Craddockstown', address: 'Naas, Co. Kildare', region: 'Co. Kildare' },
  location: null,
  organisation: { code: 'khpc', name: 'Kildare Hunt Pony Club', currency: 'EUR' },
  activities: [activity()],
  updatedAt: '2026-08-14T00:00:00.000Z',
  ...over,
});

const respond = (payload: { event: PublicEvent; canonicalSlug: string } | null) =>
  mockExecute.mockImplementation(() =>
    payload ? Promise.resolve(payload) : Promise.reject(new Error('not found'))
  );

const renderPage = () =>
  render(
    <I18nextProvider i18n={setupI18n()}>
      <MemoryRouter>
        <PublicEventPage />
      </MemoryRouter>
    </I18nextProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockReset();
  params = { orgCode: 'khpc', slug: 'spring-show-a1b2c3d4' };
  respond({ event: event(), canonicalSlug: 'spring-show-a1b2c3d4' });
});

describe('reading the event', () => {
  it('asks anonymously', async () => {
    // The visitor arrived from a search result and has no session.
    renderPage();

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ anonymous: true }))
    );
  });

  it('shows the club, the venue and every activity with its price', async () => {
    renderPage();

    expect(await screen.findByText('Spring Show Jumping League')).toBeInTheDocument();
    expect(screen.getByText('Kildare Hunt Pony Club')).toBeInTheDocument();
    expect(screen.getByText('Grade 1 — 80cm')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
  });

  it('lists a members-only activity, labelled, rather than hiding it', async () => {
    /*
     * A show with eight classes would look like it had three. "Members only"
     * also tells a reader something true: joining is the way in.
     */
    respond({
      event: event({
        activities: [activity(), activity({ id: 'act-2', name: "Members' Cup", membersOnly: true, membersOnlyScope: 'club' })],
      }),
      canonicalSlug: 'spring-show-a1b2c3d4',
    });
    renderPage();

    expect(await screen.findByText("Members' Cup")).toBeInTheDocument();
    expect(screen.getByText('Members only')).toBeInTheDocument();
  });

  it('says an activity is open to any branch when it is', async () => {
    respond({
      event: event({
        activities: [activity({ membersOnly: true, membersOnlyScope: 'organisation-type' })],
      }),
      canonicalSlug: 'spring-show-a1b2c3d4',
    });
    renderPage();

    expect(await screen.findByText('Members of any branch')).toBeInTheDocument();
  });

  it('reports an event it cannot find rather than an empty page', async () => {
    respond(null);
    renderPage();

    expect(await screen.findByText(/could not find that event/i)).toBeInTheDocument();
  });
});

describe('the URL', () => {
  it('corrects a stale slug in place', async () => {
    /*
     * A club posted the link in March and renamed the event in May. The old
     * address still resolves — by the id inside it — and the browser is moved
     * to the current one so a single event is not indexable twice.
     */
    params = { orgCode: 'khpc', slug: 'the-old-name-a1b2c3d4' };
    respond({ event: event(), canonicalSlug: 'spring-show-a1b2c3d4' });
    renderPage();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/khpc/whats-on/spring-show-a1b2c3d4', {
        replace: true,
      })
    );
  });

  it('leaves a current slug alone', async () => {
    renderPage();
    await screen.findByText('Spring Show Jumping League');

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('titles the document with the event and the club', async () => {
    // What a search result headline and a shared link actually show.
    renderPage();
    await screen.findByText('Spring Show Jumping League');

    await waitFor(() =>
      expect(document.title).toBe('Spring Show Jumping League · Kildare Hunt Pony Club')
    );
  });

  it('declares one canonical address for the event', async () => {
    renderPage();
    await screen.findByText('Spring Show Jumping League');

    await waitFor(() =>
      expect(document.head.querySelector('link[rel=canonical]')?.getAttribute('href')).toContain(
        '/account/khpc/whats-on/spring-show-a1b2c3d4'
      )
    );
  });
});

describe('entering', () => {
  it('warns that signing in comes first, before the visitor commits', async () => {
    /*
     * A stranger who clicks "Enter" and lands on a sign-in wall has been
     * ambushed. Told first, the same screen is the expected next step.
     */
    renderPage();

    expect(await screen.findByText(/sign in or create an account/i)).toBeInTheDocument();
  });

  it('sends them straight to that activity’s entry form', async () => {
    /*
     * Per activity, not per event. A show with six classes used to offer one
     * button at the foot of the page, which left the reader to find the class
     * again on the next screen.
     *
     * The id in the URL is the **activity's**, and the route it lands on is the
     * entry form itself — so signing in returns them to the form rather than to
     * the club's home page.
     */
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /^Enter$/ }));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc/browse/events/act-1/enter');
  });

  it('offers one entry point per activity', async () => {
    respond({
      event: event({
        activities: [activity(), activity({ id: 'act-2', name: 'Grade 2' })],
      }),
      canonicalSlug: 'spring-show-a1b2c3d4',
    });
    renderPage();

    await waitFor(async () =>
      expect(await screen.findAllByRole('button', { name: /^Enter$/ })).toHaveLength(2)
    );
  });

  it('offers no way in to a full activity', async () => {
    // A button that leads to a refusal is worse than no button.
    respond({
      event: event({ activities: [activity({ placesRemaining: 0 })] }),
      canonicalSlug: 'spring-show-a1b2c3d4',
    });
    renderPage();

    await screen.findByText('Full');
    expect(screen.queryByRole('button', { name: /^Enter$/ })).not.toBeInTheDocument();
  });

  it('says why there is nothing to click when entries are closed', async () => {
    respond({
      event: event({ entriesClosingDate: '2020-01-01T00:00:00.000Z' }),
      canonicalSlug: 'spring-show-a1b2c3d4',
    });
    renderPage();

    expect(await screen.findByText(/Entries for this event have closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Enter$/ })).not.toBeInTheDocument();
  });

  it('offers no way in to an event that has already happened', async () => {
    respond({
      event: event({ startDate: '2020-01-01T00:00:00.000Z', endDate: '2020-01-01T00:00:00.000Z' }),
      canonicalSlug: 'spring-show-a1b2c3d4',
    });
    renderPage();

    await screen.findByText('Spring Show Jumping League');
    expect(screen.queryByRole('button', { name: /^Enter$/ })).not.toBeInTheDocument();
  });
});
