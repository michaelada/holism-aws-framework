import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MembershipTypesListPage from '../MembershipTypesListPage';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('MembershipTypesListPage', () => {
  it('renders membership types list page', () => {
    render(
      <BrowserRouter>
        <MembershipTypesListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Membership Types')).toBeInTheDocument();
    expect(screen.getByText('Create Membership Type')).toBeInTheDocument();
  });

  it('displays search and filter controls', () => {
    render(
      <BrowserRouter>
        <MembershipTypesListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText(/search membership types/i)).toBeInTheDocument();
  });
});
