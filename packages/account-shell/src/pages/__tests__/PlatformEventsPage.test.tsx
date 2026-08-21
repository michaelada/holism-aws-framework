/**
 * The platform listing — every club's public events in one place.
 *
 * The only page in the product with no signed-in reader. Three things are worth
 * pinning: that it works for a visitor with no session at all, that refining it
 * is shareable, and that a refined view is kept out of search results.
 *
 * See docs/PUBLIC_EVENTS_WIREFRAMES.md §2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import PlatformEventsPage from '../PlatformEventsPage';
import { setupI18n } from '../../test/renderWithProviders';
import type { PublicEvent } from '../../types/publicEvents';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();

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
  return { ...actual, useNavigate: () => mockNavigate };
});

const event = (over: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'ev-1',
  slug: 'spring-show-a1b2c3d4',
  name: 'Spring Show Jumping League',
  description: 'Four rounds.',
  startDate: '2026-09-09T00:00:00.000Z',
  endDate: '2026-09-09T00:00:00.000Z',
  entriesOpenDate: null,
  entriesClosingDate: null,
  entriesLimit: null,
  placesRemaining: null,
  eventType: 'Show Jumping',
  venue: { name: 'Craddockstown', address: 'Naas', region: 'Co. Kildare' },
  location: null,
  organisation: { code: 'khpc', name: 'Kildare Hunt Pony Club', currency: 'EUR' },
  activities: [
    {
      id: 'act-1',
      name: 'Grade 1',
      description: null,
      fee: 2500,
      entriesLimit: null,
      placesRemaining: null,
      membersOnly: false,
      membersOnlyScope: null,
    },
  ],
  updatedAt: '2026-08-14T00:00:00.000Z',
  ...over,
});

const filters = {
  eventTypes: [{ value: 'Show Jumping', count: 3 }, { value: 'Dressage', count: 1 }],
  regions: [{ value: 'Co. Kildare', count: 4 }],
  organisations: [{ value: 'khpc', label: 'Kildare Hunt Pony Club', count: 4 }],
};

/** Routes by URL: the listing, and the filter vocabularies. */
const respond = (events: PublicEvent[], total = events.length) => {
  mockExecute.mockImplementation((request: { url: string }) => {
    if (request.url.includes('/events/filters')) return Promise.resolve(filters);
    return Promise.resolve({ events, total });
  });
};

const renderPage = (initialEntries = ['/events']) =>
  render(
    <I18nextProvider i18n={setupI18n()}>
      <MemoryRouter initialEntries={initialEntries}>
        <PlatformEventsPage />
      </MemoryRouter>
    </I18nextProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockReset();
  respond([event()]);
  document.head.querySelectorAll('meta[name=robots]').forEach((node) => node.remove());
});

describe('a visitor with no session', () => {
  it('asks anonymously, or the request would need a login the visitor has not got', async () => {
    renderPage();

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ anonymous: true, url: expect.stringContaining('/api/public/events') })
      )
    );
  });

  it('lists an event with the club that runs it', async () => {
    // The fact a cross-club listing turns on: whose event this is.
    renderPage();

    /*
     * Scoped to the row: the club also appears in the filter panel, and a bare
     * `getByText` would pass on either without proving the row names it.
     */
    const heading = await screen.findByText('Spring Show Jumping League');
    const row = heading.closest('.MuiCard-root') as HTMLElement;
    expect(within(row).getByText('Kildare Hunt Pony Club')).toBeInTheDocument();
  });

  it('opens the club’s own event page, not the member app', async () => {
    renderPage();

    await userEvent.click(await screen.findByText('Spring Show Jumping League'));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc/whats-on/spring-show-a1b2c3d4');
  });
});

describe('refining', () => {
  it('shows what each filter will cost before it is clicked', async () => {
    // A count beside every option, so a click is not a guess.
    renderPage();

    const showJumping = await screen.findByRole('checkbox', { name: /Show Jumping/i });
    expect(within(showJumping.closest('label')!).getByText('3')).toBeInTheDocument();
  });

  it('puts the refinement in the URL, so it can be shared and gone back from', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Dressage/i }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('type=Dressage') })
      )
    );
  });

  it('reads its starting state back out of the URL', async () => {
    // Someone opening a shared link sees the same list the sharer did.
    renderPage(['/events?type=Dressage']);

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('type=Dressage') })
      )
    );
    expect(await screen.findByRole('checkbox', { name: /Dressage/i })).toBeChecked();
  });

  it('offers a way back when nothing matches', async () => {
    // An empty page with no way out is where a visitor leaves.
    respond([], 0);
    renderPage(['/events?type=Dressage']);

    expect(await screen.findByText(/No events match/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Clear all/i }).length).toBeGreaterThan(0);
  });

  it('says something different when no club has published anything', async () => {
    /*
     * "No events match those filters" to someone who has set no filters is the
     * software blaming them for its own emptiness.
     */
    respond([], 0);
    renderPage();

    expect(await screen.findByText(/No clubs have published/)).toBeInTheDocument();
  });
});

describe('what search engines are told', () => {
  it('leaves the unfiltered list indexable', async () => {
    renderPage();
    await screen.findByText('Spring Show Jumping League');

    expect(document.head.querySelector('meta[name=robots]')).toBeNull();
  });

  it('keeps a filtered view out of the index, but still crawlable', async () => {
    /*
     * A filtered view is the same content rearranged, and there are unbounded
     * combinations. `follow` matters as much as `noindex`: the links out still
     * lead to individual events worth crawling.
     */
    renderPage(['/events?type=Dressage']);
    await screen.findByText('Spring Show Jumping League');

    await waitFor(() =>
      expect(document.head.querySelector('meta[name=robots]')?.getAttribute('content')).toBe(
        'noindex,follow'
      )
    );
  });

  it('gives the page its own title rather than the app’s', async () => {
    renderPage();
    await screen.findByText('Spring Show Jumping League');

    await waitFor(() => expect(document.title).toContain("What's on"));
  });
});
