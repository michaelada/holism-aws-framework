import { describe, it, expect } from 'vitest';
import { compareValues, sortRows } from '../sorting';

/**
 * The comparison every org-admin list table sorts through.
 *
 * What is worth testing is the type-reading and the two rules that are easy to
 * get wrong by not thinking about them: **empty sinks in both directions**, and
 * **a date is not text**. Alphabetical dates ("01 Feb" before "02 Jan") and a
 * column of blanks sitting on top of the earliest entry are the two failures a
 * reader notices immediately.
 */

const by = <T,>(rows: T[], key: keyof T & string, direction: 'asc' | 'desc' = 'asc') =>
  sortRows(rows, (row) => row[key], direction, 'en-GB');

describe('comparing two values', () => {
  it('reads numbers as numbers, not as text', () => {
    expect(compareValues(9, 10)).toBeLessThan(0);
    expect(compareValues(2.5, 2.25)).toBeGreaterThan(0);
  });

  it('reads a number written as text the same way', () => {
    // "Item 9" before "Item 10" — plain string order puts 10 first.
    expect(compareValues('Item 9', 'Item 10')).toBeLessThan(0);
  });

  it('reads an ISO date as a date', () => {
    expect(compareValues('2026-01-02', '2026-02-01')).toBeLessThan(0);
  });

  it('orders a date and a date-time in the same column against each other', () => {
    // One row has a time and another does not, which happens the moment a
    // column carries both an event date and an entry timestamp.
    expect(compareValues('2026-09-02', '2026-09-02T14:30:00.000Z')).toBeLessThan(0);
  });

  it('reads a time of day as a time', () => {
    expect(compareValues('9:30', '14:00')).toBeLessThan(0);
    expect(compareValues('09:05:30', '09:05:00')).toBeGreaterThan(0);
  });

  it('takes a Date object', () => {
    expect(compareValues(new Date('2026-01-01'), new Date('2026-06-01'))).toBeLessThan(0);
  });

  it('sorts false before true', () => {
    expect(compareValues(false, true)).toBeLessThan(0);
  });

  it('does not split a list into two alphabets over case or accents', () => {
    expect(compareValues('aoife', 'Bríd')).toBeLessThan(0);
    expect(compareValues('Éabha', 'Fionn')).toBeLessThan(0);
  });
});

describe('sorting rows', () => {
  const events = [
    { name: 'Tara Hunter Trial', starts: '2026-09-21', entries: 12 },
    { name: 'autumn gate day', starts: '2026-09-02', entries: 218 },
    { name: 'Spring Show', starts: '2026-03-14', entries: 9 },
  ];

  it('orders ascending, then descending', () => {
    expect(by(events, 'starts').map((event) => event.name)).toEqual([
      'Spring Show',
      'autumn gate day',
      'Tara Hunter Trial',
    ]);
    expect(by(events, 'starts', 'desc').map((event) => event.name)).toEqual([
      'Tara Hunter Trial',
      'autumn gate day',
      'Spring Show',
    ]);
  });

  it('orders numbers by size in both directions', () => {
    expect(by(events, 'entries').map((event) => event.entries)).toEqual([9, 12, 218]);
    expect(by(events, 'entries', 'desc').map((event) => event.entries)).toEqual([218, 12, 9]);
  });

  it('leaves the caller’s array alone', () => {
    const original = [...events];
    by(events, 'name');
    expect(events).toEqual(original);
  });

  it('keeps empty cells at the bottom whichever way the column is sorted', () => {
    const rows = [
      { name: 'Bo', closes: null },
      { name: 'Ann', closes: '2026-05-01' },
      { name: 'Cel', closes: '' },
      { name: 'Dee', closes: '2026-01-01' },
      { name: 'Eve', closes: undefined },
    ];

    const ascending = sortRows(rows, (row) => row.closes, 'asc').map((row) => row.name);
    const descending = sortRows(rows, (row) => row.closes, 'desc').map((row) => row.name);

    expect(ascending.slice(0, 2)).toEqual(['Dee', 'Ann']);
    expect(descending.slice(0, 2)).toEqual(['Ann', 'Dee']);
    // The three blanks are last both times, in the order they arrived.
    expect(ascending.slice(2)).toEqual(['Bo', 'Cel', 'Eve']);
    expect(descending.slice(2)).toEqual(['Bo', 'Cel', 'Eve']);
  });

  it('is stable, so a tie keeps the order it arrived in', () => {
    const rows = [
      { name: 'Ann', status: 'active' },
      { name: 'Bo', status: 'active' },
      { name: 'Cel', status: 'active' },
    ];

    expect(by(rows, 'status').map((row) => row.name)).toEqual(['Ann', 'Bo', 'Cel']);
  });

  it('treats a list that is not a list as an empty one', () => {
    // `useApi.execute` answers `null` on an error and whatever the endpoint
    // sent otherwise, so a state typed `T[]` can hold an object. A table with
    // a bad response should read as empty, not white-screen.
    expect(sortRows(null as any, (row: any) => row, 'asc')).toEqual([]);
    expect(sortRows({} as any, (row: any) => row, 'asc')).toEqual([]);
  });

  it('sorts by a value the column does not show', () => {
    // The screen shows "€1,240.00"; sorted as text that follows "€9.00".
    const payments = [
      { shown: '€9.00', amount: 9 },
      { shown: '€1,240.00', amount: 1240 },
      { shown: '€84.50', amount: 84.5 },
    ];

    expect(sortRows(payments, (row) => row.amount, 'asc').map((row) => row.shown)).toEqual([
      '€9.00',
      '€84.50',
      '€1,240.00',
    ]);
  });
});
