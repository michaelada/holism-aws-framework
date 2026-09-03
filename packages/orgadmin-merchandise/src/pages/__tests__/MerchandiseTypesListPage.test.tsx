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

/*
 * The page reads onboarding, page help and capabilities from the shell, and the
 * real `useOnboarding` throws outside its provider. The shared stand-in covers
 * the whole shell surface so a hook added later does not break this suite.
 */
vi.mock('@itsplainsailing/orgadmin-shell', async () =>
  (await import('@itsplainsailing/orgadmin-core/test/shellMock')).createShellMock()
);

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute: vi.fn().mockResolvedValue([]) }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Test Org' } }),
}));

describe('MerchandiseTypesListPage', () => {
  it('should render the page title', () => {
    render(
      <BrowserRouter>
        <MerchandiseTypesListPage />
      </BrowserRouter>
    );
    
    // The page heading is `merchandise.title` — "Merchandise".
    expect(screen.getByRole('heading', { name: 'Merchandise' })).toBeInTheDocument();
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
