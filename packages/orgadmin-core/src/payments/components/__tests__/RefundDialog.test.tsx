import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RefundDialog, { amountFor, refundableOn, RefundableLine } from '../RefundDialog';

/**
 * Four ways to refund, and what each of them means.
 *
 * The difference is not cosmetic — it decides what the payment becomes — so
 * what this dialog sends has to be the scope rather than a figure it worked out
 * for itself. A client able to name both could refund the whole of a payment
 * while calling it one line of it, and the status would follow the label.
 */

vi.mock('@itsplainsailing/orgadmin-shell', () => import('../../../test/orgadminShellMock'));

const line = (over: Partial<RefundableLine> = {}): RefundableLine => ({
  id: 'line-1',
  itemType: 'event_entry',
  description: 'Intermediate — Spring League',
  subjectName: 'Áine McGrath',
  fee: 2500,
  handlingFee: 62,
  refundedAmount: 0,
  entryStatus: 'active',
  ...over,
});

const onConfirm = vi.fn();
const money = (amount: number) => `€${amount.toFixed(2)}`;

const renderDialog = (props: Partial<React.ComponentProps<typeof RefundDialog>> = {}) =>
  render(
    <RefundDialog
      open
      remaining={50}
      handlingFee={108}
      lines={[line()]}
      processing={false}
      formatMoney={money}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      {...props}
    />
  );

const reason = (text = 'Withdrew before the closing date') =>
  fireEvent.change(screen.getByLabelText(/Refund Reason/), { target: { value: text } });

const confirm = () => fireEvent.click(screen.getByRole('button', { name: /confirm refund/i }));

beforeEach(() => vi.clearAllMocks());

