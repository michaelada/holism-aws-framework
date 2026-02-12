import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventsListPage from '../EventsListPage';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('EventsListPage', () => {
  it('renders events list page', () => {
    render(
      <BrowserRouter>
        <EventsListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Create Event')).toBeInTheDocument();
  });

  it('displays search and filter controls', () => {
    render(
      <BrowserRouter>
        <EventsListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });
});
