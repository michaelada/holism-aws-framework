import { describe, it, expect, vi } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import CreateSingleMembershipTypePage from '../CreateSingleMembershipTypePage';

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

// Mock ReactQuill
vi.mock('react-quill', () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="quill-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe('CreateSingleMembershipTypePage', () => {
  it('renders create single membership type form', () => {
    renderWithI18n(
      <MemoryRouter>
        <CreateSingleMembershipTypePage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Create Single Membership Type')).toBeInTheDocument();
  });

  it('displays all required form fields', () => {
    renderWithI18n(
      <MemoryRouter>
        <CreateSingleMembershipTypePage />
      </MemoryRouter>
    );
    
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });
});
