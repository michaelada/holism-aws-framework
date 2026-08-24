import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import OrderStatusUpdateDialog from '../OrderStatusUpdateDialog';

/**
 * Moving an order along, and telling the member about it.
 *
 * The email checkbox is the part that matters: it decides whether a real
 * message goes to a real person. Defaulting it off would leave members
 * wondering where their order is; leaving it stuck on would spam them when a
 * club is quietly correcting a mistake. Both are decisions this dialog makes on
 * the club's behalf, and neither is visible from the order list afterwards.
 */

let onClose: ReturnType<typeof vi.fn>;
let onUpdate: ReturnType<typeof vi.fn>;

const renderDialog = ({ open = true, currentStatus = 'pending' } = {}) => {
  onClose = vi.fn();
  onUpdate = vi.fn();
  return render(
    <OrderStatusUpdateDialog
      open={open}
      currentStatus={currentStatus as never}
      onClose={onClose}
      onUpdate={onUpdate}
    />
  );
};

const chooseStatus = (label: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(within(screen.getByRole('listbox')).getByText(label));
};

const update = () => fireEvent.click(screen.getByRole('button', { name: /update/i }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderStatusUpdateDialog — opening', () => {
  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
  });

  it('opens on the status the order already has, so no change is the default', () => {
    renderDialog({ currentStatus: 'shipped' });

    update();

    expect(onUpdate).toHaveBeenCalledWith('shipped', undefined, true);
  });

  it('offers to email the member by default', () => {
    renderDialog();

    // A status change nobody is told about is the common complaint a shop gets.
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('OrderStatusUpdateDialog — updating', () => {
  it('reports the status that was chosen', () => {
    renderDialog({ currentStatus: 'pending' });

    chooseStatus('Shipped');
    update();

    expect(onUpdate).toHaveBeenCalledWith('shipped', undefined, true);
  });

  it('reports notes when some were written', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: 'Left with the yard manager' },
    });
    update();

    expect(onUpdate).toHaveBeenCalledWith('pending', 'Left with the yard manager', true);
  });

  it('reports no notes at all rather than an empty string', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: '' } });
    update();

    // An empty note stored against an order reads as a note that was deleted.
    expect(onUpdate).toHaveBeenCalledWith('pending', undefined, true);
  });

  it('honours the club’s decision not to email', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('checkbox'));
    update();

    expect(onUpdate).toHaveBeenCalledWith('pending', undefined, false);
  });

  it('closes once the update has been reported', () => {
    renderDialog();

    update();

    expect(onUpdate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the notes so the next order does not inherit them', () => {
    const { rerender } = renderDialog();

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Damaged in transit' } });
    update();

    rerender(
      <OrderStatusUpdateDialog
        open
        currentStatus={'pending' as never}
        onClose={onClose}
        onUpdate={onUpdate}
      />
    );

    // A note about one order appearing on the next is worse than no note.
    expect(screen.getByLabelText(/notes/i)).toHaveValue('');
  });
});

describe('OrderStatusUpdateDialog — cancelling', () => {
  it('closes without reporting anything', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not email a member when the club backed out', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Never mind' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