describe('RefundDialog', () => {
  it('offers the whole payment by default, and sends a scope rather than a figure', () => {
    renderDialog();
    reason();
    confirm();

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'full', refundAmount: undefined })
    );
  });

  it('offers to keep back the handling fee, and says how much that is', () => {
    renderDialog();

    expect(
      screen.getByLabelText('Everything but the handling fee — €48.92 (keeping back €1.08)')
    ).toBeInTheDocument();
  });

  it('does not offer to keep back a fee that was never added on', () => {
    // An item whose price absorbs its fee has none to keep back: the option
    // would be a distinction that is not one.
    renderDialog({ handlingFee: 0 });

    expect(screen.queryByLabelText(/handling fee/)).not.toBeInTheDocument();
  });

  it('refunds named items, with what is left on each', () => {
    renderDialog({
      lines: [line(), line({ id: 'line-2', description: 'Club hoodie', fee: 3800, handlingFee: 0 })],
    });

    fireEvent.click(screen.getByLabelText('Particular items'));
    // The line's own fee plus its share of the handling fee: the member paid
    // both and is owed both back.
    fireEvent.click(screen.getByRole('checkbox', { name: /Intermediate — Spring League/ }));
    reason();
    confirm();

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'items', lineIds: ['line-1'] })
    );
  });

  it('will not confirm an item refund with nothing chosen', () => {
    renderDialog({ lines: [line(), line({ id: 'line-2', description: 'Club hoodie' })] });

    fireEvent.click(screen.getByLabelText('Particular items'));
    reason();

    expect(screen.getByRole('button', { name: /confirm refund/i })).toBeDisabled();
  });

  /**
   * With one item left, "particular items" and "the whole payment" are the same
   * refund said two ways.
   */
  it('does not offer item-by-item on a payment with one item', () => {
    renderDialog();

    expect(screen.queryByLabelText('Particular items')).not.toBeInTheDocument();
  });

  it('does not offer it once everything but one item has been refunded', () => {
    // The choice is over: what is left is one line, which the whole-payment
    // option already covers.
    renderDialog({
      lines: [line({ refundedAmount: 2562 }), line({ id: 'line-2', description: 'Club hoodie' })],
    });

    expect(screen.queryByLabelText('Particular items')).not.toBeInTheDocument();
  });

  it('offers it as soon as there are two to choose between', () => {
    renderDialog({ lines: [line(), line({ id: 'line-2', description: 'Club hoodie' })] });

    expect(screen.getByLabelText('Particular items')).toBeInTheDocument();
  });

  it('leaves out an item that has already been refunded', () => {
    // It cannot go back twice, and offering it invites a refusal from the
    // server that the club can do nothing about.
    renderDialog({
      lines: [
        line({ refundedAmount: 2562 }),
        line({ id: 'line-2', description: 'Club hoodie' }),
        line({ id: 'line-3', description: 'Club cap' }),
      ],
    });

    fireEvent.click(screen.getByLabelText('Particular items'));

    expect(screen.queryByRole('checkbox', { name: /Intermediate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Club hoodie/ })).toBeInTheDocument();
    expect(screen.getByText('Items already refunded are not listed.')).toBeInTheDocument();
  });

  it('refuses items adding up to more than the payment has left', () => {
    /*
     * Reachable without any of these items having been refunded: an earlier
     * refund of an arbitrary amount comes off the payment without naming a
     * line, so the lines can still add up to more than remains.
     */
    renderDialog({
      remaining: 20,
      lines: [line(), line({ id: 'line-2', description: 'Club hoodie', fee: 3800, handlingFee: 0 })],
    });

    fireEvent.click(screen.getByLabelText('Particular items'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Club hoodie/ }));
    reason();

    expect(screen.getByText('Only €20.00 is still refundable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm refund/i })).toBeDisabled();
  });

  it('sends an arbitrary amount as a figure, because only that scope has one', () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText('Another amount'));
    fireEvent.change(screen.getByLabelText('Amount to refund'), { target: { value: '10' } });
    reason();
    confirm();

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'amount', refundAmount: 10 })
    );
  });

  it('refuses an amount beyond what is left', () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText('Another amount'));
    fireEvent.change(screen.getByLabelText('Amount to refund'), { target: { value: '80' } });
    reason();

    expect(screen.getByText('Only €50.00 is still refundable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm refund/i })).toBeDisabled();
  });

  it('will not confirm without a reason', () => {
    // The reason is the whole point of the record afterwards.
    renderDialog();

    expect(screen.getByRole('button', { name: /confirm refund/i })).toBeDisabled();
  });

  it('asks whether to withdraw the entries, rather than assuming', () => {
    // A refund can be a goodwill gesture with the rider still expected.
    renderDialog();
    reason();

    const withdraw = screen.getByRole('checkbox', { name: /withdraw 1 entry/i });
    expect(withdraw).not.toBeChecked();

    fireEvent.click(withdraw);
    confirm();

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ removeEntries: true }));
  });

  it('counts only the entries the refund would cover', () => {
    renderDialog({
      lines: [line(), line({ id: 'line-2', description: 'Club hoodie', itemType: 'merchandise' })],
    });

    expect(screen.getByRole('checkbox', { name: /withdraw 1 entry/i })).toBeInTheDocument();
  });

  it('offers nothing to withdraw for an arbitrary amount', () => {
    /*
     * €20 off a basket of four names no item, so there is no entry this refund
     * can be said to be about.
     */
    renderDialog();

    fireEvent.click(screen.getByLabelText('Another amount'));

    expect(screen.queryByRole('checkbox', { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it('does not offer to withdraw an entry that is already withdrawn', () => {
    renderDialog({ lines: [line({ entryStatus: 'removed' })] });

    expect(screen.queryByRole('checkbox', { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it('forgets the last refund when it is reopened', () => {
    const { rerender } = renderDialog();
    fireEvent.click(screen.getByLabelText('Another amount'));
    reason('Something');

    rerender(
      <RefundDialog
        open={false}
        remaining={50}
        handlingFee={108}
        lines={[line()]}
        processing={false}
        formatMoney={money}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    rerender(
      <RefundDialog
        open
        remaining={50}
        handlingFee={108}
        lines={[line()]}
        processing={false}
        formatMoney={money}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByLabelText(/The whole payment/)).toBeChecked();
    expect(screen.getByLabelText(/Refund Reason/)).toHaveValue('');
  });
});

describe('what each scope comes to', () => {
  const options = {
    remaining: 50,
    handlingFee: 108,
    lines: [line(), line({ id: 'line-2', fee: 3800, handlingFee: 0 })],
    selected: ['line-1'],
    typed: '12.50',
  };

  it('is what is left, for the whole payment', () => {
    expect(amountFor('full', options)).toBe(50);
  });

  it('keeps the handling fee back, to the cent', () => {
    expect(amountFor('lessHandlingFee', options)).toBe(48.92);
  });

  it('adds up the chosen items, fee shares included', () => {
    expect(amountFor('items', options)).toBe(25.62);
  });

  it('is whatever was typed, for an arbitrary amount', () => {
    expect(amountFor('amount', options)).toBe(12.5);
    expect(amountFor('amount', { ...options, typed: '' })).toBe(0);
  });

  it('knows what is left on a part-refunded line', () => {
    expect(refundableOn(line({ refundedAmount: 1000 }))).toBe(1562);
  });
});
