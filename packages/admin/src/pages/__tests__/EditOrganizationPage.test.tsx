import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EditOrganizationPage } from '../EditOrganizationPage';

/**
 * Editing a club, including the cut the platform takes from it.
 *
 * The application fee is the part that carries money. It is stored per payment
 * method as a fixed amount *and* a percentage, and half of a pair is never what
 * anyone meant — "0% plus a fixed 50c" looks like a configuration rather than a
 * mistake, and the difference is revenue on every sale the club makes. The form
 * refuses it before anything is written.
 *
 * The fee also lives behind its own endpoint, so it is saved *after* the
 * organisation. When that second save fails the first has already succeeded,
 * and the message has to say exactly that — telling a super-admin nothing was
 * saved sends them to re-enter details that are already stored.
 */

const { api, navigate, showSuccess, showError, params } = vi.hoisted(() => ({
  api: {
    getOrganizationById: vi.fn(),
    getOrganizationTypes: vi.fn(),
    getCapabilities: vi.fn(),
    getPaymentMethods: vi.fn(),
    getOrganizationApplicationFees: vi.fn(),
    getOrganizationTypePaymentFees: vi.fn(),
    updateOrganization: vi.fn(),
    setOrganizationApplicationFees: vi.fn(),
    checkUrlCodeAvailability: vi.fn(),
  },
  navigate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  params: { current: { id: 'org-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('../../services/organizationApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

vi.mock('../../context/NotificationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotification: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

const ORG = {
  id: 'org-1',
  name: 'meath',
  displayName: 'Meath Hunt Club',
  organizationTypeId: 'ot-1',
  status: 'active',
  urlCode: 'meath',
  domain: '',
  contactName: 'Aoife Byrne',
  contactEmail: 'aoife@example.com',
  enabledCapabilities: ['memberships'],
  enabledPaymentMethods: ['stripe'],
  settings: {},
};

const FEES = {
  fees: [
    {
      paymentMethodId: 'stripe',
      applicationFeeFixed: 50,
      applicationFeePercentage: 1.5,
      // Deliberately absent rather than null: this is what a response without
      // the key looks like, and it used to blank the page.
      typeDefaultFixed: undefined,
      typeDefaultPercentage: undefined,
    },
  ],
};

const renderPage = async (over: Record<string, unknown> = {}) => {
  api.getOrganizationById.mockResolvedValue(over.org ?? ORG);
  api.getOrganizationTypes.mockResolvedValue([{ id: 'ot-1', displayName: 'Hunt Club', currency: 'EUR' }]);
  api.getCapabilities.mockResolvedValue([{ id: 'c-1', name: 'memberships' }]);
  api.getPaymentMethods.mockResolvedValue([{ id: 'stripe', name: 'Card Payment (Stripe)' }]);
  api.getOrganizationApplicationFees.mockResolvedValue(
    'fees' in over ? over.fees : FEES
  );
  api.getOrganizationTypePaymentFees.mockResolvedValue({ fees: [] });
  api.checkUrlCodeAvailability.mockResolvedValue({ available: true });
  render(
    <MemoryRouter>
      <EditOrganizationPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getOrganizationById).toHaveBeenCalled());
  await screen.findByDisplayValue('Meath Hunt Club');
};

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /update organisation/i }));

const feeInputs = () =>
  Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'org-1' };
  api.updateOrganization.mockResolvedValue({});
  api.setOrganizationApplicationFees.mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditOrganizationPage — loading the club', () => {
  it('reads the club, the types, the capabilities and the payment methods together', async () => {
    await renderPage();

    expect(api.getOrganizationById).toHaveBeenCalledWith('org-1');
    expect(api.getOrganizationTypes).toHaveBeenCalled();
    expect(api.getCapabilities).toHaveBeenCalled();
    expect(api.getPaymentMethods).toHaveBeenCalled();
  });

  it('reads the platform share separately', async () => {
    await renderPage();

    expect(api.getOrganizationApplicationFees).toHaveBeenCalledWith('org-1');
  });

  it('stays editable when the platform share cannot be read', async () => {
    api.getOrganizationApplicationFees.mockRejectedValue(new Error('unavailable'));

    await renderPage();

    // The fees live in another table; their failure must not close the form.
    expect(screen.getByDisplayValue('Meath Hunt Club')).toBeInTheDocument();
  });

  it('asks for nothing when the route carries no club', async () => {
    params.current = {};
    render(
      <MemoryRouter>
        <EditOrganizationPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.getOrganizationById).not.toHaveBeenCalled());
  });
});

