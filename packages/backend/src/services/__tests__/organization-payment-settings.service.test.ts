import { OrganizationPaymentSettingsService } from '../organization-payment-settings.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * The interesting behaviour here is what the service refuses to keep.
 *
 * Stripe credentials are no longer part of an organisation's payment settings —
 * under Connect destination charges the platform holds the only key, from the
 * environment, and the organisation holds only a connected account id in
 * `settings.stripeConnect`. Organisations onboarded under the older
 * direct-charge model may still have `stripeSecretKey` and friends stored, so
 * both directions matter: a client cannot put them back, and a save clears any
 * that migration 1709000000014 has not already removed.
 */
describe('OrganizationPaymentSettingsService', () => {
  let service: OrganizationPaymentSettingsService;
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG_ID = 'org-1';

  const STRIPE_KEYS = [
    'stripeEnabled',
    'stripePublishableKey',
    'stripeSecretKey',
    'stripeWebhookSecret',
  ];

  /** The object the service wrote, parsed out of the jsonb_set parameter. */
  const persisted = () => {
    const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
    return JSON.parse(params[0]);
  };

  beforeEach(() => {
    service = new OrganizationPaymentSettingsService();
    jest.clearAllMocks();
    mockDb.query = jest.fn().mockResolvedValue({ rows: [{ id: ORG_ID }] });
  });

  describe('getPaymentSettings', () => {
    it('returns the defaults when the organisation has no settings at all', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ settings: null }] });

      const result = await service.getPaymentSettings(ORG_ID);

      expect(result).toEqual({
        helixPayEnabled: false,
        helixPayApiKey: '',
        chequePaymentsEnabled: false,
        chequePaymentInstructions: '',
      });
    });

    it('merges stored settings over the defaults', async () => {
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [{ settings: { paymentSettings: { helixPayEnabled: true, helixPayApiKey: 'hp_1' } } }],
      });

      const result = await service.getPaymentSettings(ORG_ID);

      expect(result.helixPayEnabled).toBe(true);
      expect(result.helixPayApiKey).toBe('hp_1');
      expect(result.chequePaymentsEnabled).toBe(false);
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(service.getPaymentSettings(ORG_ID)).rejects.toThrow('Organization not found');
    });
  });

  describe('updatePaymentSettings', () => {
    it('persists the known payment fields', async () => {
      await service.updatePaymentSettings(ORG_ID, {
        helixPayEnabled: true,
        helixPayApiKey: 'hp_1',
        chequePaymentsEnabled: true,
        chequePaymentInstructions: 'Payable to Test Org',
      });

      expect(persisted()).toEqual({
        helixPayEnabled: true,
        helixPayApiKey: 'hp_1',
        chequePaymentsEnabled: true,
        chequePaymentInstructions: 'Payable to Test Org',
      });
    });

    it('does not persist Stripe credentials supplied by a client', async () => {
      await service.updatePaymentSettings(ORG_ID, {
        chequePaymentsEnabled: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          stripeEnabled: true,
          stripePublishableKey: 'pk_live_1',
          stripeSecretKey: 'sk_live_1',
          stripeWebhookSecret: 'whsec_1',
        } as any),
      });

      const stored = persisted();
      STRIPE_KEYS.forEach(key => expect(stored).not.toHaveProperty(key));
    });

    it('clears legacy Stripe credentials already stored against the organisation', async () => {
      // The whole paymentSettings object is rebuilt from the defaults and the
      // sanitiser, so a save is itself a cleanup for any row the migration missed.
      await service.updatePaymentSettings(ORG_ID, { chequePaymentsEnabled: true });

      const stored = persisted();
      expect(Object.keys(stored).filter(key => key.startsWith('stripe'))).toEqual([]);

      const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
      // jsonb_set on the one key, so stripeConnect and branding survive the write
      expect(sql).toContain("jsonb_set(COALESCE(settings, '{}'::jsonb), '{paymentSettings}'");
    });

    it('ignores unknown keys rather than persisting them', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.updatePaymentSettings(ORG_ID, { evil: 'value' } as any);

      expect(persisted()).not.toHaveProperty('evil');
    });

    it('throws when the organisation does not exist', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(
        service.updatePaymentSettings(ORG_ID, { chequePaymentsEnabled: true })
      ).rejects.toThrow('Organization not found');
    });
  });
});
