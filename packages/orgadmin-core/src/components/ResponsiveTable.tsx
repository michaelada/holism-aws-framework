import React, { useEffect, useRef } from 'react';
import { TableContainer, type TableContainerProps } from '@mui/material';

export interface ResponsiveTableProps extends TableContainerProps {
  /**
   * The column that says *which record this is* — a member's name, an event's
   * title, an order's reference.
   *
   * Given one, the stacked layout leads with it: that cell moves to the top of
   * the row and is set as a heading, with no label of its own, because a name
   * does not need to be captioned "Name". Everything else stays a label/value
   * pair beneath it.
   *
   * Without it every column is treated alike, which is honest but flat — the
   * reader has to find the name among eight equal rows of text.
   *
   * Either the column's **heading text**, matched case-insensitively against
   * what is rendered — pass the same `t()` call the header uses — or its
   * **0-based index**, for a heading that is an icon or is empty.
   */
  identityColumn?: string | number;
}

/**
 * A list table that stops being a table on a small screen.
 *
 * ## Why
 *
 * Org-admin's tables are built for a laptop and carry eight to eleven columns.
 * On a phone that becomes a 997px grid in a 390px window: nine columns sit
 * off-screen behind a horizontal scroll, and where a table pins its Actions
 * column, that pinned column paints over the name while you drag. DESIGN.md's
 * Layout rule asks for stacked rows below `md`, twice, and this is that rule in
 * one place rather than in thirty.
 *
 * ## How
 *
 * Below `md` the header row is hidden and each row becomes a block, with every
 * cell laid out as a label/value pair — the label being the column heading the
 * cell lost. The headings are copied onto the cells as `data-label` after each
 * render and drawn by CSS, so **no call site has to describe its columns
 * twice**: the markup stays the `<Table>` it already was, and a column added to
 * the header is labelled on the phone automatically.
 *
 * Three cells deliberately get no label:
 *
 * - a cell under a blank heading — the checkbox and actions columns, which
 *   caption themselves;
 * - a cell that spans the table — "No members found" is a message, not a field;
 * - anything in a table with no header row at all.
 *
 * ## Use
 *
 * A drop-in replacement for `TableContainer`, taking the same props:
 *
 * ```tsx
 * <ResponsiveTable component={Paper}>
 *   <Table>…</Table>
 * </ResponsiveTable>
 * ```
 *
 * A table whose rows carry a hand-designed small-screen layout instead — the
 * members database does — should keep it and not use this. This is the default,
 * not the only answer: it treats every column as equally important, which is
 * honest but is not the same as deciding which column is the identity.
 */
