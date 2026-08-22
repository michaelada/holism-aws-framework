import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventEntriesPage from '../EventEntriesPage';

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
  };
});

describe('EventEntriesPage', () => {
  /*
   * The page opens on a spinner while the entries load, so every assertion has
   * to wait. Asserting synchronously found the loading state and reported the
   * heading as missing.
   */
  it('renders entries page', async () => {
    render(
      <BrowserRouter>
        <EventEntriesPage />
      </BrowserRouter>
    );

    expect(await screen.findByText('Event Entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export to Excel/i })).toBeInTheDocument();
  });

  it('displays the entry search control', async () => {
    render(
      <BrowserRouter>
        <EventEntriesPage />
      </BrowserRouter>
    );

    expect(await screen.findByPlaceholderText('Search by name or email...')).toBeInTheDocument();
  });
});
