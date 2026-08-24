import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import CreateCustomFilterDialog from '../CreateCustomFilterDialog';

/**
 * Saving a set of member filters under a name, so a club can come back to it.
 *
 * The saved filter is reused for months, so what it holds matters more than how
 * it looks. Two things are worth pinning: it cannot be saved nameless — an
 * unnamed entry in the saved-filters menu is unreachable — and the dialog must
 * forget everything when it closes. A dialog that keeps the last attempt hands
 * the next filter somebody builds a set of criteria they never chose, under a
 * name that says nothing about them.
 */

let onSave: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;

const renderDialog = (open = true) => {
  onSave = vi.fn();
  onClose = vi.fn();
  return renderWithI18n(
    <CreateCustomFilterDialog open={open} onClose={onClose} onSave={onSave} />
  );
};

const nameBox = () => screen.getByRole('textbox', { name: /filterName|filter name/i });

const nameIt = (name: string) => fireEvent.change(nameBox(), { target: { value: name } });

const saveButton = () =>
  screen
    .getAllByRole('button')
    .find((b) => /save|create/i.test(b.textContent ?? '') && !/cancel/i.test(b.textContent ?? ''))!;

const cancelButton = () =>
  screen.getAllByRole('button').find((b) => /cancel/i.test(b.textContent ?? ''))!;

const addLabel = (label: string) => {
  fireEvent.change(screen.getByPlaceholderText(/addLabel|add label/i), {
    target: { value: label },
  });
  fireEvent.click(screen.getAllByRole('button').find((b) => /^(add|.*\.add)$/i.test(b.textContent ?? ''))!);
};

const chooseStatus = (value: string) => {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
  const listbox = screen.getByRole('listbox');
  fireEvent.click(listbox.querySelector(`[data-value="${value}"]`)!);
  // A multiple Select keeps its menu open, and its backdrop covers the buttons.
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateCustomFilterDialog — opening', () => {
  it('shows nothing while closed', () => {
    renderDialog(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on an empty filter, not on the last one', () => {
    renderDialog();

    expect(nameBox()).toHaveValue('');
  });
});

describe('CreateCustomFilterDialog — naming the filter', () => {
  it('refuses to save a filter with no name', () => {
    renderDialog();

    expect(saveButton()).toBeDisabled();
  });

  it('still refuses when the name is only spaces', () => {
    renderDialog();

    nameIt('   ');

    // A blank entry in the saved-filters menu cannot be picked out again.
    expect(saveButton()).toBeDisabled();
  });

  it('allows the save once the filter is named', () => {
    renderDialog();

    nameIt('Lapsed adults');

    expect(saveButton()).not.toBeDisabled();
  });
});

describe('CreateCustomFilterDialog — what gets saved', () => {
  it('reports the filter that was built', () => {
    renderDialog();

    nameIt('Lapsed adults');
    chooseStatus('elapsed');
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Lapsed adults', memberStatus: ['elapsed'] })
    );
  });

  it('carries the member labels that were added', () => {
    renderDialog();

    nameIt('Committee');
    addLabel('committee');
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].memberLabels).toEqual(['committee']);
  });

  it('does not add the same label twice', () => {
    renderDialog();
    nameIt('Committee');

    addLabel('committee');
    addLabel('committee');

    expect(screen.getAllByText('committee')).toHaveLength(1);
  });

  it('ignores an empty label', () => {
    renderDialog();
    nameIt('Committee');

    fireEvent.change(screen.getByPlaceholderText(/addLabel|add label/i), {
      target: { value: '  ' },
    });
    fireEvent.click(screen.getAllByRole('button').find((b) => /^(add|.*\.add)$/i.test(b.textContent ?? ''))!);
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].memberLabels).toEqual([]);
  });

  it('removes a label added by mistake', () => {
    renderDialog();
    nameIt('Committee');
    addLabel('committee');

    const chip = screen.getByText('committee').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(chip.querySelector('.MuiChip-deleteIcon')!);

    expect(screen.queryByText('committee')).not.toBeInTheDocument();
  });

  it('closes once the filter is saved', () => {
    renderDialog();

    nameIt('Lapsed adults');
    fireEvent.click(saveButton());

    expect(onClose).toHaveBeenCalled();
  });
});

describe('CreateCustomFilterDialog — backing out', () => {
  it('saves nothing when cancelled', () => {
    renderDialog();

    nameIt('Lapsed adults');
    fireEvent.click(cancelButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('forgets an abandoned filter so the next one starts clean', () => {
    const { rerender } = renderDialog();

    nameIt('Lapsed adults');
    addLabel('committee');
    fireEvent.click(cancelButton());
    rerender(<CreateCustomFilterDialog open onClose={onClose} onSave={onSave} />);

    // Otherwise the next filter is saved with criteria nobody chose for it.
    expect(nameBox()).toHaveValue('');
    expect(screen.queryByText('committee')).not.toBeInTheDocument();
  });

  it('forgets a saved filter too, so the next one is not a copy', () => {
    const { rerender } = renderDialog();

    nameIt('Lapsed adults');
    addLabel('committee');
    fireEvent.click(saveButton());
    rerender(<CreateCustomFilterDialog open onClose={onClose} onSave={onSave} />);

    expect(nameBox()).toHaveValue('');
    expect(screen.queryByText('committee')).not.toBeInTheDocument();
  });
});
