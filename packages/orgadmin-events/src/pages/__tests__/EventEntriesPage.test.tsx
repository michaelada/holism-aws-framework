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
  it('renders entries page', () => {
    render(
      <BrowserRouter>
        <EventEntriesPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Event Entries')).toBeInTheDocument();
    expect(screen.getByText('Download All Entries')).toBeInTheDocument();
  });

  it('displays filter controls', () => {
    render(
      <BrowserRouter>
        <EventEntriesPage />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText('Event Activity')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
  });
});
