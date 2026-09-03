/**
 * The entry-date invention bug.
 *
 * An event with no entry window acquired one just by being opened for editing:
 * the form fell back to `new Date()` for both dates, sent the load time back on
 * the next save, and the audit trail then recorded an entry-date change against
 * somebody who had only edited the name. The real trail showed exactly that —
 * `openDateEntries: {from: null, to: "<the moment the form loaded>"}`.
 *
 * A null entry window is meaningful: `open_date_entries IS NULL OR
 * open_date_entries <= NOW()` in public-event.service, i.e. unbounded. So
 * inventing a value is a data change, not a default.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const execute = vi.fn();

/*
 * Stable references. The hook reloads reference data in effects keyed on
 * `execute` and `organisation`, so a fresh object per render loops forever and
 * the test times out. See CLAUDE.md §3.4.
 */
const API = { execute, loading: false, error: null, reset: vi.fn() };
const ORGANISATION = { id: 'org-1', name: 'Kildare Hunt Pony Club' };

vi.mock('@itsplainsailing/orgadmin-core', () => ({
  useApi: () => API,
  useOrganisation: () => ({ organisation: ORGANISATION }),
}));

import { useEventForm } from '../useEventForm';

/** An event as the API returns it, with whatever entry dates the test wants. */
const eventResponse = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-1',
  name: 'Christmas Fun Day',
  description: 'A day out',
  eventOwner: 'Committee',
  startDate: '2026-12-19T00:00:00.000Z',
  endDate: '2026-12-19T00:00:00.000Z',
  openDateEntries: null,
  entriesClosingDate: null,
  activities: [],
  discountIds: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reference-data loaders fire on mount; give them all something harmless.
  execute.mockResolvedValue([]);
});

describe('useEventForm — entry dates', () => {
  it('leaves an absent entry window absent when loading an event', async () => {
    const { result } = renderHook(() => useEventForm());

    execute.mockResolvedValueOnce(eventResponse());
    await act(async () => {
      await result.current.loadEvent('event-1');
    });

    await waitFor(() => expect(result.current.formData.name).toBe('Christmas Fun Day'));

    // The bug: these were `new Date()`, and the next save wrote them.
    expect(result.current.formData.openDateEntries).toBeUndefined();
    expect(result.current.formData.entriesClosingDate).toBeUndefined();
  });

  it('keeps the entry window an event does have', async () => {
    const { result } = renderHook(() => useEventForm());

    execute.mockResolvedValueOnce(
      eventResponse({
        openDateEntries: '2026-08-19T12:12:34.758Z',
        entriesClosingDate: '2026-09-12T12:12:34.758Z',
      }),
    );
    await act(async () => {
      await result.current.loadEvent('event-1');
    });

    await waitFor(() => expect(result.current.formData.openDateEntries).toBeInstanceOf(Date));

    // Round-tripped exactly: the same instant back out, to the millisecond.
    expect((result.current.formData.openDateEntries as Date).toISOString()).toBe(
      '2026-08-19T12:12:34.758Z',
    );
    expect((result.current.formData.entriesClosingDate as Date).toISOString()).toBe(
      '2026-09-12T12:12:34.758Z',
    );
  });

  it('starts a blank form with the entry window empty for the club to fill in', () => {
    const { result } = renderHook(() => useEventForm());

    /*
     * Both defaults used to be `new Date()`, so an untouched new event closed
     * its entries at the moment the form was created — `entries_closing_date >=
     * NOW()` fails a second later.
     *
     * Empty is not the same as optional: all four dates are required, and
     * `validateDates` blocks the save until they are set. The default's job is
     * to ask the question, not to answer it wrongly. See
     * useEventValidation.dates.test.ts.
     */
    expect(result.current.formData.openDateEntries).toBeUndefined();
    expect(result.current.formData.entriesClosingDate).toBeUndefined();
  });

  it('dates the blank form when it is opened, not when the bundle was imported', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2027-03-01T09:00:00.000Z'));
      const { result } = renderHook(() => useEventForm());

      expect((result.current.formData.startDate as Date).toISOString()).toBe(
        '2027-03-01T09:00:00.000Z',
      );

      // A tab left open overnight used to open its next Create Event form on
      // the date the bundle was first imported.
      vi.setSystemTime(new Date('2027-03-02T09:00:00.000Z'));
      const second = renderHook(() => useEventForm());

      expect((second.result.current.formData.startDate as Date).toISOString()).toBe(
        '2027-03-02T09:00:00.000Z',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('still fills a start and end date, which the column requires', async () => {
    const { result } = renderHook(() => useEventForm());

    execute.mockResolvedValueOnce(eventResponse({ startDate: null, endDate: null }));
    await act(async () => {
      await result.current.loadEvent('event-1');
    });

    await waitFor(() => expect(result.current.formData.name).toBe('Christmas Fun Day'));

    // start_date and end_date are NOT NULL, so the fallback there is correct.
    expect(result.current.formData.startDate).toBeInstanceOf(Date);
    expect(result.current.formData.endDate).toBeInstanceOf(Date);
  });

  it('sets a closing date when an opening date is chosen on an event that had none', async () => {
    const { result } = renderHook(() => useEventForm());

    execute.mockResolvedValueOnce(eventResponse());
    await act(async () => {
      await result.current.loadEvent('event-1');
    });
    await waitFor(() => expect(result.current.formData.name).toBe('Christmas Fun Day'));

    const opens = new Date('2026-11-01T10:00:00.000Z');
    act(() => {
      result.current.handleChange('openDateEntries', opens);
    });

    expect((result.current.formData.openDateEntries as Date).toISOString()).toBe(
      opens.toISOString(),
    );
    // An open date with no closing date would be a window that never shuts.
    expect((result.current.formData.entriesClosingDate as Date).toISOString()).toBe(
      '2026-11-01T11:00:00.000Z',
    );
  });
});