export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  sx,
  identityColumn,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  /*
   * No dependency array on purpose. Rows arrive asynchronously, get filtered,
   * sorted and paged, and each of those is a render — labelling on every render
   * is a handful of attribute writes over the rows currently on screen, which
   * is cheaper than observing the subtree and never goes stale.
   */
  useEffect(() => {
    const table = containerRef.current?.querySelector('table');
    if (!table) return;

    const headings = Array.from(table.querySelectorAll('thead th')).map(
      (heading) => heading.textContent?.trim() ?? ''
    );
    if (headings.length === 0) return;

    /*
     * Resolved once per pass rather than per cell. A heading given as text is
     * matched against what is actually rendered, so the call site passes the
     * same `t()` call its header does and the two cannot drift apart in one
     * locale but not another.
     */
    const identityIndex =
      typeof identityColumn === 'number'
        ? identityColumn
        : typeof identityColumn === 'string'
          ? headings.findIndex((h) => h.toLowerCase() === identityColumn.trim().toLowerCase())
          : -1;

    table.querySelectorAll('tbody tr').forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        const heading = headings[index] ?? '';
        const spansTheTable = cell.hasAttribute('colspan');
        const isIdentity = index === identityIndex && !spansTheTable;

        // The identity column is never captioned: a name labelled "Name" tells
        // the reader nothing they cannot already see.
        if (heading && !spansTheTable && !isIdentity) cell.setAttribute('data-label', heading);
        else cell.removeAttribute('data-label');

        /*
         * A cell holding more than one element puts its label on the line
         * above instead of beside.
         *
         * The two-column layout works by making the cell a flex row, which
         * treats every child as a column of its own. A membership type's name
         * cell carries the name *and* its description; laid out side by side
         * they were pushed to opposite ends of the row with the description
         * squeezed into a third of the width. Counting the children here is
         * cheaper and more honest than trying to express "has more than one
         * child" in a selector.
         */
        /*
         * Counted over child *nodes*, not `children`.
         *
         * `children` sees elements only, and a cell written as
         * `<TableCell>{name}<span>{note}</span></TableCell>` has one element
         * child but two flex items — the bare text is one too. Counting
         * elements missed exactly that shape and let the two be pushed to
         * opposite ends of the row.
         */
        const items = Array.from(cell.childNodes).filter(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE ||
            (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')
        ).length;

        if (items > 1) cell.setAttribute('data-stack', '');
        else cell.removeAttribute('data-stack');

        if (isIdentity) cell.setAttribute('data-identity', '');
        else cell.removeAttribute('data-identity');
      });
    });
  });

  return (
    <TableContainer
      ref={containerRef}
      sx={[
        (theme) => ({
          [theme.breakpoints.down('md')]: {
            /*
             * The `<table>` box has to go too, not just its rows.
             *
             * Left as `display: table` it keeps sizing itself from its widest
             * row — call sites set `minWidth: 650` and up — so `width: 100%` on
             * a cell resolved against 997px rather than the 390px on screen,
             * and every value ran off the right-hand edge. `minWidth` is
             * overridden rather than removed at the call sites, because on a
             * laptop it is doing the right thing.
             */
            '& table': {
              display: 'block',
              width: '100%',
              minWidth: '0 !important',
            },

            '& thead': { display: 'none' },

            '& tbody, & tbody td': { display: 'block', width: '100%' },

            /*
             * A flex column, not a block. Identical to stacking until the
             * identity cell needs hoisting to the top of the row, which takes
             * `order` — and `order` does nothing to block children.
             */
            '& tbody tr': {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 0 },
            },

            '& tbody td': {
              /*
               * The label on the left, the value on the right, sharing a
               * baseline. `border: 0` because the row now carries the only rule
               * — cell borders here would draw a line under every field.
               */
              border: 0,
              display: 'flex',
              /*
               * `row`, overriding the call site. An actions cell often sets
               * `row-reverse` to lay its icons out from the right on the
               * desktop table; here that put the label on the right and ran the
               * icons off the left edge of the screen. The label leads.
               */
              flexDirection: 'row',
              /*
               * `nowrap`. Wrapping broke a five-icon actions cell across two
               * lines and stranded a long event name below its own label; text
               * still wraps *inside* its own box, which is the wrapping that
               * was wanted, while a group of buttons stays a group.
               */
              flexWrap: 'nowrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              /*
               * Tighter than the 16px the rest of the row uses. An actions cell
               * with five icons plus its label needs 271px of a 294px row, and
               * 16px of padding either side left the last icon a few pixels
               * over the edge.
               */
              gap: 1,
              px: 1.5,
              py: 0.5,
              textAlign: 'right',

              /*
               * A pinned column has nothing left to pin to: the row is no
               * longer wider than the screen, and a sticky cell inside a block
               * row lifts out of the flow and lands on top of its neighbours.
               */
              position: 'static',
              borderLeft: 0,

              '&::before': {
                content: 'attr(data-label)',
                color: 'text.secondary',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'left',
                // The label holds its width; the value gives way and wraps.
                flexShrink: 0,
              },
            },

            /*
             * Label above, content below, for the cells that hold more than one
             * thing. Left-aligned, because a stacked value has no opposite edge
             * to sit against.
             */
            '& tbody td[data-stack]': {
              display: 'block',
              textAlign: 'left',
              '&::before': { display: 'block', mb: 0.25 },
            },

            /*
             * The identity column leads.
             *
             * It goes to the top of the row whatever its position in the header
             * — a members table opens on Membership Type, an events table on
             * Event Name — and it carries no label, because a name captioned
             * "Name" tells the reader nothing they could not see. Set as a
             * heading so the eye finds the record before it reads the fields.
             */
            '& tbody td[data-identity]': {
              order: -1,
              display: 'block',
              textAlign: 'left',
              pb: 0.5,
              fontSize: '1.05rem',
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'text.primary',
              '&::before': { display: 'none' },
            },

            // The checkbox and actions columns caption themselves.
            '& tbody td:not([data-label])': {
              justifyContent: 'flex-end',
              '&::before': { display: 'none' },
            },

            // "No members found", "Loading…" — a message across the whole row.
            '& tbody td[colspan]': {
              justifyContent: 'center',
              textAlign: 'center',
              '&::before': { display: 'none' },
            },
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </TableContainer>
  );
};
