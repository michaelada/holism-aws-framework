import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreateEventPage from '../CreateEventPage';

// Mock useNavigate and useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

describe('CreateEventPage', () => {
  it('renders create event form', () => {
    render(
      <BrowserRouter>
        <CreateEventPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Create Event')).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
  });

  it('displays all required event fields', () => {
    render(
      <BrowserRouter>
        <CreateEventPage />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Event Start Date/i)).toBeInTheDocument();
  });
});
