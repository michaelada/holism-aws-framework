import { describe, it, expect } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembershipTypesListPage from '../MembershipTypesListPage';

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

describe('MembershipTypesListPage', () => {
  it('renders membership types list page', () => {
    renderWithI18n(
      <MemoryRouter>
        <MembershipTypesListPage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Membership Types')).toBeInTheDocument();
    expect(screen.getByText('Create Membership Type')).toBeInTheDocument();
  });

  it('displays search and filter controls', () => {
    renderWithI18n(
      <MemoryRouter>
        <MembershipTypesListPage />
      </MemoryRouter>
    );
    
    expect(screen.getByPlaceholderText(/search membership types/i)).toBeInTheDocument();
  });
});
