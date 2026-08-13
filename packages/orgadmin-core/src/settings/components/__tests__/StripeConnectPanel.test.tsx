import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StripeConnectPanel from '../StripeConnectPanel';
import * as useApiModule from '../../../hooks/useApi';
import { resolveTranslation } from '../../../test/i18nTestUtils';

vi.mock('../../../hooks/useApi');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

const label = (key: string, options?: Record<string, unknown>) =>
  resolveTranslation(key, options);

const state = (over: Record<string, unknown> = {}) => ({
  accountId: null,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirementsDue: [],
  updatedAt: null,
  platformConfigured: true,
  ...over,
});

describe('StripeConnectPanel', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockReset();
    mockExecute.mockResolvedValue(state());
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  it('tells a club that has not started that members cannot pay by card', async () => {
    render(<StripeConnectPanel />);

    expect(await screen.findByText(label('settings.stripeConnect.status.notStarted'))).toBeInTheDocument();
    expect(screen.getByText(label('settings.stripeConnect.notStartedBody'))).toBeInTheDocument();
  });

  /**
   * "Details submitted" is not "can take charges". A club that stops at
   * Stripe's last screen would otherwise believe it had finished.
   */
  it('does not call a club ready just because it submitted its details', async () => {
    mockExecute.mockResolvedValue(
      state({ accountId: 'acct_1', detailsSubmitted: true, chargesEnabled: false })
    );
    render(<StripeConnectPanel />);

    expect(await screen.findByText(label('settings.stripeConnect.status.incomplete'))).toBeInTheDocument();
    expect(
      screen.queryByText(label('settings.stripeConnect.status.ready'))
    ).not.toBeInTheDocument();
  });

  it('confirms a club that can take charges', async () => {
    mockExecute.mockResolvedValue(state({ accountId: 'acct_1', chargesEnabled: true }));
    render(<StripeConnectPanel />);

    expect(await screen.findByText(label('settings.stripeConnect.status.ready'))).toBeInTheDocument();
  });

  it("lists what Stripe is still waiting for, verbatim", async () => {
    // Stripe's own requirement identifiers — paraphrasing them would make them
    // impossible to match against Stripe's own screens.
    mockExecute.mockResolvedValue(
      state({ accountId: 'acct_1', requirementsDue: ['individual.verification.document'] })
    );
    render(<StripeConnectPanel />);

    expect(await screen.findByText('individual.verification.document')).toBeInTheDocument();
  });

  it('sends the administrator to Stripe', async () => {
    const user = userEvent.setup();
    mockExecute.mockImplementation((request: { method?: string }) =>
      request.method === 'POST'
        ? Promise.resolve({ url: 'https://connect.stripe.com/setup/x', accountId: 'acct_1' })
        : Promise.resolve(state())
    );
    render(<StripeConnectPanel />);

    await user.click(await screen.findByRole('button', { name: label('settings.stripeConnect.actions.start') }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/orgadmin/organisation/stripe-connect/onboarding-link',
        })
      )
    );
  });

  it('offers to continue rather than restart once an account exists', async () => {
    mockExecute.mockResolvedValue(state({ accountId: 'acct_1' }));
    render(<StripeConnectPanel />);

    expect(
      await screen.findByRole('button', { name: label('settings.stripeConnect.actions.continue') })
    ).toBeInTheDocument();
  });

  /** Nothing a club can do about this — it is the platform's own setup. */
  it('says when the platform itself has no Stripe configured, and offers nothing to click', async () => {
    mockExecute.mockResolvedValue(state({ platformConfigured: false }));
    render(<StripeConnectPanel />);

    expect(
      await screen.findByText(label('settings.stripeConnect.platformNotConfigured'))
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: label('settings.stripeConnect.actions.start') })
    ).toBeDisabled();
  });

  it('re-reads the status on request', async () => {
    const user = userEvent.setup();
    render(<StripeConnectPanel />);

    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: label('settings.stripeConnect.actions.refresh') }));

    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(2));
  });

  it('reports a failure to load', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render(<StripeConnectPanel />);

    expect(await screen.findByText('offline')).toBeInTheDocument();
  });
});
