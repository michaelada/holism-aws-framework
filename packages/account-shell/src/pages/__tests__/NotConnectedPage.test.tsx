import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotConnectedPage from '../NotConnectedPage';
import { renderWithProviders } from '../../test/renderWithProviders';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NotConnectedPage (A6)', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('explains that sign-in worked and the club simply has no record', () => {
    renderWithProviders(<NotConnectedPage />);

    // Without this, a successful sign-in that lands nowhere reads as a broken
    // login and members retry their password instead of asking to join.
    expect(screen.getByText(/sign-in worked/i)).toBeInTheDocument();
  });

  it('offers to request a connection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotConnectedPage />);

    await user.click(screen.getByRole('button', { name: 'Request to join' }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/register');
  });

  it('offers a way to a club the member already belongs to', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotConnectedPage />);

    await user.click(screen.getByRole('button', { name: /go to one of your organisations/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/switch');
  });

  it('does not offer signing in again, which would land in the same place', () => {
    renderWithProviders(<NotConnectedPage />);
    expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument();
  });
});
