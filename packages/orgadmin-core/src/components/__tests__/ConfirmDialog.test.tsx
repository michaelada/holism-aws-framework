/**
 * One way to ask "are you sure?".
 *
 * Two screens used the browser's own `confirm()` — OS chrome, no styling, and
 * no i18n, so a German administrator was asked in English by something that did
 * not look like the product. Deletion is where an unpaid volunteer decides
 * whether to trust this software with the club's records, which makes it a poor
 * place to fall back to what looks like an operating-system error.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const setup = (overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete this venue?"
      body="The venue will be removed from the list."
      confirmLabel="Delete venue"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('names the action on the button rather than agreeing with a question', async () => {
    /*
     * "Delete venue", not "OK". A reader who skimmed the title still learns what
     * the button does before pressing it.
     */
    setup();
    expect(screen.getByRole('button', { name: 'Delete venue' })).toBeInTheDocument();
  });

  it('takes its cancel label from i18n, never a hard-coded string', () => {
    setup();
    expect(screen.getByRole('button', { name: 'common.actions.cancel' })).toBeInTheDocument();
  });

  it('confirms and cancels through the callbacks', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete venue' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'common.actions.cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('describes itself to assistive technology', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Delete this venue?');
    expect(dialog).toHaveAccessibleDescription('The venue will be removed from the list.');
  });

  it('marks a destructive action as such, and a reversible one as ordinary', () => {
    const { unmount } = render(
      <ConfirmDialog open title="t" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Delete' }).className).toMatch(/colorError/);
    unmount();

    render(
      <ConfirmDialog
        open
        title="t"
        confirmLabel="Publish"
        destructive={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Publish' }).className).not.toMatch(/colorError/);
  });

  it('locks both buttons while the action is in flight', () => {
    const { onConfirm } = setup({ busy: true });

    expect(screen.getByRole('button', { name: 'Delete venue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'common.actions.cancel' })).toBeDisabled();

    /*
     * `fireEvent`, not `userEvent`: a disabled MUI button carries
     * `pointer-events: none`, so userEvent correctly refuses to click it and
     * the test would pass without ever exercising the handler. Dispatching the
     * event directly is what proves a double-click on a slow delete cannot send
     * it twice.
     */
    fireEvent.click(screen.getByRole('button', { name: 'Delete venue' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders without a body when the title says it all', () => {
    render(
      <ConfirmDialog open title="Delete this?" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });
});
