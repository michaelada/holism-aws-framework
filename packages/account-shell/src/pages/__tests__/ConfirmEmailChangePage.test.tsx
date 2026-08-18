import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ConfirmEmailChangePage from '../ConfirmEmailChangePage';
import { renderWithProviders } from '../../test/renderWithProviders';

const mockExecute = vi.fn();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

/**
 * P6 — the page the email-change link lands on.
 *
 * Opened cold from a mail client, so it must work with no session and no
 * organisation. The token is single-use, which makes "called exactly once" a
 * correctness property rather than an efficiency one: a second call would
 * consume nothing and report failure over a change that had just succeeded.
 */
describe('ConfirmEmailChangePage', () => {
  const render = (search = '?token=abc123') =>
    renderWithProviders(<ConfirmEmailChangePage />, {
      route: `/confirm-email${search}`,
      path: '/confirm-email',
    });

  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ email: 'new@example.com' });
  });

  it('confirms the change and names the new address', async () => {
    render();

    expect(await screen.findByText('Email address changed')).toBeInTheDocument();
    expect(screen.getByText('You now sign in with new@example.com.')).toBeInTheDocument();
  });

  it('sends the token anonymously', async () => {
    // There is no session: the member is mid-way through replacing the address
    // they would have to sign in with.
    render();

    await screen.findByText('Email address changed');
    expect(mockExecute).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/public/email-change/confirm',
      data: { token: 'abc123' },
      anonymous: true,
    });
  });

  it('calls the API exactly once', async () => {
    // The token is single-use. React 18 mounts effects twice in development,
    // and a second call would consume nothing and report failure over a change
    // that had just succeeded.
    render();

    await screen.findByText('Email address changed');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('gives one message for a link that did not work', async () => {
    mockExecute.mockRejectedValue(new Error('nope'));
    render();

    expect(await screen.findByText('This link is no longer valid')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Links last an hour and can be used once. Your email address has not changed — start again from Profile & settings.'
      )
    ).toBeInTheDocument();
  });

  it('does not call the API at all when the link carried no token', async () => {
    render('');

    expect(await screen.findByText('This link is no longer valid')).toBeInTheDocument();
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
