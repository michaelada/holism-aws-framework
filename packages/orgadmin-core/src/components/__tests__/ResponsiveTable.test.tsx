import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip } from '@mui/material';
import { ResponsiveTable } from '../ResponsiveTable';

/**
 * `ResponsiveTable` does its work by annotating the DOM after each render, and
 * CSS media queries do the rest. These tests check the annotation — which
 * cells get a label, which one leads, which are left alone — because that is
 * the part with the decisions in it. Whether a `@media` block applies at 390px
 * is the browser's job, not a thing worth mocking.
 */

const Row = ({ withDescription = false }: { withDescription?: boolean }) => (
  <TableRow>
    <TableCell padding="checkbox">
      <input type="checkbox" aria-label="Select" />
    </TableCell>
    <TableCell>Associate Member</TableCell>
    <TableCell>
      Aoife McNamara
      {withDescription && <span>Joined in 2019</span>}
    </TableCell>
    <TableCell>
      <Chip label="active" size="small" />
    </TableCell>
    <TableCell align="right">
      <button type="button">Edit</button>
    </TableCell>
  </TableRow>
);

const renderTable = (props: Record<string, unknown> = {}, row = <Row />) =>
  render(
    <ResponsiveTable component={Paper} {...props}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Membership Type</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{row}</TableBody>
      </Table>
    </ResponsiveTable>
  );

const cells = () => Array.from(document.querySelectorAll('tbody td'));

describe('ResponsiveTable', () => {
  it('gives every cell the heading it would lose when the table stops being one', () => {
    renderTable();

    expect(cells().map((c) => c.getAttribute('data-label'))).toEqual([
      null, // the checkbox column has a blank heading and captions itself
      'Membership Type',
      'Name',
      'Status',
      'Actions',
    ]);
  });

  it('leads with the identity column, and does not caption it', () => {
    renderTable({ identityColumn: 'Name' });

    const identity = document.querySelectorAll('tbody td[data-identity]');
    expect(identity).toHaveLength(1);
    expect(identity[0].textContent).toContain('Aoife McNamara');

    // A name captioned "Name" tells the reader nothing they cannot see.
    expect(identity[0].getAttribute('data-label')).toBeNull();
  });

  it('matches the heading whatever its case or padding, so a t() call can be passed straight in', () => {
    renderTable({ identityColumn: '  name  ' });

    expect(document.querySelector('tbody td[data-identity]')?.textContent).toContain(
      'Aoife McNamara'
    );
  });

  it('accepts an index, for a heading that is an icon or is empty', () => {
    renderTable({ identityColumn: 1 });

    expect(document.querySelector('tbody td[data-identity]')?.textContent).toBe(
      'Associate Member'
    );
  });

  it('marks nothing when the named column is not there, rather than guessing', () => {
    renderTable({ identityColumn: 'Nickname' });

    expect(document.querySelectorAll('tbody td[data-identity]')).toHaveLength(0);
  });

  it('marks nothing when no identity is named', () => {
    renderTable();

    expect(document.querySelectorAll('tbody td[data-identity]')).toHaveLength(0);
  });

  it('stacks a cell holding more than one thing, so the two are not pushed to opposite ends', () => {
    renderTable({}, <Row withDescription />);

    const name = cells().find((c) => c.getAttribute('data-label') === 'Name');
    expect(name?.hasAttribute('data-stack')).toBe(true);

    const type = cells().find((c) => c.getAttribute('data-label') === 'Membership Type');
    expect(type?.hasAttribute('data-stack')).toBe(false);
  });

  it('leaves a message spanning the table unlabelled — it is not a field', () => {
    render(
      <ResponsiveTable component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2}>No members found</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ResponsiveTable>
    );

    const message = screen.getByText('No members found');
    expect(message.getAttribute('data-label')).toBeNull();
    expect(message.hasAttribute('data-identity')).toBe(false);
  });

  it('leaves a table with no header row alone', () => {
    render(
      <ResponsiveTable component={Paper} identityColumn={0}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Just a layout grid</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ResponsiveTable>
    );

    expect(document.querySelector('tbody td')?.getAttribute('data-label')).toBeNull();
    expect(document.querySelectorAll('[data-identity]')).toHaveLength(0);
  });

  it('re-labels when the rows change, so a filtered or paged table does not go stale', () => {
    const { rerender } = renderTable({ identityColumn: 'Name' });

    rerender(
      <ResponsiveTable component={Paper} identityColumn="Status">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Membership Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <Row />
          </TableBody>
        </Table>
      </ResponsiveTable>
    );

    const identity = document.querySelectorAll('tbody td[data-identity]');
    expect(identity).toHaveLength(1);
    expect(identity[0].textContent).toContain('active');
  });
});
