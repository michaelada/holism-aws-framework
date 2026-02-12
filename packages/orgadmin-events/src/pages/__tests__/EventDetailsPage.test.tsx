import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EventDetailsPage from '../EventDetailsPage';

// Mock useParams and useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

describe('EventDetailsPage', () => {
  it('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <EventDetailsPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Loading event...')).toBeInTheDocument();
  });
});
