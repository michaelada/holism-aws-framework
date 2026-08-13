import { StripeConnectService, EMPTY_CONNECT_STATE } from '../stripe-connect.service';
import { db } from '../../database/pool';
import { ValidationError, NotFoundError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;
const ORG = 'org-1';
const CONFIG = { secretKey: 'sk_test_x', webhookSecret: 'whsec_x' };

const stripeClient = () => ({
  accounts: {
    create: jest.fn().mockResolvedValue({ id: 'acct_new' }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'acct_1',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [] },
    }),
  },
  accountLinks: {
    create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/x' }),
  },
});

/** Answers the settings read, and swallows the writes. */
const withStoredState = (connect: Record<string, unknown> | null) => {
  mockDb.query.mockImplementation((sql: string) => {
    const text = String(sql);
    if (text.includes("settings->'stripeConnect' AS connect")) {
      return Promise.resolve({ rows: [{ connect }], rowCount: 1 } as any);
    }
    if (text.includes('FROM organizations WHERE id')) {
      return Promise.resolve({
        rows: [{ display_name: 'Killiney HPC', currency: 'EUR', contact_email: 'a@b.ie' }],
        rowCount: 1,
      } as any);
    }
    return Promise.resolve({ rows: [], rowCount: 0 } as any);
  });
};

describe('StripeConnectService', () => {
  let client: ReturnType<typeof stripeClient>;
  let service: StripeConnectService;

  beforeEach(() => {
    mockDb.query.mockReset();
    client = stripeClient();
    service = new StripeConnectService(CONFIG, client as any);
    withStoredState(null);
  });

  describe('getState', () => {
    it('reports a club that has not started as unconnected', async () => {
      await expect(service.getState(ORG)).resolves.toEqual(EMPTY_CONNECT_STATE);
    });

    it('fills in defaults for a partially stored state', async () => {
      // An older record written before a flag existed must not read as
      // undefined and be treated as truthy anywhere downstream.
      withStoredState({ accountId: 'acct_1' });

      const state = await service.getState(ORG);
      expect(state).toMatchObject({ accountId: 'acct_1', chargesEnabled: false });
    });

    it('reports an unknown organisation as not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await expect(service.getState(ORG)).rejects.toThrow(NotFoundError);
    });
  });

  describe('createOnboardingLink', () => {
    it('creates the connected account on first use', async () => {
      const result = await service.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh');

      expect(client.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { organisationId: ORG } })
      );
      expect(result.accountId).toBe('acct_new');
    });

    /**
     * An account created at Stripe but not recorded here is orphaned: invisible
     * to us, and the next attempt would create a second one for the same club.
     */
    it('records the new account id immediately', async () => {
      await service.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh');

      const write = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes("'{stripeConnect}'")
      );
      expect(String(write?.[1]?.[1])).toContain('acct_new');
    });

    it('reuses the existing account rather than creating a second', async () => {
      withStoredState({ accountId: 'acct_1' });

      const result = await service.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh');

      expect(client.accounts.create).not.toHaveBeenCalled();
      expect(result.accountId).toBe('acct_1');
    });

    it('mints a fresh link every time rather than storing one', async () => {
      // Stripe's account links are single-use and short-lived, so a cached link
      // is an expired link by the time anyone clicks it.
      withStoredState({ accountId: 'acct_1' });

      await service.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh');
      await service.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh');

      expect(client.accountLinks.create).toHaveBeenCalledTimes(2);
    });

    it('refuses when the platform has no Stripe configured', async () => {
      const unconfigured = new StripeConnectService({ secretKey: '', webhookSecret: '' });
      await expect(
        unconfigured.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh')
      ).rejects.toThrow(ValidationError);
    });

    it('reports a Stripe failure as a readable refusal', async () => {
      withStoredState({ accountId: 'acct_1' });
      client.accountLinks.create.mockRejectedValue(new Error('rate limited'));

      await expect(
        service.createOnboardingLink(ORG, 'https://x/return', 'https://x/refresh')
      ).rejects.toThrow(/Could not start Stripe onboarding/);
    });
  });

  describe('refreshState', () => {
    it('stores what Stripe reports', async () => {
      withStoredState({ accountId: 'acct_1' });

      const state = await service.refreshState(ORG);

      expect(state).toMatchObject({
        accountId: 'acct_1',
        chargesEnabled: true,
        detailsSubmitted: true,
      });
    });

    it('surfaces what Stripe is still waiting for', async () => {
      withStoredState({ accountId: 'acct_1' });
      client.accounts.retrieve.mockResolvedValue({
        id: 'acct_1',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: {
          currently_due: ['individual.verification.document'],
          eventually_due: ['company.tax_id'],
        },
      });

      const state = await service.refreshState(ORG);

      expect(state.requirementsDue).toEqual(['individual.verification.document']);
      // `eventually_due` is excluded: showing paperwork a club does not need yet
      // makes onboarding look unfinished when it is not.
      expect(state.requirementsDue).not.toContain('company.tax_id');
    });

    it('does not call Stripe for a club that has not started', async () => {
      const state = await service.refreshState(ORG);

      expect(client.accounts.retrieve).not.toHaveBeenCalled();
      expect(state.accountId).toBeNull();
    });

    it('keeps the stored state when Stripe cannot be reached', async () => {
      // Stale beats blank — failing the whole settings screen over a Stripe blip
      // would be worse than showing what we last knew.
      withStoredState({ accountId: 'acct_1', chargesEnabled: true });
      client.accounts.retrieve.mockRejectedValue(new Error('network'));

      const state = await service.refreshState(ORG);
      expect(state).toMatchObject({ accountId: 'acct_1', chargesEnabled: true });
    });
  });

  describe('persistence', () => {
    /**
     * `paymentSettings` is rebuilt from its own defaults on every save, so
     * anything stored in there that its sanitiser does not know about is wiped.
     * Keeping Connect state in its own key is what stops an unrelated settings
     * change severing a club's ability to take money.
     */
    it('writes only the stripeConnect key, leaving other settings alone', async () => {
      withStoredState({ accountId: 'acct_1' });
      await service.refreshState(ORG);

      const write = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes("'{stripeConnect}'")
      );
      expect(String(write?.[0])).toContain('jsonb_set');
      expect(String(write?.[0])).not.toContain('paymentSettings');
    });

    it('finds the organisation an account belongs to', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: ORG }], rowCount: 1 } as any);

      await expect(service.organisationIdForAccount('acct_1')).resolves.toBe(ORG);
    });

    it('returns null for an account this deployment does not know', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await expect(service.organisationIdForAccount('acct_other')).resolves.toBeNull();
    });
  });

  describe('isConfigured', () => {
    it('is false when the platform has no secret key', () => {
      expect(new StripeConnectService({ secretKey: '', webhookSecret: '' }).isConfigured()).toBe(
        false
      );
      expect(service.isConfigured()).toBe(true);
    });
  });
});
