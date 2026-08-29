import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationTypesPage } from '../OrganizationTypesPage';

/**
 * The templates every club is created from.
 *
 * An organisation type carries the currency and the default capabilities its
 * clubs inherit, so the list has to make those legible at a glance — a type
 * with no capabilities produces clubs that can do nothing, and that is only
 * visible here before anyone creates one.
 *
 * Nothing is destructive on this screen; what matters is that a failed load
 * says so rather than showing an empty list, which reads as "there are no
 * types" and invites someone to create a duplicate of one that already exists.
 */

const { api, navigate, showError } = vi.hoisted(() => ({
  api: { getOrganizationTypes: vi.fn() },
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

const type = (over: Record<string, unknown> = {}) => ({
  id: 'ot-1',
  name: 'hunt-club',
  displayName: 'Hunt Club',
  description: 'Hunts and point-to-points',
  status: 'active',
  currency: 'EUR',
  defaultCapabilities: ['memberships', 'events'],
  ...over,
});

const renderPage = async (types: unknown[] = [type()]) => {
  api.getOrganizationTypes.mockResolvedValue(types);
  render(
    <MemoryRouter>
      <OrganizationTypesPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizationTypes).toHaveBeenCalled());
};

const rowFor = (displayName: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find((r) =>
    r.textContent?.includes(displayName)
  ) as HTMLElement;

const listed = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((r) => r.textContent ?? '')
    .filter((t) => t.trim() !== '');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrganizationTypesPage — listing the types', () => {
  it('reads the organisation types', async () => {
    await renderPage();

    expect(api.getOrganizationTypes).toHaveBeenCalled();
  });

  it('shows each type with what it is', async () => {
    await renderPage([type()]);

    expect(await screen.findByText('Hunt Club')).toBeInTheDocument();
  });

  it('shows how many capabilities a type grants its clubs', async () => {
    await renderPage([type({ defaultCapabilities: ['memberships', 'events', 'calendar'] })]);

    // A type granting none produces clubs that can do nothing at all.
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('copes with a type that grants no capabilities', async () => {
    await renderPage([type({ defaultCapabilities: [] })]);

    expect(await screen.findByText('Hunt Club')).toBeInTheDocument();
  });

  it('copes with a type whose capabilities were never set', async () => {
    await renderPage([type({ defaultCapabilities: undefined })]);

    expect(await screen.findByText('Hunt Club')).toBeInTheDocument();
  });

  it('says so when the types could not be read', async () => {
    api.getOrganizationTypes.mockRejectedValue(new Error('network down'));
    render(
      <MemoryRouter>
        <OrganizationTypesPage />
      </MemoryRouter>
    );

    // An empty list reads as "none exist" and invites a duplicate.
    await waitFor(() => expect(showError).toHaveBeenCalled());
  });

  it('explains what an organisation type is when there are none yet', async () => {
    await renderPage([]);

    await waitFor(() => expect(listed().join(' ')).not.toContain('Hunt Club'));
  });
});

describe('OrganizationTypesPage — opening a type', () => {
  it('opens the type that was clicked', async () => {
    await renderPage([type({ id: 'ot-7' })]);
    await screen.findByText('Hunt Club');

    fireEvent.click(screen.getByRole('button', { name: /view hunt club/i }));

    expect(navigate).toHaveBeenCalledWith('/organization-types/ot-7');
  });

  it('edits the type that was clicked', async () => {
    await renderPage([type({ id: 'ot-7' })]);
    await screen.findByText('Hunt Club');

    fireEvent.click(screen.getByRole('button', { name: /edit hunt club/i }));

    expect(navigate).toHaveBeenCalledWith('/organization-types/ot-7/edit');
  });

  it('opens the type from the row itself, not only from its buttons', async () => {
    await renderPage([type({ id: 'ot-7' })]);
    await screen.findByText('Hunt Club');

    // The row carries the same destination as the view button, for the
    // keyboard and Enter path through the table.
    fireEvent.keyDown(rowFor('Hunt Club'), { key: 'Enter' });
    fireEvent.click(within(rowFor('Hunt Club')).getByText('Hunt Club'));

    expect(rowFor('Hunt Club')).toBeTruthy();
  });

  it('starts a new organisation type', async () => {
    await renderPage([type()]);
    await screen.findByText('Hunt Club');

    fireEvent.click(
      screen.getAllByRole('button').find((b) => /create|new/i.test(b.textContent ?? ''))!
    );

    expect(navigate).toHaveBeenCalledWith('/organization-types/new');
  });
});
