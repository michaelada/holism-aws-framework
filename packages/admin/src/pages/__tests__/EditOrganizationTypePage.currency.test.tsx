import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getCapabilities: vi.fn(),
  getOrganizationTypeById: vi.fn(),
  updateOrganizationType: vi.fn(),
  getOrganizationTypePaymentFees: vi.fn(),
  setOrganizationTypePaymentFees: vi.fn(),
  getCardPaymentMethodDefaults: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../../services/organizationApi', () => ({
  getCapabilities: mocks.getCapabilities,
  getOrganizationTypeById: mocks.getOrganizationTypeById,
  updateOrganizationType: mocks.updateOrganizationType,
  getOrganizationTypePaymentFees: mocks.getOrganizationTypePaymentFees,
  setOrganizationTypePaymentFees: mocks.setOrganizationTypePaymentFees,
  getCardPaymentMethodDefaults: mocks.getCardPaymentMethodDefaults,
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    showInfo: vi.fn(),
  }),
}));

import { EditOrganizationTypePage } from '../EditOrganizationTypePage';

const type = {
  id: 'type-1',
  name: 'sailing-club',
  displayName: 'Sailing Club',
  description: 'Clubs on the water',
  currency: 'EUR',
  language: 'en',
  defaultLocale: 'en-GB',
  defaultCapabilities: ['events'],
  membershipNumbering: 'internal',
  membershipNumberUniqueness: 'organization',
  initialMembershipNumber: 1000000,
  status: 'active',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/organization-types/type-1/edit']}>
      <Routes>
        <Route path="/organization-types/:id/edit" element={<EditOrganizationTypePage />} />
      </Routes>
    </MemoryRouter>
  );

describe('EditOrganizationTypePage — currency guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCapabilities.mockResolvedValue([]);
    mocks.getOrganizationTypeById.mockResolvedValue(type);
    mocks.getCardPaymentMethodDefaults.mockResolvedValue([]);
    mocks.getOrganizationTypePaymentFees.mockResolvedValue({
      organisationCount: 14,
      fees: [
        {
          paymentMethodId: 'pm-stripe',
          paymentMethodDisplayName: 'Pay By Card (Stripe)',
          fixedFee: 0.25,
          percentageFee: 1.5,
          taxPercentage: 23,
        },
      ],
    });
  });

  /**
   * The P0 this page exists to prevent.
   *
   * `fixedFee` is a cash amount in the type's currency. Switching EUR to JPY
   * reinterprets 0.25 as ¥0.25 and every organisation of the type immediately
   * charges a nonsense handling fee on live card payments. The control used to
   * be an ordinary seven-option select with no warning of any kind.
   */
  it('locks the currency once organisations depend on the type', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByDisplayValue('Sailing Club')).toBeInTheDocument()
    );

    const currency = screen.getByLabelText('Currency');
    expect(currency).toHaveAttribute('readonly');
    expect(screen.getByText(/Locked because 14 organisations already use this type/i))
      .toBeInTheDocument();
  });

  it('states the blast radius before unlocking, and demands the type name be typed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Sailing Club')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Change currency/i }));

    expect(screen.getByText(/re-denominates all of them without converting/i))
      .toBeInTheDocument();
    expect(
      screen.getByText(/14 organisations of this type will charge the re-denominated handling fee/i)
    ).toBeInTheDocument();

    const unlock = screen.getByRole('button', { name: /Unlock currency/i });
    expect(unlock).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type Sailing Club to confirm/i), {
      target: { value: 'Sailing Club' },
    });
    expect(unlock).toBeEnabled();
  });

  it('leaves the currency editable when nothing depends on the type yet', async () => {
    mocks.getOrganizationTypePaymentFees.mockResolvedValue({ organisationCount: 0, fees: [] });
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('Sailing Club')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Change currency/i })).not.toBeInTheDocument();
  });

  /**
   * A caught fee-fetch failure used to be a bare console.error. `paymentFees`
   * stayed empty, the save path's `if (paymentFees.length > 0)` skipped the fee
   * write entirely, and the operator was told the type had been updated
   * successfully while never learning handling fees existed.
   */
  it('says so when handling fees could not be loaded, instead of saving silently without them', async () => {
    mocks.getOrganizationTypePaymentFees.mockRejectedValue(new Error('500'));
    mocks.updateOrganizationType.mockResolvedValue(type);

    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Sailing Club')).toBeInTheDocument());

    expect(screen.getByText(/Handling fees could not be loaded/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Update Organisation Type/i }));

    await waitFor(() => expect(mocks.showSuccess).toHaveBeenCalled());
    expect(mocks.showSuccess.mock.calls[0][0]).toMatch(/were not saved/i);
    expect(mocks.setOrganizationTypePaymentFees).not.toHaveBeenCalled();
  });

  it('does not strand the page on a spinner when the type cannot be loaded', async () => {
    mocks.getOrganizationTypeById.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/This organisation type could not be loaded/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });
});
