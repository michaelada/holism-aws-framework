import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineBanner from '../OfflineBanner';
import { renderWithProviders } from '../../test/renderWithProviders';

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
};

/** The browser's own events, which is all the hook listens to. */
const goOffline = () =>
  act(() => {
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
  });

const goOnline = () =>
  act(() => {
    setOnline(true);
    window.dispatchEvent(new Event('online'));
  });

/**
 * H1 — the member has no connection.
 *
 * Persistent and dismissible only to a chip: everything below it may be hours
 * old, and a member who dismissed that outright would read stale prices as
 * current.
 */
describe('OfflineBanner', () => {
  beforeEach(() => setOnline(true));
  afterEach(() => setOnline(true));

  it('shows nothing at all while there is a connection', () => {
    renderWithProviders(<OfflineBanner />);

    expect(screen.queryByText(/You are offline/)).not.toBeInTheDocument();
  });

  it('appears when the connection drops', () => {
    renderWithProviders(<OfflineBanner />);

    goOffline();

    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  it('says what still works and what does not', () => {
    setOnline(false);
    renderWithProviders(<OfflineBanner />);

    expect(screen.getByText(/still see what was last loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot buy, book or change/i)).toBeInTheDocument();
  });

  it('is there for a tab opened while already offline', () => {
    setOnline(false);
    renderWithProviders(<OfflineBanner />);

    // The events fire on change, so an initial read is what covers this.
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  it('goes away by itself when the connection returns', () => {
    setOnline(false);
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();

    goOnline();

    expect(screen.queryByText(/You are offline/)).not.toBeInTheDocument();
  });

  describe('dismissing it', () => {
    it('collapses to a chip rather than disappearing', async () => {
      setOnline(false);
      renderWithProviders(<OfflineBanner />);

      await userEvent.click(screen.getByRole('button', { name: /show less/i }));

      expect(screen.queryByText(/You are offline\./)).not.toBeInTheDocument();
      // The claim stays on screen: the data below it is still old.
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('opens again from the chip', async () => {
      setOnline(false);
      renderWithProviders(<OfflineBanner />);
      await userEvent.click(screen.getByRole('button', { name: /show less/i }));

      await userEvent.click(screen.getByText('Offline'));

      expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    });

    /** A fresh disconnection is new information, not the same notice repeated. */
    it('comes back in full when the connection drops again', async () => {
      setOnline(false);
      renderWithProviders(<OfflineBanner />);
      await userEvent.click(screen.getByRole('button', { name: /show less/i }));

      goOnline();
      goOffline();

      expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    });
  });
});
