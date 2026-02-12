import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MembersDatabasePage from '../MembersDatabasePage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('MembersDatabasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders members database page', () => {
    render(
      <BrowserRouter>
        <MembersDatabasePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Members Database')).toBeInTheDocument();
    expect(screen.getByText('Export to Excel')).toBeInTheDocument();
  });

  it('displays filter buttons', () => {
    render(
      <BrowserRouter>
        <MembersDatabasePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Elapsed')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('displays search field', () => {
    render(
      <BrowserRouter>
        <MembersDatabasePage />
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText(/search by name or membership number/i)).toBeInTheDocument();
  });
});
