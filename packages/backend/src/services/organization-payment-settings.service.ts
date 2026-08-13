import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Payment settings for an organisation.
 *
 * Stored inside the organisations.settings JSONB column under the
 * `paymentSettings` key, alongside the organisation's other settings
 * (address, contact details, etc.). This keeps payment configuration with
 * the rest of the organisation record without requiring a dedicated table.
 *
 * **No Stripe credentials live here.** Under Connect destination charges the
 * platform's key comes from the environment and the organisation's only Stripe
 * state is its connected account id in `settings.stripeConnect`. The
 * `stripeEnabled` / `stripePublishableKey` / `stripeSecretKey` /
 * `stripeWebhookSecret` fields that used to be in this contract belonged to the
 * older direct-charge model, were never read by any payment code path, and were
 * removed by migration 1709000000014.
 *
 * `acceptedPaymentMethods` went the same way. Which methods an organisation may
 * offer is decided by the `payment_methods` rows the super admin enables for it
 * and the fees configured on its organisation type — which is what checkout
 * actually joins against. A second, self-declared list here answered the same
 * question with no authority behind it, and nothing ever read it.
 */
export interface PaymentSettings {
  helixPayEnabled: boolean;
  helixPayApiKey: string;
  chequePaymentsEnabled: boolean;
  chequePaymentInstructions: string;
}

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  helixPayEnabled: false,
  helixPayApiKey: '',
  chequePaymentsEnabled: false,
  chequePaymentInstructions: '',
};

/**
 * Whitelist incoming data to the known payment settings fields so arbitrary
 * client-supplied keys are never persisted into the settings JSONB.
 */
function sanitizePaymentSettings(data: any): Partial<PaymentSettings> {
  const out: Partial<PaymentSettings> = {};
  if (!data || typeof data !== 'object') {
    return out;
  }

  if (typeof data.helixPayEnabled === 'boolean') out.helixPayEnabled = data.helixPayEnabled;
  if (typeof data.helixPayApiKey === 'string') out.helixPayApiKey = data.helixPayApiKey;
  if (typeof data.chequePaymentsEnabled === 'boolean') out.chequePaymentsEnabled = data.chequePaymentsEnabled;
  if (typeof data.chequePaymentInstructions === 'string') out.chequePaymentInstructions = data.chequePaymentInstructions;

  return out;
}

export class OrganizationPaymentSettingsService {
  /**
   * Get the payment settings for an organisation, merged onto sensible
   * defaults so callers always receive a fully-populated object.
   */
  async getPaymentSettings(organizationId: string): Promise<PaymentSettings> {
    const result = await db.query(
      'SELECT settings FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const settings = result.rows[0].settings || {};
    return { ...DEFAULT_PAYMENT_SETTINGS, ...(settings.paymentSettings || {}) };
  }

  /**
   * Update the payment settings for an organisation.
   *
   * Uses jsonb_set so only the `paymentSettings` key is replaced — the rest
   * of the organisation's settings (address, contact info, etc.) are left
   * untouched. The frontend sends the full settings object, so the stored
   * value is replaced wholesale (merged onto defaults).
   */
  async updatePaymentSettings(
    organizationId: string,
    data: Partial<PaymentSettings>
  ): Promise<PaymentSettings> {
    const merged: PaymentSettings = {
      ...DEFAULT_PAYMENT_SETTINGS,
      ...sanitizePaymentSettings(data),
    };

    const result = await db.query(
      `UPDATE organizations
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{paymentSettings}', $1::jsonb, true),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [JSON.stringify(merged), organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    logger.info(`Payment settings updated for organization ${organizationId}`);
    return merged;
  }
}

export const organizationPaymentSettingsService = new OrganizationPaymentSettingsService();
