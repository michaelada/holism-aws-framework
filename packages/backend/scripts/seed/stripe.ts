import Stripe from 'stripe';

/**
 * Stripe side of the seed: a **test-mode connected account per club**.
 *
 * ## Why this exists
 *
 * Checkout makes destination charges — the charge is on the platform's account
 * and the club's share is transferred to `settings.stripeConnect.accountId`. A
 * club without one cannot take a card payment at all, so until now nothing in a
 * seeded database could exercise the card path end to end: no authorisation, no
 * capture, no reversal, no webhook.
 *
 * ## What it does not do
 *
 * It does **not** copy anything from a production platform. Live and test are
 * separate universes in Stripe: a live `acct_...` has no test counterpart, and
 * a connected account's own test keys belong to that business and are visible
 * only to them. There is no API, transformation or lookup that crosses the
 * boundary, and holding another organisation's live credentials in a dev
 * environment is a hazard in its own right.
 *
 * None of that is needed. This codebase stores **no per-organisation Stripe
 * keys** — only an account id (see `docs/REMOVE_PER_ORG_STRIPE_KEYS.md`) — so a
 * freshly created test account is a complete substitute for a real one.
 *
 * ## Custom rather than Standard
 *
 * `stripe-connect.service` creates `standard` accounts, which is right for
 * production: the club owns the account and completes Stripe's onboarding
 * itself. That is useless in a seed, because a Standard account stays
 * `charges_enabled: false` until a human clicks through a hosted form.
 *
 * These are `custom` accounts with capabilities requested and the test
 * acceptance fields pre-filled, which Stripe enables immediately in test mode.
 * The account id is the only thing the application reads, so the difference in
 * type is invisible to everything downstream.
 */

/** Pinned to match `src/services/stripe-connect.service.ts`. */
const STRIPE_API_VERSION = '2025-10-29.clover' as Stripe.LatestApiVersion;

export interface StripeSeedConfig {
  secretKey: string;
}

export interface SeededConnectAccount {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export const stripeConfigFromEnv = (): StripeSeedConfig => ({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
});

/**
 * Whether a key is a test key.
 *
 * The guard the whole module hangs on. Restricted keys (`rk_test_`) are
 * accepted because they are equally test-mode; anything else is not assumed to
 * be safe.
 */
export const isTestKey = (secretKey: string): boolean =>
  secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_');

/**
 * Why the seed will not create Stripe accounts, or null when it will.
 *
 * Returned rather than thrown so the caller can carry on seeding everything
 * else. A database full of clubs and events is still useful without Stripe;
 * refusing to seed at all because a card key is missing would not be.
 */
export const stripeUnavailableReason = (config: StripeSeedConfig): string | null => {
  if (!config.secretKey) {
    return 'STRIPE_SECRET_KEY is not set';
  }
  if (!isTestKey(config.secretKey)) {
    /*
     * The important refusal. A live key here would create **real connected
     * accounts on a real platform** from a script whose sibling command is
     * `--reset`. There is deliberately no override flag.
     */
    return 'STRIPE_SECRET_KEY is not a test key — refusing to create live connected accounts';
  }
  return null;
};

export class StripeSeeder {
  private readonly client: Stripe;

  constructor(config: StripeSeedConfig, client?: Stripe) {
    const reason = stripeUnavailableReason(config);
    if (reason) throw new Error(reason);

    this.client =
      client ??
      // The same pinned version `stripe-connect.service` uses. Two components
      // talking to Stripe on different versions is a bug waiting for a field to
      // change shape underneath one of them.
      new Stripe(config.secretKey, { apiVersion: STRIPE_API_VERSION });
  }

