import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import WhatsOnStatus, { whatsOnStateFor } from '../WhatsOnStatus';
import { DashboardWhatsOn } from '../../types/account';

// Echoes the interpolated date so the detail lines can be asserted on without
// depending on the English wording.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) =>
      options?.date ? `${key}:${options.date}` : key,
    i18n: { language: 'en-GB' },
  }),
}));

const NOW = new Date('2026-08-14T09:00:00Z');

const teaser = (over: Partial<DashboardWhatsOn> = {}): DashboardWhatsOn => ({
  kind: 'event',
  id: 'event-1',
  title: 'Summer Camp',
  detail: null,
  fee: null,
  startDate: '2026-09-01',
  endDate: null,
  entriesOpenDate: null,
  entriesClosingDate: null,
  entriesLimit: null,
  placesRemaining: null,
  ...over,
});

describe('whatsOnStateFor', () => {
  it('says nothing about a thing with no window and no cap', () => {
    // A polo shirt is not "open".
    expect(whatsOnStateFor(teaser({ kind: 'merchandise', startDate: null }), NOW)).toBeNull();
  });

  it('treats absent window fields the same as null ones', () => {
    // An older payload omits them rather than sending null.
    const legacy = {
      kind: 'merchandise',
      id: 'item-1',
      title: 'Club Polo',
      detail: null,
      fee: 2500,
    } as unknown as DashboardWhatsOn;

    expect(whatsOnStateFor(legacy, NOW)).toBeNull();
  });

  it('is open when entries are running with room to spare', () => {
    const state = whatsOnStateFor(
      teaser({ entriesOpenDate: '2026-07-01T09:00:00Z', entriesClosingDate: '2026-10-01T09:00:00Z' }),
      NOW
    );

    expect(state).toBe('open');
  });

  it('is opening soon before the window starts', () => {
    const state = whatsOnStateFor(teaser({ entriesOpenDate: '2026-08-20T09:00:00Z' }), NOW);

    expect(state).toBe('opening-soon');
  });

  it('reports a distant opening as opening soon rather than as open', () => {
    // The teaser has one chip, so `not-open` and `opening-soon` collapse. What
    // must not happen is a not-yet-open event reading as enterable.
    const state = whatsOnStateFor(teaser({ entriesOpenDate: '2027-01-01T09:00:00Z' }), NOW);

    expect(state).toBe('opening-soon');
  });

  it('is closing soon as the deadline approaches', () => {
    const state = whatsOnStateFor(teaser({ entriesClosingDate: '2026-08-17T09:00:00Z' }), NOW);

    expect(state).toBe('closing-soon');
  });

  it('is closed once the deadline has passed', () => {
    const state = whatsOnStateFor(teaser({ entriesClosingDate: '2026-08-01T09:00:00Z' }), NOW);

    expect(state).toBe('closed');
  });

  it('is full when an open event has no places left', () => {
    const state = whatsOnStateFor(
      teaser({
        entriesClosingDate: '2026-10-01T09:00:00Z',
        entriesLimit: 40,
        placesRemaining: 0,
      }),
      NOW
    );

    expect(state).toBe('full');
  });

  it('reports a closed event as closed even when it is also full', () => {
    // "Full" beside "closed" would read as an invitation to try anyway.
    const state = whatsOnStateFor(
      teaser({
        entriesClosingDate: '2026-08-01T09:00:00Z',
        entriesLimit: 40,
        placesRemaining: 0,
      }),
      NOW
    );

    expect(state).toBe('closed');
  });

  it('does not claim a not-yet-open event is full', () => {
    // Before entries open the cap is the size of the field, not an inventory
    // count that has run out.
    const state = whatsOnStateFor(
      teaser({ entriesOpenDate: '2026-09-01T09:00:00Z', entriesLimit: 40, placesRemaining: 0 }),
      NOW
    );

    expect(state).toBe('opening-soon');
  });
});

describe('WhatsOnStatus', () => {
  it('renders the state as a single chip', () => {
    render(<WhatsOnStatus item={teaser({ entriesClosingDate: '2026-08-17T09:00:00Z' })} now={NOW} />);

    expect(screen.getByText('home.status.closing-soon')).toBeInTheDocument();
  });

  it('shows both the opening and the closing moment before entries open', () => {
    render(
      <WhatsOnStatus
        item={teaser({
          entriesOpenDate: '2026-08-16T09:00:00Z',
          entriesClosingDate: '2026-09-20T23:59:00Z',
        })}
        now={NOW}
      />
    );

    // When can I enter, and how long will I have.
    expect(screen.getByText(/browse\.entries\.opensDetail:/)).toBeInTheDocument();
    expect(screen.getByText(/browse\.entries\.closesDetail:/)).toBeInTheDocument();
  });

  it('shows only the closing moment once entries are open', () => {
    render(
      <WhatsOnStatus
        item={teaser({
          entriesOpenDate: '2026-07-01T09:00:00Z',
          entriesClosingDate: '2026-10-01T09:00:00Z',
        })}
        now={NOW}
      />
    );

    // The opening date is history and does not earn the line.
    expect(screen.queryByText(/browse\.entries\.opensDetail:/)).not.toBeInTheDocument();
    expect(screen.getByText(/browse\.entries\.closesDetail:/)).toBeInTheDocument();
  });

  it('shows the closing moment while closing soon', () => {
    render(
      <WhatsOnStatus item={teaser({ entriesClosingDate: '2026-08-17T09:00:00Z' })} now={NOW} />
    );

    expect(screen.getByText(/browse\.entries\.closesDetail:/)).toBeInTheDocument();
  });

  it('says when entries closed rather than when they close', () => {
    render(
      <WhatsOnStatus item={teaser({ entriesClosingDate: '2026-08-01T09:00:00Z' })} now={NOW} />
    );

    expect(screen.getByText(/browse\.entries\.closed:/)).toBeInTheDocument();
    expect(screen.queryByText(/browse\.entries\.closesDetail:/)).not.toBeInTheDocument();
  });

  it('includes the time, not just the date', () => {
    // A closing at 09:00 is a different thing to plan around than one at 23:59.
    render(
      <WhatsOnStatus item={teaser({ entriesClosingDate: '2026-10-01T09:30:00Z' })} now={NOW} />
    );

    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('renders nothing for an item with no window', () => {
    const { container } = render(
      <WhatsOnStatus item={teaser({ kind: 'merchandise', startDate: null })} now={NOW} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
