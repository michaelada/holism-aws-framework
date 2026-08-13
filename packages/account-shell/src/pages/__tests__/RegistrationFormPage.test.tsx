import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationFormPage from '../RegistrationFormPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';
import { CatalogueRegistrationType } from '../../types/account';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ typeId: 'rt-1' }),
  };
});

const type = (over: Partial<CatalogueRegistrationType> = {}): CatalogueRegistrationType => ({
  id: 'rt-1',
  name: 'Horse registration 2026',
  description: 'Annual registration',
  entityName: 'Horse',
  registrationFormId: null,
  isRollingRegistration: false,
  validUntil: '2026-12-31',
  numberOfMonths: null,
  automaticallyApprove: true,
  fee: 4500,
  handlingFeeIncluded: false,
  supportedPaymentMethodIds: ['pm-card'],
  termsAndConditions: null,
  available: true,
  unavailableReason: null,
  ...over,
});

const respond = (over: Partial<CatalogueRegistrationType> = {}, form?: Record<string, unknown>) => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) => {
    if (request.method === 'POST' && request.url.includes('form-submissions')) {
      return Promise.resolve({ id: 'sub-1' });
    }
    if (request.method === 'POST') return Promise.resolve({});
    if (request.url.includes('/forms/')) return Promise.resolve(form ?? null);
    return Promise.resolve([type(over)]);
  });
};

/**
 * D8 — registering one thing.
 *
 * The name of the thing is the substance of the record — `entity_name` is NOT
 * NULL and is what every list identifies it by — so it is a field of its own,
 * asked for using the club's word rather than buried in the club's form.
 */
describe('RegistrationFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    respond();
  });

  it('asks for the thing by the club’s own word for it', async () => {
    renderWithProviders(<RegistrationFormPage />);

    expect(await screen.findByText('Horse registration 2026')).toBeInTheDocument();
    expect(screen.getByLabelText(/Horse name/)).toBeInTheDocument();
    expect(screen.getByText('About the Horse')).toBeInTheDocument();
  });

  it('uses that word for a club that registers something else', async () => {
    respond({ entityName: 'Boat' });
    renderWithProviders(<RegistrationFormPage />);

    expect(await screen.findByLabelText(/Boat name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Horse/)).not.toBeInTheDocument();
  });

  it('will not submit until the thing is named', async () => {
    renderWithProviders(<RegistrationFormPage />);

    const add = await screen.findByRole('button', { name: 'Add to basket' });
    expect(add).toBeDisabled();
    expect(screen.getByText(/Give the name of the horse/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Horse name/), 'Rocket');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
    );
  });

  it('will not accept a name of only spaces', async () => {
    renderWithProviders(<RegistrationFormPage />);

    await userEvent.type(await screen.findByLabelText(/Horse name/), '   ');

    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
  });

  it('sends the type and the name to the basket', async () => {
    renderWithProviders(<RegistrationFormPage />);
    await userEvent.type(await screen.findByLabelText(/Horse name/), '  Rocket  ');
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `/api/account/${contextValue.orgCode}/cart/items`,
          data: expect.objectContaining({
            itemType: 'registration',
            unitFee: 4500,
            contextRef: { registrationTypeId: 'rt-1', entityName: 'Rocket' },
            // The basket needs to distinguish one horse from another.
            description: 'Horse registration 2026 — Rocket',
          }),
        })
      )
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });

  /** Paying and *then* discovering there is a wait is the complaint this avoids. */
  it('says before payment when the club reviews registrations', async () => {
    respond({ automaticallyApprove: false });
    renderWithProviders(<RegistrationFormPage />);

    expect(await screen.findByText(/looks at each horse before/i)).toBeInTheDocument();
  });

  it('says nothing about approval when the club approves automatically', async () => {
    renderWithProviders(<RegistrationFormPage />);

    await screen.findByLabelText(/Horse name/);
    expect(screen.queryByText(/looks at each/i)).not.toBeInTheDocument();
  });

  describe('the club’s own form', () => {
    const form = {
      id: 'form-1',
      fields: [
        {
          id: 'f1',
          name: 'passport',
          label: 'Passport number',
          datatype: 'text',
          order: 1,
          required: true,
        },
      ],
    };

    it('will not submit until its required answers are given', async () => {
      respond({ registrationFormId: 'form-1' }, form);
      renderWithProviders(<RegistrationFormPage />);

      await userEvent.type(await screen.findByLabelText(/Horse name/), 'Rocket');
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/Passport number/), 'IE12345');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });

    it('saves the answers as a registration submission and links them', async () => {
      respond({ registrationFormId: 'form-1' }, form);
      renderWithProviders(<RegistrationFormPage />);

      await userEvent.type(await screen.findByLabelText(/Horse name/), 'Rocket');
      await userEvent.type(screen.getByLabelText(/Passport number/), 'IE12345');
      await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('form-submissions'),
            data: expect.objectContaining({ submissionType: 'registration' }),
          })
        )
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ formSubmissionId: 'sub-1' }),
        })
      );
    });
  });

  it('will not submit until the terms are accepted', async () => {
    respond({ termsAndConditions: '<p>Vaccinations must be current.</p>' });
    renderWithProviders(<RegistrationFormPage />);

    await userEvent.type(await screen.findByLabelText(/Horse name/), 'Rocket');
    expect(screen.getByText('Vaccinations must be current.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
    );
  });

  it('reports a refusal from the server', async () => {
    mockExecute.mockImplementation((request: { url: string; method?: string }) => {
      if (request.method === 'POST') {
        return Promise.reject(new Error('That registration is not open at the moment'));
      }
      return Promise.resolve([type()]);
    });
    renderWithProviders(<RegistrationFormPage />);

    await userEvent.type(await screen.findByLabelText(/Horse name/), 'Rocket');
    await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

    expect(await screen.findByText('That registration is not open at the moment')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });

  it('says so when the registration has been withdrawn', async () => {
    mockExecute.mockResolvedValue([]);
    renderWithProviders(<RegistrationFormPage />);

    expect(await screen.findByText(/no longer offered/i)).toBeInTheDocument();
  });
});
