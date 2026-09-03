import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembershipTypeDetailsPage from '../MembershipTypeDetailsPage';

/**
 * One membership type, read-only.
 *
 * The edit button is the part with a decision in it: single and group types are
 * edited on different screens, and this page chooses which by reading the
 * type's own category. Sending a group type to the single form drops the group
 * configuration — how many people, their titles, and which answers they share —
 * without saying so.
 *
 * The rest is failure handling: whatever goes wrong, an operator must be left
 * with a way back to the list rather than a blank page.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { id: 'mt-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath' },
    setOrganisation: vi.fn(),
  }),
}));

const TYPE = {
  id: 'mt-1',
  name: 'Senior Member',
  description: 'Over 18s',
  membershipStatus: 'open',
  membershipTypeCategory: 'single',
  isRollingMembership: true,
  numberOfMonths: 12,
  fee: 50,
  memberLabels: ['committee'],
  supportedPaymentMethods: ['stripe'],
  useTermsAndConditions: false,
};

const renderPage = async (type: unknown = TYPE) => {
  execute.mockResolvedValue(type);
  renderWithI18n(
    <MemoryRouter>
      <MembershipTypeDetailsPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

/** The name appears in the heading and again in the details card below. */
const shown = (name: string) => screen.findAllByText(name);

const backButton = () =>
  screen.getAllByRole('button').find((b) => /back/i.test(b.textContent ?? ''))!;

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'mt-1' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MembershipTypeDetailsPage — showing the type', () => {
  it('reads the type named in the route', async () => {
    await renderPage();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/membership-types/mt-1',
    });
  });

  it('shows what the type is', async () => {
    await renderPage();

    expect(await shown('Senior Member')).not.toHaveLength(0);
    expect(screen.getByText('Over 18s')).toBeInTheDocument();
  });
});

describe('MembershipTypeDetailsPage — when there is nothing to show', () => {
  it('says so when the type could not be read', async () => {
    execute.mockRejectedValue(new Error('network down'));
    renderWithI18n(
      <MemoryRouter>
        <MembershipTypeDetailsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says so when the type does not exist', async () => {
    await renderPage(null);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('asks for nothing at all when the route carries no id', async () => {
    params.current = {};
    renderWithI18n(
      <MemoryRouter>
        <MembershipTypeDetailsPage />
      </MemoryRouter>
    );

    // `/membership-types/undefined` is a 404 dressed up as a real request.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });

  it('still offers a way back to the list', async () => {
    await renderPage(null);
    await screen.findByRole('alert');

    fireEvent.click(backButton());

    // A dead end here means reaching for the browser's back button.
    expect(navigate).toHaveBeenCalledWith('/members/types');
  });
});

describe('MembershipTypeDetailsPage — editing', () => {
  it('opens the single-membership form for a single type', async () => {
    await renderPage({ ...TYPE, membershipTypeCategory: 'single' });
    await shown('Senior Member');

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(navigate).toHaveBeenCalledWith('/members/types/mt-1/edit/single');
  });

  it('opens the group form for a group type', async () => {
    await renderPage({ ...TYPE, name: 'Family Membership', membershipTypeCategory: 'group' });
    await shown('Family Membership');

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // The single form has no group configuration; editing there drops it.
    expect(navigate).toHaveBeenCalledWith('/members/types/mt-1/edit/group');
  });

  it('treats an unrecognised category as a group rather than losing its fields', async () => {
    await renderPage({ ...TYPE, membershipTypeCategory: 'family' });
    await shown('Senior Member');

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(navigate).toHaveBeenCalledWith('/members/types/mt-1/edit/group');
  });
});

describe('MembershipTypeDetailsPage — going back', () => {
  it('returns to the list of types', async () => {
    await renderPage();
    await shown('Senior Member');

    fireEvent.click(backButton());

    expect(navigate).toHaveBeenCalledWith('/members/types');
  });
});
