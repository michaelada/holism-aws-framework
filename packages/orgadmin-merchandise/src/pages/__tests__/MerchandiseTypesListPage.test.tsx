/**
 * Merchandise Types List Page Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MerchandiseTypesListPage from '../MerchandiseTypesListPage';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('MerchandiseTypesListPage', () => {
  it('should render the page title', () => {
    render(
      <BrowserRouter>
        <MerchandiseTypesListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Merchandise Types')).toBeInTheDocument();
  });

  it('should render create button', () => {
    render(
      <BrowserRouter>
        <MerchandiseTypesListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Create Merchandise Type')).toBeInTheDocument();
  });

  it('should render search and filter controls', () => {
    render(
      <BrowserRouter>
        <MerchandiseTypesListPage />
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText('Search merchandise types...')).toBeInTheDocument();
  });
});
