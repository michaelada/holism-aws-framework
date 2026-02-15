import { describe, it, expect } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembershipTypesListPage from '../MembershipTypesListPage';

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
