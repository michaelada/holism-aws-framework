/**
 * A club's public programme.
 *
 * The page a club shares a link to. Two things are worth pinning: that it works
 * for a visitor with no session, and that a finished event is kept rather than
 * hidden — a club whose past programme vanishes looks inactive, and those URLs
 * hold whatever search ranking they earned.
 *
 * See docs/PUBLIC_EVENTS.md §4.1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import PublicEventsPage from '../PublicEventsPage';
import { setupI18n } from '../../test/renderWithProviders';
import type { PublicEvent } from '../../types/publicEvents';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let contextValue: any = {
  me: null,
  publicDetail: { displayName: 'Kildare Hunt Pony Club' },
};

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
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ orgCode: 'khpc' }) };
});

const event = (over: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'ev-1',
  slug: 'spring-show-a1b2c3d4',
  name: 'Spring Show Jumping League',
  description: 'Four rounds.',
  startDate: '2099-09-09T00:00:00.000Z',
  endDate: '2099-09-09T00:00:00.000Z',
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

const renderPage = () =>
  render(
    <I18nextProvider i18n={setupI18n()}>
      <MemoryRouter>
        <PublicEventsPage />
      </MemoryRouter>
    </I18nextProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockReset();
  mockExecute.mockResolvedValue([event()]);
  contextValue = { me: null, publicDetail: { displayName: 'Kildare Hunt Pony Club' } };
});

describe('a visitor with no session', () => {
  it('asks anonymously', async () => {
    renderPage();

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ anonymous: true }))
    );
  });

  it('names the club from the public record, not from /me', async () => {
    /*
     * `me` is null for a signed-out visitor, which is the case this page is
     * for. Taking the name from there headed the page "What's on at" with
     * nothing after it — which is how this was found.
     */
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /Kildare Hunt Pony Club/ })
    ).toBeInTheDocument();
  });

  it('offers a way in for someone who is not a member yet', async () => {
    // The page's second job: a stranger reading a club's programme is a
    // prospective member, and this is the only place that is reliably true.
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Sign in or create an account/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc');
  });
});

describe('the programme', () => {
  it('opens the event when a row is clicked', async () => {
    renderPage();

    await userEvent.click(await screen.findByText('Spring Show Jumping League'));

    expect(mockNavigate).toHaveBeenCalledWith('/khpc/whats-on/spring-show-a1b2c3d4');
  });

  it('shows the cheapest activity, so the row answers "how much"', async () => {
    renderPage();
    expect(await screen.findByText(/from €25\.00/)).toBeInTheDocument();
  });

  it('keeps a finished event, under its own heading', async () => {
    /*
     * Kept rather than hidden. A club whose past programme vanishes looks
     * inactive, and the URLs hold whatever ranking they earned.
     */
    mockExecute.mockResolvedValue([
      event(),
      event({
        id: 'ev-2',
        slug: 'last-year-b2c3d4e5',
        name: 'Last Year’s Show',
        startDate: '2020-05-01T00:00:00.000Z',
        endDate: '2020-05-01T00:00:00.000Z',
      }),
    ]);
    renderPage();

    expect(await screen.findByText('Previously')).toBeInTheDocument();
    const past = screen.getByText('Last Year’s Show').closest('.MuiCard-root') as HTMLElement;
    expect(within(past).getByText('Finished')).toBeInTheDocument();
  });

  it('says so plainly when the club has published nothing', async () => {
    mockExecute.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/not published any events publicly/i)).toBeInTheDocument();
  });

  it('reports a failure rather than an empty programme', async () => {
    // An empty page here reads as "this club runs nothing", which is a very
    // different claim from "we could not load it".
    mockExecute.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText(/could not load these events/i)).toBeInTheDocument();
  });
});