  /**
   * A connected account a seeded club can actually take money into.
   *
   * `business_type: 'individual'` with the documented test values is what makes
   * Stripe enable the capabilities without an onboarding round trip. The
   * address, date of birth and ID number are Stripe's own test fixtures, not
   * anybody's data.
   */
  async createTestAccount(club: {
    displayName: string;
    email: string;
    country?: string;
    /** Recorded on the account so a seeded one is identifiable in the dashboard. */
    seedTag: string;
  }): Promise<SeededConnectAccount> {
    const account = await this.client.accounts.create({
      type: 'custom',
      country: club.country ?? 'IE',
      email: club.email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: club.displayName,
        // 7941 — "Commercial Sports, Athletic Fields, Sports Clubs".
        mcc: '7941',
        /*
         * A description rather than a URL.
         *
         * Stripe requires one of the two, and it validates the URL against real
         * domains — both the club's own `.test` address and `example.com` come
         * back as a bare "Not a valid URL", which is a confusing way to be told
         * that the seed's fake domains are fine everywhere except here.
         */
        product_description: 'Pony club memberships, event entries and facility hire.',
      },
      individual: {
        first_name: 'Test',
        last_name: 'Treasurer',
        email: club.email,
        phone: '+353871234567',
        // Stripe's documented test date of birth and identification number.
        dob: { day: 1, month: 1, year: 1980 },
        id_number: '000000000',
        address: {
          // Stripe's magic test value: an address that verifies immediately.
          line1: 'address_full_match',
          city: 'Dublin',
          // Required, and its absence is one of the two things that leaves an
          // otherwise complete account stuck with `charges_enabled: false`.
          state: 'Co. Dublin',
          postal_code: 'D02 AF30',
          country: club.country ?? 'IE',
        },
      },
      tos_acceptance: {
        // A fixed timestamp and address, because this is a fixture rather than
        // a person agreeing to anything.
        date: Math.floor(Date.parse('2020-01-01T00:00:00Z') / 1000),
        ip: '127.0.0.1',
      },
      /*
       * The other requirement. Without somewhere to pay out to, the account
       * stays `past_due` on `external_account` and never enables charges.
       * This is Stripe's documented test IBAN, not a real bank account.
       */
      external_account: {
        object: 'bank_account',
        country: club.country ?? 'IE',
        currency: 'eur',
        account_number: 'IE29AIBK93115212345678',
      },
      metadata: { seededBy: club.seedTag },
    });

    return {
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    };
  }

  /**
   * Re-read the accounts Stripe had not finished verifying.
   *
   * Verification is asynchronous and uneven: most accounts are enabled by the
   * time `create` returns, and one in a batch will sit at
   * `card_payments: pending` for a while with nothing outstanding. A seed that
   * recorded that first answer would leave a club permanently marked unable to
   * take payments, because nothing re-reads it until somebody opens the club's
   * payment settings.
   *
   * Done as one pass over the whole batch **after** every account exists, so
   * the waiting happens once rather than per club. Bounded, and never fatal:
   * whatever has not settled is recorded as it stands, and the caller says so.
   */
  async reconcile(
    accounts: SeededConnectAccount[],
    /*
     * Up to ~45 seconds in total, backing off.
     *
     * It was [2, 4, 8], and one club in four was still `pending` when that ran
     * out — three resets running, each needing the account looked up by hand
     * afterwards. Stripe usually settles within a few seconds and occasionally
     * takes half a minute; waiting the extra half-minute once, on a command
     * that already takes longer than that, is cheaper than a club that cannot
     * take a card payment until somebody notices.
     */
    waits: number[] = [2000, 3000, 5000, 8000, 12000, 15000]
  ): Promise<SeededConnectAccount[]> {
    const settled = [...accounts];

    for (const wait of waits) {
      const pending = settled.filter((account) => !account.chargesEnabled);
      if (pending.length === 0) break;

      await new Promise((resolve) => setTimeout(resolve, wait));

      for (const account of pending) {
        const current = await this.client.accounts.retrieve(account.accountId);
        account.chargesEnabled = Boolean(current.charges_enabled);
        account.payoutsEnabled = Boolean(current.payouts_enabled);
        account.detailsSubmitted = Boolean(current.details_submitted);
      }
    }

    return settled;
  }

  /**
   * Remove the connected accounts a previous run created.
   *
   * Part of `--reset`, and matched on the same `seededBy` metadata the Keycloak
   * purge uses: it deletes accounts it can prove it created rather than every
   * account on the platform. Without this, repeated seeding leaves a growing
   * pile of abandoned test accounts behind.
   *
   * Failures are collected rather than raised. A test account that Stripe
   * refuses to delete — one with a balance, usually — must not stop a reset.
   */
  async purgeSeededAccounts(seedTag: string): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for await (const account of this.client.accounts.list({ limit: 100 })) {
      if (account.metadata?.seededBy !== seedTag) continue;

      try {
        await this.client.accounts.del(account.id);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }

    return { deleted, failed };
  }
}

/**
 * The shape written to `organizations.settings.stripeConnect`.
 *
 * Must match what `checkout.service` and `stripe-connect.service` read, or a
 * seeded club looks connected in the settings screen and still refuses to take
 * a payment.
 */
export const connectSettings = (account: SeededConnectAccount, now: Date) => ({
  accountId: account.accountId,
  chargesEnabled: account.chargesEnabled,
  payoutsEnabled: account.payoutsEnabled,
  detailsSubmitted: account.detailsSubmitted,
  // Present because `EMPTY_CONNECT_STATE` has it and the settings screen reads
  // it; a seeded account has nothing outstanding.
  requirementsDue: [],
  updatedAt: now.toISOString(),
});