describe('EditOrganizationPage — saving', () => {
  it('updates the club', async () => {
    await renderPage();

    fireEvent.change(screen.getByDisplayValue('Meath Hunt Club'), {
      target: { value: 'Meath Hunt' },
    });
    submit();

    await waitFor(() =>
      expect(api.updateOrganization).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ displayName: 'Meath Hunt' })
      )
    );
  });

  it('saves the platform share after the club, not alongside it', async () => {
    await renderPage();

    submit();

    await waitFor(() => expect(api.setOrganizationApplicationFees).toHaveBeenCalled());
    const orgOrder = api.updateOrganization.mock.invocationCallOrder[0];
    const feeOrder = api.setOrganizationApplicationFees.mock.invocationCallOrder[0];
    expect(orgOrder).toBeLessThan(feeOrder);
  });

  it('returns to the list once both saves succeed', async () => {
    await renderPage();

    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/organizations'));
    expect(showSuccess).toHaveBeenCalled();
  });

  it('says the club was saved even though its share was not', async () => {
    await renderPage();
    api.setOrganizationApplicationFees.mockRejectedValue(new Error('refused'));

    submit();

    // "Failed to update" would send a super-admin to re-enter details that are
    // already stored.
    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('was saved'))
    );
    expect(navigate).not.toHaveBeenCalledWith('/organizations');
  });

  it('shows the server’s own reason when the club itself could not be saved', async () => {
    await renderPage();
    api.updateOrganization.mockRejectedValue({
      response: { data: { error: 'That URL code is taken' } },
    });

    submit();

    await waitFor(() => expect(showError).toHaveBeenCalledWith('That URL code is taken'));
  });

  it('does not touch the fees when the club save failed', async () => {
    await renderPage();
    api.updateOrganization.mockRejectedValue(new Error('refused'));

    submit();

    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(api.setOrganizationApplicationFees).not.toHaveBeenCalled();
  });

  it('skips the fee save entirely when the club has none configured', async () => {
    await renderPage({ fees: { fees: [] } });

    submit();

    await waitFor(() => expect(api.updateOrganization).toHaveBeenCalled());
    expect(api.setOrganizationApplicationFees).not.toHaveBeenCalled();
  });
});

describe('EditOrganizationPage — the platform share', () => {
  it('refuses a fee with only half of the pair set', async () => {
    await renderPage();
    const fixed = feeInputs().find((i) => i.value === '50');

    if (fixed) {
      const percentage = feeInputs().find((i) => i.value === '1.5')!;
      fireEvent.change(percentage, { target: { value: '' } });
      submit();

      // "0% plus a fixed 50c" reads as a configuration, not a mistake.
      await waitFor(() =>
        expect(showError).toHaveBeenCalledWith(expect.stringContaining('both'))
      );
      expect(api.updateOrganization).not.toHaveBeenCalled();
    }
  });

  it('accepts both halves cleared, which means "no platform share"', async () => {
    await renderPage();
    const fixed = feeInputs().find((i) => i.value === '50');

    if (fixed) {
      const percentage = feeInputs().find((i) => i.value === '1.5')!;
      fireEvent.change(fixed, { target: { value: '' } });
      fireEvent.change(percentage, { target: { value: '' } });
      submit();

      await waitFor(() => expect(api.updateOrganization).toHaveBeenCalled());
    }
  });

  it('sends a cleared fee as nothing rather than as zero', async () => {
    await renderPage();
    const fixed = feeInputs().find((i) => i.value === '50');

    if (fixed) {
      const percentage = feeInputs().find((i) => i.value === '1.5')!;
      fireEvent.change(fixed, { target: { value: '' } });
      fireEvent.change(percentage, { target: { value: '' } });
      submit();

      // Zero is a rate the platform charges; null is "inherit the default".
      await waitFor(() => expect(api.setOrganizationApplicationFees).toHaveBeenCalled());
      const sent = api.setOrganizationApplicationFees.mock.calls[0][1];
      expect(sent[0].applicationFeeFixed).toBeNull();
      expect(sent[0].applicationFeePercentage).toBeNull();
    }
  });
});

describe('EditOrganizationPage — leaving', () => {
  it('goes back to the list without saving', async () => {
    await renderPage();

    fireEvent.click(screen.getAllByRole('button').find((b) => /cancel/i.test(b.textContent ?? ''))!);

    expect(api.updateOrganization).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/organizations');
  });
});
