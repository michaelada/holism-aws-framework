import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganisationSwitcher } from '../OrganisationSwitcher';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

/**
 * O1 — which club an administrator is working in.
 *
 * The property worth pinning is that **an administrator of one sees no
 * switcher**. That has to fall out of the data rather than out of a flag, so
 * that a club which never has a second administrator-of-several never acquires
 * an empty menu nobody configured away.
 */
describe('OrganisationSwitcher', () => {
  const KILDARE = { id: 'org-1', displayName: 'Kildare Hunt Pony Club' };
  const LAOIS = { id: 'org-2', displayName: 'Laois Hunt Pony Club' };

  const onSwitch = vi.fn();

  beforeEach(() => {
    onSwitch.mockReset();
    onSwitch.mockResolvedValue(undefined);
  });

  describe('with one organisation', () => {
    it('shows the name and offers nothing to press', () => {
      render(
        <OrganisationSwitcher organisations={[KILDARE]} currentId="org-1" onSwitch={onSwitch} />
      );

      expect(screen.getByText('Kildare Hunt Pony Club')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows nothing to press when the list has not arrived yet either', () => {
      render(<OrganisationSwitcher organisations={[]} currentId={null} onSwitch={onSwitch} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('with several', () => {
    const both = [KILDARE, LAOIS];

    it('names the current one on the control itself', async () => {
      render(<OrganisationSwitcher organisations={both} currentId="org-1" onSwitch={onSwitch} />);

      expect(screen.getByRole('button')).toHaveTextContent('Kildare Hunt Pony Club');
    });

    it('lists them all, and marks the current one', async () => {
      render(<OrganisationSwitcher organisations={both} currentId="org-1" onSwitch={onSwitch} />);

      await userEvent.click(screen.getByRole('button'));

      const items = await screen.findAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual([
        'Kildare Hunt Pony Club',
        'Laois Hunt Pony Club',
      ]);
      // Marked with a tick, which is what a reader actually sees — asserted on
      // the mark rather than on MUI's class name.
      expect(items[0].querySelector('svg')).toBeTruthy();
      expect(items[1].querySelector('svg')).toBeNull();
    });

    it('switches to the one chosen', async () => {
      render(<OrganisationSwitcher organisations={both} currentId="org-1" onSwitch={onSwitch} />);

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(await screen.findByText('Laois Hunt Pony Club'));

      await waitFor(() => expect(onSwitch).toHaveBeenCalledWith('org-2'));
    });

    it('does nothing when the current one is chosen again', async () => {
      // A switch re-resolves capabilities and navigates to the dashboard.
      // Doing that to land where you already are is a page flash for nothing.
      render(<OrganisationSwitcher organisations={both} currentId="org-1" onSwitch={onSwitch} />);

      await userEvent.click(screen.getByRole('button'));
      // By role: the control that opened the menu carries the same name.
      const [current] = await screen.findAllByRole('menuitem');
      await userEvent.click(current);

      expect(onSwitch).not.toHaveBeenCalled();
    });

    it('announces which club is being administered, not just that a menu exists', async () => {
      // "Organisation" would tell a screen-reader user nothing about which one
      // they are about to change something in.
      render(<OrganisationSwitcher organisations={both} currentId="org-1" onSwitch={onSwitch} />);

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Kildare Hunt Pony Club') as unknown as string
      );
    });

    it('cannot be pressed twice while a switch is in flight', async () => {
      let release: () => void = () => undefined;
      onSwitch.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));

      render(<OrganisationSwitcher organisations={both} currentId="org-1" onSwitch={onSwitch} />);

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(await screen.findByText('Laois Hunt Pony Club'));

      await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
      release();
    });
  });
});
