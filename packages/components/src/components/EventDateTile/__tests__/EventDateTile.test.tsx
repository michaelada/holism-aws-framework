import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventDateTile } from '../EventDateTile';

/**
 * The tile's job is to be readable at a glance and readable by a screen reader
 * as one date rather than four scraps — "AUG Thursday 20 2026" is worse spoken
 * than seen, so the parts are decorative and the group carries the full date.
 */
describe('EventDateTile', () => {
  it('breaks the date into month, weekday, day and year', () => {
    render(<EventDateTile date="2026-08-20" />);

    expect(screen.getByText('AUG')).toBeInTheDocument();
    expect(screen.getByText('Thursday')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('announces one full date rather than its pieces', () => {
    render(<EventDateTile date="2026-08-20" />);

    expect(
      screen.getByRole('group', { name: /Thursday,? 20 August 2026/i })
    ).toBeInTheDocument();
  });

  /** Month and weekday come from Intl, so they are the locale's own words. */
  it('renders month and weekday in the requested locale', () => {
    render(<EventDateTile date="2026-08-20" locale="fr-FR" />);

    expect(screen.getByText('AOÛT')).toBeInTheDocument();
    expect(screen.getByText('jeudi')).toBeInTheDocument();
  });

  it('shows the end date when an event spans more than a day', () => {
    render(<EventDateTile date="2026-08-20" endDate="2026-08-22" />);

    expect(screen.getByText(/22 Aug/)).toBeInTheDocument();
  });

  it('shows no range for a single-day event', () => {
    render(<EventDateTile date="2026-08-20" endDate="2026-08-20" />);

    expect(screen.queryByText(/20 Aug/)).not.toBeInTheDocument();
  });

  /** A listing must not blank out because one event has a bad date. */
  it.each([
    ['a missing date', undefined],
    ['null', null],
    ['an unparseable value', 'not-a-date'],
  ])('renders nothing for %s', (_label, value) => {
    const { container } = render(<EventDateTile date={value as string | null | undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
