import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuditChanges } from '../AuditChanges';

/**
 * What changed, as a reader wants to see it.
 *
 * Shared between the Platform Admin and org-admin viewers, so a club reading
 * its own trail and a super admin reading the platform's are never looking at
 * two renderings of one event. These tests are mostly about the distinctions a
 * careless renderer would collapse: a redacted value against an unchanged one,
 * a create against an update, `false` against absent.
 */

const labels = {
  field: 'Field',
  before: 'Before',
  after: 'After',
  createdWith: 'Created with',
  deletedValues: 'Values at deletion',
  hidden: 'hidden — marked sensitive',
  noChanges: 'This event records an action rather than a change to stored values.',
};

const renderChanges = (changes: unknown, props = {}) =>
  render(<AuditChanges changes={changes as never} labels={labels} {...props} />);

describe('an update', () => {
  it('shows the old and new value side by side', () => {
    renderChanges({ entryFee: { from: 2500, to: 3000 } });

    expect(screen.getByText('Entry fee')).toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();
  });

  it('lists every changed field', () => {
    renderChanges({
      primaryColor: { from: '#1976d2', to: '#aa0000' },
      secondaryColor: { from: '#dc004e', to: '#00aa00' },
    });

    expect(screen.getByText('#1976d2')).toBeInTheDocument();
    expect(screen.getByText('#00aa00')).toBeInTheDocument();
  });

  it('shows an absent value as a dash rather than as nothing', () => {
    // An empty cell reads as "this row is still loading". A dash is a value.
    renderChanges({ description: { from: null, to: 'Autumn league' } });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('distinguishes false from absent', () => {
    renderChanges({ published: { from: true, to: false } });

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });
});

describe('redaction', () => {
  it('shows a redacted change as hidden, not as blank', () => {
    /*
     * "This field changed and we are not showing you to what" is information.
     * A blank cell says the field was not touched, which is a different and
     * false claim.
     */
    renderChanges({ medicalNotes: { from: '[redacted]', to: '[redacted]' } });

    expect(screen.getByText('Medical notes')).toBeInTheDocument();
    expect(screen.getAllByText(labels.hidden).length).toBeGreaterThan(0);
  });

  it('does not render the literal redaction marker as a value', () => {
    renderChanges({ password: { from: '[redacted]', to: '[redacted]' } });

    expect(screen.queryByText('[redacted]')).not.toBeInTheDocument();
  });

  it('redacts inside a created row too', () => {
    renderChanges({ created: { name: 'Saoirse', medicalNotes: '[redacted]' } });

    expect(screen.getByText('Saoirse')).toBeInTheDocument();
    expect(screen.queryByText('[redacted]')).not.toBeInTheDocument();
  });
});

describe('creates and deletes', () => {
  it('shows a create as the whole row under its own heading', () => {
    renderChanges({ created: { name: 'Autumn Trial', entryFee: 2500 } });

    expect(screen.getByText(labels.createdWith)).toBeInTheDocument();
    expect(screen.getByText('Autumn Trial')).toBeInTheDocument();
  });

  it('shows a delete as the row that is gone', () => {
    renderChanges({ deleted: { name: 'Autumn Trial' } });

    expect(screen.getByText(labels.deletedValues)).toBeInTheDocument();
    expect(screen.getByText('Autumn Trial')).toBeInTheDocument();
  });

  it('does not offer a before/after header for a create', () => {
    // There is no "before" for something that did not exist.
    renderChanges({ created: { name: 'Autumn Trial' } });

    expect(screen.queryByText(labels.before)).not.toBeInTheDocument();
  });
});

describe('nothing to show', () => {
  it.each([[null], [undefined], [{}]])('explains an event with no values (%s)', (changes) => {
    renderChanges(changes);
    expect(screen.getByText(labels.noChanges)).toBeInTheDocument();
  });
});

describe('timestamps', () => {
  it('renders a timestamp as a readable date and time', () => {
    /*
     * Two ISO strings side by side are a wall of identical characters with one
     * digit different — precisely the comparison the reader came to make,
     * rendered as hard as possible.
     */
    renderChanges({ openDateEntries: { from: '2026-09-19T17:23:46.254Z', to: '2026-09-19T16:23:46.254Z' } });

    expect(screen.queryByText('2026-09-19T17:23:46.254Z')).not.toBeInTheDocument();
    expect(screen.getByText(new Date('2026-09-19T17:23:46.254Z').toLocaleString())).toBeInTheDocument();
  });

  it('keeps a date-only value date-only', () => {
    // Rendering a start date as a midnight timestamp invents a precision the
    // value never had.
    renderChanges({ startDate: { from: '2026-06-15', to: '2026-06-16' } });

    const shown = screen.getByText(new Date('2026-06-16T00:00:00').toLocaleDateString());
    expect(shown).toBeInTheDocument();
    expect(shown.textContent).not.toMatch(/00:00/);
  });

  it('leaves a string that merely looks date-ish alone', () => {
    renderChanges({ reference: { from: null, to: '2026-09-19 not a date' } });
    expect(screen.getByText('2026-09-19 not a date')).toBeInTheDocument();
  });

  it('renders a Date object too', () => {
    const when = new Date('2026-09-19T16:23:46.254Z');
    renderChanges({ occurredAt: { from: null, to: when } });
    expect(screen.getByText(when.toLocaleString())).toBeInTheDocument();
  });
});

describe('field labels', () => {
  it('names a field the way a reader knows it', () => {
    renderChanges({ openDateEntries: { from: null, to: '2026-09-19T16:23:46.254Z' } });

    expect(screen.getByText('Entries open')).toBeInTheDocument();
    expect(screen.queryByText('openDateEntries')).not.toBeInTheDocument();
  });

  it('humanises a field nobody has curated', () => {
    renderChanges({ someNewColumn: { from: 1, to: 2 } });
    expect(screen.getByText('Some new column')).toBeInTheDocument();
  });

  it('lets the caller override, for a translated screen', () => {
    renderChanges(
      { openDateEntries: { from: null, to: 'x' } },
      { formatField: (f: string) => `[${f}]` }
    );

    expect(screen.getByText('[openDateEntries]')).toBeInTheDocument();
  });

  it('labels the fields of a created row too', () => {
    renderChanges({ created: { entryFee: 2500 } });
    expect(screen.getByText('Entry fee')).toBeInTheDocument();
  });
});

describe('formatting', () => {
  it('uses the caller formatter, so money is money', () => {
    const formatValue = vi.fn((field: string, value: unknown) =>
      field === 'entryFee' ? `€${(Number(value) / 100).toFixed(2)}` : String(value)
    );

    renderChanges({ entryFee: { from: 2500, to: 3000 } }, { formatValue });

    expect(screen.getByText('€25.00')).toBeInTheDocument();
    expect(screen.getByText('€30.00')).toBeInTheDocument();
  });

  it('never asks the formatter to format a redacted value', () => {
    // Handing a formatter `[redacted]` invites it to be rendered.
    const formatValue = vi.fn(() => 'formatted');

    renderChanges({ medicalNotes: { from: '[redacted]', to: '[redacted]' } }, { formatValue });

    expect(formatValue).not.toHaveBeenCalledWith('medicalNotes', '[redacted]');
  });

  it('renders a nested object rather than [object Object]', () => {
    renderChanges({ limits: { from: null, to: { max: 100 } } });

    expect(screen.getByText('{"max":100}')).toBeInTheDocument();
  });
});
