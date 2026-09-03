import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembersDatabasePage from '../MembersDatabasePage';

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  // Shared, so a new shell hook does not break this suite — see test/shell-mock.ts
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => {
  // Overrides only — see test/core-mock.ts for why this is not a full replacement.
  const actual = await importOriginal<Record<string, unknown>>();
  const { coreMock } = await import('../../test/core-mock');
  return { ...actual, ...coreMock() };
});

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
