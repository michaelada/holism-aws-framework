import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallPrompt from '../InstallPrompt';
import { renderWithProviders } from '../../test/renderWithProviders';

/** Chromium's installability event, with the two members the component uses. */
const fireInstallable = () => {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

/** Arrive `count` times before the one under test. */
const previousVisits = (count: number) => {
  window.localStorage.setItem('account-install:visits', String(count));
};

/**
 * H3 — offering to install.
 *
 * Never on a first visit: a member who has just arrived does not yet know
 * whether they want this club on their home screen, and an install prompt is
 * the fastest way to make a first visit feel like an advertisement.
 */
describe('InstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('says nothing on a first visit, even when the browser offers', () => {
    renderWithProviders(<InstallPrompt />);

    fireInstallable();

    expect(screen.queryByText(/home screen/i)).not.toBeInTheDocument();
  });

  it('says nothing on a second visit', () => {
    previousVisits(1);
    renderWithProviders(<InstallPrompt />);

    fireInstallable();

    expect(screen.queryByText(/home screen/i)).not.toBeInTheDocument();
  });

  it('offers on the third', async () => {
    previousVisits(2);
    renderWithProviders(<InstallPrompt />);

    fireInstallable();

    expect(await screen.findByText(/Add this to your home screen/i)).toBeInTheDocument();
  });

  it('says why it is worth doing', async () => {
    previousVisits(2);
    renderWithProviders(<InstallPrompt />);
    fireInstallable();

    // The reason a member would want it, not the fact that it is possible.
    expect(await screen.findByText(/tickets work without a signal/i)).toBeInTheDocument();
  });

  it('waits for the member rather than opening the browser prompt itself', () => {
    previousVisits(2);
    renderWithProviders(<InstallPrompt />);

    const event = fireInstallable();

    // The browser only allows it from a gesture, so it is held until pressed.
    expect(event.prompt).not.toHaveBeenCalled();
  });

  it('opens the browser prompt when the member accepts', async () => {
    previousVisits(2);
    renderWithProviders(<InstallPrompt />);
    const event = fireInstallable();

    await userEvent.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
  });

  describe('once a member has decided', () => {
    it('does not ask again after they decline', async () => {
      previousVisits(2);
      const first = renderWithProviders(<InstallPrompt />);
      fireInstallable();
      await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
      first.unmount();

      renderWithProviders(<InstallPrompt />);
      fireInstallable();

      expect(screen.queryByText(/home screen/i)).not.toBeInTheDocument();
    });

    it('does not ask again after they accept', async () => {
      previousVisits(2);
      const first = renderWithProviders(<InstallPrompt />);
      fireInstallable();
      await userEvent.click(await screen.findByRole('button', { name: 'Add' }));
      first.unmount();

      renderWithProviders(<InstallPrompt />);
      fireInstallable();

      expect(screen.queryByText(/home screen/i)).not.toBeInTheDocument();
    });
  });

  /** Without a count there is no third visit to wait for — never asking is the safe way to be wrong. */
  it('never asks when it cannot count visits', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    renderWithProviders(<InstallPrompt />);
    fireInstallable();

    expect(screen.queryByText(/home screen/i)).not.toBeInTheDocument();
    setItem.mockRestore();
  });
});
