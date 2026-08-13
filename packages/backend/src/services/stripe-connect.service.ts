import Stripe from 'stripe';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { stripeConfigFromEnv, StripePlatformConfig } from './payment-providers/stripe.provider';

/**
 * Stripe Connect onboarding — getting a club to the point where it can be paid.
 *
 * This is Stripe-specific on purpose and does **not** sit behind the
 * `PaymentProvider` abstraction. That contract is about taking a payment;
 * onboarding a connected account has no counterpart in a provider that has not
 * been implemented, and inventing a generic shape for one real implementation
 * would be a guess dressed as a design.
 *
 * ### Where the state lives, and why not in `paymentSettings`
 *
 * Under `organizations.settings.stripeConnect`, separate from
 * `settings.paymentSettings`. `updatePaymentSettings` rebuilds that object from
 * its own defaults on every save, so anything it does not know about is wiped —
 * the connected account id would be destroyed by an unrelated settings change,
 * severing the club's ability to take money with no obvious cause.
 *
 * It is also not user-editable configuration: it is state Stripe gave us.
 *
 * ### Why the status is cached
 *
 * `chargesEnabled` decides whether a club can sell. Asking Stripe on every page
 * load would put a network call in the path of every checkout, so the flags are
 * stored and refreshed — on demand from the settings screen, and automatically
 * by the `account.updated` webhook, which is how Stripe reports that onboarding
 * finished.
 */

export interface StripeConnectState {
  accountId: string | null;
  /** Whether Stripe will accept charges for this account yet. */
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** The club has finished Stripe's form; requirements may still be outstanding. */
  detailsSubmitted: boolean;
  /** What Stripe is still waiting for, shown so a club knows what to fix. */
  requirementsDue: string[];
  updatedAt: string | null;
}

export const EMPTY_CONNECT_STATE: StripeConnectState = {
  accountId: null,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirementsDue: [],
  updatedAt: null,
};

const STRIPE_API_VERSION = '2025-10-29.clover';

export class StripeConnectService {
  private readonly client: Stripe | null;

  constructor(
    config: StripePlatformConfig = stripeConfigFromEnv(),
    client?: Stripe
  ) {
    if (client) {
      this.client = client;
    } else if (config.secretKey) {
      this.client = new Stripe(config.secretKey, {
        apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      });
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** The stored state, without calling Stripe. */
  async getState(organisationId: string): Promise<StripeConnectState> {
    const result = await db.query(
      `SELECT settings->'stripeConnect' AS connect FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Organisation not found');
    }

    return { ...EMPTY_CONNECT_STATE, ...(result.rows[0].connect || {}) };
  }

  /**
   * A link that takes the club through Stripe's onboarding.
   *
   * Creates the connected account on first use. Account links are **single-use
   * and short-lived**, so one is minted per request rather than stored — a
   * cached link is an expired link by the time anyone clicks it.
   */
  async createOnboardingLink(
    organisationId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<{ url: string; accountId: string }> {
    if (!this.client) {
      throw new ValidationError('Stripe is not configured for this platform');
    }

    const state = await this.getState(organisationId);
    const accountId = state.accountId ?? (await this.createAccount(organisationId));

    try {
      const link = await this.client.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return { url: link.url, accountId };
    } catch (error) {
      logger.error('Failed to create a Stripe onboarding link:', error);
      throw new ValidationError('Could not start Stripe onboarding');
    }
  }

  /**
   * Create the connected account and record its id immediately.
   *
   * The write happens before anything else can fail. An account created at
   * Stripe but not recorded here is orphaned — invisible to us, and the next
   * attempt would create a second one for the same club.
   */
  private async createAccount(organisationId: string): Promise<string> {
    const organisation = await db.query(
      `SELECT display_name, currency, settings->>'contactEmail' AS contact_email
       FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (organisation.rows.length === 0) {
      throw new NotFoundError('Organisation not found');
    }

    const row = organisation.rows[0];

    try {
      const account = await this.client!.accounts.create({
        type: 'standard',
        email: row.contact_email || undefined,
        business_profile: { name: row.display_name },
        metadata: { organisationId },
      });

      await this.persist(organisationId, {
        ...EMPTY_CONNECT_STATE,
        accountId: account.id,
        updatedAt: new Date().toISOString(),
      });

      return account.id;
    } catch (error) {
      logger.error('Failed to create a Stripe connected account:', error);
      throw new ValidationError('Could not create a Stripe account for this organisation');
    }
  }

  /**
   * Ask Stripe for the account's current state and store it.
   *
   * Called from the settings screen and from the `account.updated` webhook.
   * Returns the stored state unchanged when there is no account yet — a club
   * that has not started onboarding is not an error.
   */
  async refreshState(organisationId: string): Promise<StripeConnectState> {
    const state = await this.getState(organisationId);
    if (!state.accountId || !this.client) return state;

    try {
      const account = await this.client.accounts.retrieve(state.accountId);
      return this.persistFromAccount(organisationId, account);
    } catch (error) {
      logger.error('Failed to refresh a Stripe connected account:', error);
      // The stored state is stale rather than wrong; failing the whole screen
      // over a Stripe blip would be worse than showing what we last knew.
      return state;
    }
  }

  /** Update the stored state from an account object Stripe sent us. */
  async persistFromAccount(
    organisationId: string,
    account: Stripe.Account
  ): Promise<StripeConnectState> {
    const next: StripeConnectState = {
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      /*
       * `currently_due` is what Stripe is waiting for right now. `eventually_due`
       * is deliberately excluded — showing a club paperwork it does not need yet
       * makes onboarding look unfinished when it is not.
       */
      requirementsDue: account.requirements?.currently_due ?? [],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(organisationId, next);
    return next;
  }

  /** Find the organisation a connected account belongs to, for webhooks. */
  async organisationIdForAccount(accountId: string): Promise<string | null> {
    const result = await db.query(
      `SELECT id FROM organizations WHERE settings->'stripeConnect'->>'accountId' = $1`,
      [accountId]
    );
    return result.rows[0]?.id ?? null;
  }

  /**
   * Write the Connect state.
   *
   * `jsonb_set` with `true` for create-missing touches only the `stripeConnect`
   * key, so nothing else in `settings` — branding, payment settings, email
   * templates — is disturbed. Reading, merging and writing the whole object
   * would lose any change made concurrently by another screen.
   */
  private async persist(organisationId: string, state: StripeConnectState): Promise<void> {
    await db.query(
      `UPDATE organizations
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{stripeConnect}', $2::jsonb, true),
           updated_at = NOW()
       WHERE id = $1`,
      [organisationId, JSON.stringify(state)]
    );
  }
}

export const stripeConnectService = new StripeConnectService();
