import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembersDatabasePage from '../MembersDatabasePage';

describe('MembersDatabasePage', () => {
  beforeEach(() => {
    // Clear any mocks if needed
  });

  it('renders members database page', () => {
    renderWithI18n(
      <MemoryRouter>
        <MembersDatabasePage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Members Database')).toBeInTheDocument();
    expect(screen.getByText('Export to Excel')).toBeInTheDocument();
  });

  it('displays filter buttons', () => {
    renderWithI18n(
      <MemoryRouter>
        <MembersDatabasePage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Elapsed')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('displays search field', () => {
    renderWithI18n(
      <MemoryRouter>
        <MembersDatabasePage />
      </MemoryRouter>
    );
    
    expect(screen.getByPlaceholderText(/search by name or membership number/i)).toBeInTheDocument();
  });
});
