import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../HomePage';
import NotFoundPage from '../NotFoundPage';

/**
 * The two screens that exist only to send someone somewhere else.
 *
 * Neither holds data, so the only thing that can be wrong with them is the
 * destination — and a card that looks clickable and goes nowhere is a dead end
 * a build will never complain about.
 */

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

beforeEach(() => {
  navigate.mockReset();
});

describe('HomePage', () => {
  it('says what the app is for', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('offers a way into the field definitions', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('heading', { name: 'Field Definitions' }));

    expect(navigate).toHaveBeenCalledWith('/fields');
  });

  it('offers a way into the object definitions', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('heading', { name: 'Object Definitions' }));

    expect(navigate).toHaveBeenCalledWith('/objects');
  });

  it('sends each card somewhere different', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('heading', { name: 'Field Definitions' }));
    fireEvent.click(screen.getByRole('heading', { name: 'Object Definitions' }));

    // Two cards pointing at one route is the copy-paste failure this catches.
    expect(navigate.mock.calls.map(([path]) => path)).toEqual(['/fields', '/objects']);
  });
});

describe('NotFoundPage', () => {
  it('says plainly what happened', () => {
    render(<NotFoundPage />);

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('offers a way out rather than leaving the visitor stuck', () => {
    render(<NotFoundPage />);

    fireEvent.click(screen.getByRole('button', { name: /go home/i }));

    expect(navigate).toHaveBeenCalledWith('/');
  });
});
