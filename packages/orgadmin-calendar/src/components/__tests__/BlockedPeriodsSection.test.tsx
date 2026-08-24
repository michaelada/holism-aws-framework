import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BlockedPeriodsSection from '../BlockedPeriodsSection';
import type { BlockedPeriodFormData } from '../../types/calendar.types';

/**
 * Where a club says when a facility is *not* bookable.
 *
 * Every edit here is reported upward through `onChange` rather than held
 * locally, so what is worth testing is the shape of what it hands back: a
 * period edited in place must not disturb its neighbours, and switching a
 * period's type must genuinely replace its fields — a date range that keeps its
 * `startDate` after becoming a time segment is a block the calculator will
 * apply on the wrong days.
 */

const dateRange = (over: Partial<BlockedPeriodFormData> = {}): BlockedPeriodFormData =>
  ({
    blockType: 'date_range',
    startDate: new Date('2026-12-24'),
    endDate: new Date('2027-01-02'),
    reason: 'Christmas',
    ...over,
  }) as BlockedPeriodFormData;

const timeSegment = (over: Partial<BlockedPeriodFormData> = {}): BlockedPeriodFormData =>
  ({
    blockType: 'time_segment',
    daysOfWeek: [1, 3],
    startTime: '09:00',
    endTime: '17:00',
    reason: 'School hours',
    ...over,
  }) as BlockedPeriodFormData;

let onChange: ReturnType<typeof vi.fn>;

const renderSection = (periods: BlockedPeriodFormData[] = []) => {
  onChange = vi.fn();
  return render(<BlockedPeriodsSection blockedPeriods={periods} onChange={onChange} />);
};

/** The periods handed back by the most recent change. */
const reported = (): BlockedPeriodFormData[] => onChange.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BlockedPeriodsSection — adding and removing', () => {
  it('adds a date range, because that is the common case', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(reported()).toHaveLength(1);
    expect(reported()[0].blockType).toBe('date_range');
  });

  it('gives a new period both ends of a range, so it is valid the moment it exists', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    // A range missing an end is skipped entirely by `isSlotBlocked`.
    expect(reported()[0].startDate).toBeInstanceOf(Date);
    expect(reported()[0].endDate).toBeInstanceOf(Date);
  });

  it('keeps the periods already there when another is added', () => {
    renderSection([dateRange()]);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(reported()).toHaveLength(2);
    expect(reported()[0].reason).toBe('Christmas');
  });

  it('removes the period that was chosen, not the last one', () => {
    renderSection([dateRange({ reason: 'Christmas' }), dateRange({ reason: 'Resurfacing' })]);

    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
    fireEvent.click(deleteButtons[0]);

    expect(reported()).toHaveLength(1);
    expect(reported()[0].reason).toBe('Resurfacing');
  });
});

describe('BlockedPeriodsSection — editing one period', () => {
  it('changes a reason without touching the other period', () => {
    renderSection([dateRange({ reason: 'Christmas' }), dateRange({ reason: 'Resurfacing' })]);

    const reasonBoxes = screen.getAllByDisplayValue(/Christmas|Resurfacing/);
    fireEvent.change(reasonBoxes[0], { target: { value: 'Christmas closure' } });

    expect(reported()[0].reason).toBe('Christmas closure');
    expect(reported()[1].reason).toBe('Resurfacing');
  });

  it('changes a date on the period that was edited', () => {
    renderSection([dateRange()]);

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-20' } });

    expect(onChange).toHaveBeenCalled();
    expect(reported()).toHaveLength(1);
  });
});

describe('BlockedPeriodsSection — switching what kind of block it is', () => {
  /*
   * A replacement, not a merge. `isSlotBlocked` branches on `blockType` and
   * reads only that branch's fields, so a leftover `startDate` on a time
   * segment is silently ignored — until someone switches back and finds a date
   * they never set.
   */
  it('replaces a date range with a usable time segment', () => {
    renderSection([dateRange()]);

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText(/time/i));

    const period = reported()[0];
    expect(period.blockType).toBe('time_segment');
    expect(period.startTime).toBe('09:00');
    expect(period.endTime).toBe('17:00');
    expect(period.daysOfWeek).toEqual([]);
    expect(period.startDate).toBeUndefined();
  });

  it('replaces a time segment with a usable date range', () => {
    renderSection([timeSegment()]);

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText(/date/i));

    const period = reported()[0];
    expect(period.blockType).toBe('date_range');
    expect(period.startDate).toBeInstanceOf(Date);
    expect(period.daysOfWeek).toBeUndefined();
  });

  it('carries the reason across the switch, because it still applies', () => {
    renderSection([dateRange({ reason: 'Resurfacing' })]);

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText(/time/i));

    expect(reported()[0].reason).toBe('Resurfacing');
  });
});

describe('BlockedPeriodsSection — the days a time segment applies to', () => {
  it('adds a day that was not selected', () => {
    renderSection([timeSegment({ daysOfWeek: [1] })]);

    // The days are checkboxes labelled Sun–Sat, indexed the way `Date#getDay`
    // counts them: Sunday is 0, so Wednesday is 3.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wed' }));

    expect(reported()[0].daysOfWeek).toContain(3);
    expect(reported()[0].daysOfWeek).toContain(1);
  });

  it('removes a day that was already selected, rather than adding it twice', () => {
    renderSection([timeSegment({ daysOfWeek: [1, 3] })]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon' }));

    // A duplicated day is harmless to the calculator but makes the chip row lie.
    expect(reported()[0].daysOfWeek).toEqual([3]);
  });
});

describe('BlockedPeriodsSection — with nothing configured', () => {
  it('still offers a way to add the first period', () => {
    renderSection([]);

    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('reports nothing until something is done', () => {
    renderSection([]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
