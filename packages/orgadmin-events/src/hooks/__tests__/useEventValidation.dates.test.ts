/**
 * All four event dates are required.
 *
 * An event runs between two dates and takes entries between two others. None
 * has a usable default: a null entry window means *unbounded* to the server, so
 * an event created without one is permanently open to entries. The form used to
 * hide the omission by filling absent entry dates with the current time — which
 * created events closed to entries, and gave edited ones a window nobody chose.
 * See docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@itsplainsailing/orgadmin-shell', async () => ({
  ...(await import('@itsplainsailing/orgadmin-core/test/shellMock')).createShellMock(),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-GB' },
  }),
}));

import { useEventValidation } from '../useEventValidation';
import type { EventFormData } from '../../types/event.types';

const DATES_STEP = 1;

/** A form with every date filled in and in order. */
const validDates = (overrides: Partial<EventFormData> = {}): EventFormData =>
  ({
    name: 'Summer Regatta',
    description: 'Annual regatta',
    activities: [],
    startDate: new Date('2026-09-19T00:00:00.000Z'),
    endDate: new Date('2026-09-20T00:00:00.000Z'),
    openDateEntries: new Date('2026-08-19T12:00:00.000Z'),
    entriesClosingDate: new Date('2026-09-12T12:00:00.000Z'),
    ...overrides,
  }) as EventFormData;

const renderValidation = () => renderHook(() => useEventValidation()).result.current;

describe('useEventValidation – dates', () => {
  it('accepts a complete, well-ordered set of dates', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(validDates());

    expect(errors.startDate).toBeUndefined();
    expect(errors.endDate).toBeUndefined();
    expect(errors.openDateEntries).toBeUndefined();
    expect(errors.entriesClosingDate).toBeUndefined();
  });

  it.each([
    ['startDate', 'events.dates.validation.startDateRequired'],
    ['endDate', 'events.dates.validation.endDateRequired'],
    ['openDateEntries', 'events.dates.validation.openDateEntriesRequired'],
    ['entriesClosingDate', 'events.dates.validation.entriesClosingDateRequired'],
  ])('requires %s', (field, message) => {
    const { validateAll } = renderValidation();

    const errors = validateAll(validDates({ [field]: undefined } as Partial<EventFormData>));

    expect(errors[field]).toBe(message);
  });

  it('reports every missing date at once rather than one at a time', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      validDates({
        startDate: undefined,
        endDate: undefined,
        openDateEntries: undefined,
        entriesClosingDate: undefined,
      } as Partial<EventFormData>),
    );

    // Four saves to discover four missing fields would be a poor way to find out.
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['startDate', 'endDate', 'openDateEntries', 'entriesClosingDate']),
    );
  });

  it('treats null and empty string as missing, not as a value', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      validDates({ openDateEntries: null, entriesClosingDate: '' } as any),
    );

    expect(errors.openDateEntries).toBe('events.dates.validation.openDateEntriesRequired');
    expect(errors.entriesClosingDate).toBe(
      'events.dates.validation.entriesClosingDateRequired',
    );
  });

  it('treats a half-typed, unparseable date as missing', () => {
    const { validateAll } = renderValidation();

    // What the picker's text input produces mid-keystroke. Counting it as
    // present would send `Invalid Date` to the server.
    const errors = validateAll(validDates({ startDate: new Date('nonsense') } as any));

    expect(errors.startDate).toBe('events.dates.validation.startDateRequired');
  });

  it('accepts an ISO string as well as a Date', () => {
    const { validateAll } = renderValidation();

    // The form holds Dates, but an event loaded from the API arrives as strings.
    const errors = validateAll(
      validDates({
        startDate: '2026-09-19T00:00:00.000Z',
        endDate: '2026-09-20T00:00:00.000Z',
      } as any),
    );

    expect(errors.startDate).toBeUndefined();
    expect(errors.endDate).toBeUndefined();
  });

  it('rejects an end date before the start date', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      validDates({ endDate: new Date('2026-09-18T00:00:00.000Z') }),
    );

    expect(errors.endDate).toBe('events.dates.validation.endBeforeStart');
  });

  it('accepts a single-day event', () => {
    const { validateAll } = renderValidation();

    const sameDay = new Date('2026-09-19T00:00:00.000Z');
    const errors = validateAll(validDates({ startDate: sameDay, endDate: sameDay }));

    expect(errors.endDate).toBeUndefined();
  });

  it('rejects entries closing before they open', () => {
    const { validateAll } = renderValidation();

    const errors = validateAll(
      validDates({ entriesClosingDate: new Date('2026-08-18T12:00:00.000Z') }),
    );

    expect(errors.entriesClosingDate).toBe('events.dates.validation.closingBeforeOpening');
  });

  it('rejects an entry window of zero length', () => {
    const { validateAll } = renderValidation();

    const instant = new Date('2026-08-19T12:00:00.000Z');
    const errors = validateAll(
      validDates({ openDateEntries: instant, entriesClosingDate: instant }),
    );

    // Opening and closing at the same instant is a window nobody can enter.
    expect(errors.entriesClosingDate).toBe('events.dates.validation.closingBeforeOpening');
  });

  it('blocks the wizard on the dates step', () => {
    const { validateStep } = renderValidation();

    const errors = validateStep(
      DATES_STEP,
      validDates({ openDateEntries: undefined } as Partial<EventFormData>),
    );

    // The step used to have no validation at all, so Next always advanced.
    expect(errors.openDateEntries).toBe('events.dates.validation.openDateEntriesRequired');
  });

  it('lets the wizard past the dates step once they are all set', () => {
    const { validateStep } = renderValidation();

    expect(validateStep(DATES_STEP, validDates())).toEqual({});
  });
});
