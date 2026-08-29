import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

/**
 * The platform at a glance.
 *
 * Every number here is derived rather than fetched: the administrator and
 * member totals are summed across organisations, and "active" is counted from
 * their statuses. That arithmetic is the whole content of the page, and it is
 * the kind that fails quietly — a club whose counts have not been recorded
 * yet contributes `undefined`, which turns the platform-wide total into `NaN`
 * on a page whose only job is to show numbers.
 */

const { api, navigate, showError } = vi.hoisted(() => ({
  api: {
    getOrganizations: vi.fn(),
    getOrganizationTypes: vi.fn(),
    getCapabilities: vi.fn(),
    getPaymentMethods: vi.fn(),
  },
  navigate: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('../../services/organizationApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

vi.mock('../../context/NotificationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotification: () => ({ showSuccess: vi.fn(), showError, showInfo: vi.fn() }),
}));

const org = (over: Record<string, unknown> = {}) => ({
  id: 'org-1',
  displayName: 'Meath Hunt Club',
  status: 'active',
  adminUserCount: 2,
  accountUserCount: 140,
  ...over,
});

const renderPage = async (over: Record<string, unknown> = {}) => {
  api.getOrganizations.mockResolvedValue(over.organizations ?? [org()]);
  api.getOrganizationTypes.mockResolvedValue(over.types ?? [{ id: 'ot-1' }]);
  api.getCapabilities.mockResolvedValue(over.capabilities ?? [{ id: 'c-1' }, { id: 'c-2' }]);
  api.getPaymentMethods.mockResolvedValue(over.paymentMethods ?? [{ id: 'pm-1' }]);
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizations).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
};

/** The number shown on the card with a given title. */
const statFor = (title: string) => {
  const heading = screen.getByText(title);
  const card = heading.closest('.MuiCard-root') as HTMLElement;
  return within(card)
    .getAllByText(/^\d+$/)
    .map((el) => el.textContent)[0];
};

const openCard = (title: string) => {
  const card = screen.getByText(title).closest('.MuiCard-root') as HTMLElement;
  fireEvent.click(card.querySelector('.MuiCardActionArea-root') ?? card);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DashboardPage — counting what is on the platform', () => {
  it('reads everything it needs in one go', async () => {
    await renderPage();

    expect(api.getOrganizations).toHaveBeenCalled();
    expect(api.getOrganizationTypes).toHaveBeenCalled();
    expect(api.getCapabilities).toHaveBeenCalled();
    expect(api.getPaymentMethods).toHaveBeenCalled();
  });

  it('counts the organisations', async () => {
    await renderPage({ organizations: [org({ id: 'a' }), org({ id: 'b' })] });

    expect(statFor('Organisations')).toBe('2');
  });

  it('counts only the active ones as active', async () => {
    await renderPage({
      organizations: [org({ id: 'a' }), org({ id: 'b', status: 'inactive' })],
    });

    expect(screen.getByText('1 active')).toBeInTheDocument();
  });

  it('counts the organisation types and capabilities', async () => {
    await renderPage({ types: [{ id: '1' }, { id: '2' }, { id: '3' }] });

    expect(statFor('Organisation Types')).toBe('3');
    expect(statFor('Capabilities')).toBe('2');
  });

  it('adds up administrators across every club', async () => {
    await renderPage({
      organizations: [org({ id: 'a', adminUserCount: 2 }), org({ id: 'b', adminUserCount: 3 })],
    });

    expect(statFor('Administrators')).toBe('5');
  });

  it('adds up members across every club', async () => {
    await renderPage({
      organizations: [
        org({ id: 'a', accountUserCount: 140 }),
        org({ id: 'b', accountUserCount: 60 }),
      ],
    });

    expect(statFor('Members')).toBe('200');
  });

  it('treats a club with no counts recorded as zero, not as NaN', async () => {
    await renderPage({
      organizations: [
        org({ id: 'a', adminUserCount: 2, accountUserCount: 140 }),
        org({ id: 'b', adminUserCount: undefined, accountUserCount: undefined }),
      ],
    });

    // One `undefined` in the sum turns the whole platform total into "NaN".
    expect(statFor('Administrators')).toBe('2');
    expect(statFor('Members')).toBe('140');
  });

  it('counts the payment methods', async () => {
    await renderPage({ paymentMethods: [{ id: 'a' }, { id: 'b' }] });

    expect(statFor('Payment Methods')).toBe('2');
  });

  it('shows zeros rather than blanks on an empty platform', async () => {
    await renderPage({ organizations: [], types: [], capabilities: [], paymentMethods: [] });

    expect(statFor('Organisations')).toBe('0');
    expect(statFor('Members')).toBe('0');
  });
});

describe('DashboardPage — when the figures cannot be read', () => {
  it('says so rather than showing zeros as though they were real', async () => {
    api.getOrganizations.mockRejectedValue(new Error('network down'));
    api.getOrganizationTypes.mockResolvedValue([]);
    api.getCapabilities.mockResolvedValue([]);
    api.getPaymentMethods.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // A platform reporting zero clubs looks like a platform that lost them.
    await waitFor(() => expect(showError).toHaveBeenCalledWith('Failed to load dashboard data'));
  });

  it('stops showing the spinner even after a failure', async () => {
    api.getOrganizations.mockRejectedValue(new Error('network down'));
    api.getOrganizationTypes.mockResolvedValue([]);
    api.getCapabilities.mockResolvedValue([]);
    api.getPaymentMethods.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  });
});

describe('DashboardPage — following a figure to its list', () => {
  it('opens the organisations list', async () => {
    await renderPage();

    openCard('Organisations');

    expect(navigate).toHaveBeenCalledWith('/organizations');
  });

  it('opens the organisation types list', async () => {
    await renderPage();

    openCard('Organisation Types');

    expect(navigate).toHaveBeenCalledWith('/organization-types');
  });

  it('opens the administrators list', async () => {
    await renderPage();

    openCard('Administrators');

    expect(navigate).toHaveBeenCalledWith('/users');
  });

  it('leaves a figure with nowhere to go as plain text', async () => {
    await renderPage();

    const card = screen.getByText('Capabilities').closest('.MuiCard-root') as HTMLElement;

    // Capabilities are platform-wide and have no list of their own; a card that
    // looked clickable and did nothing would read as broken.
    expect(card.querySelector('.MuiCardActionArea-root')).toBeNull();
  });
});
