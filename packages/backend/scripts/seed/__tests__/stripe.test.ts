import {
  StripeSeeder,
  connectSettings,
  isTestKey,
  stripeUnavailableReason,
} from '../stripe';

/**
 * The Stripe side of the seed.
 *
 * Two things here are worth testing and one of them is worth testing hard. The
 * shape of the account matters — the wrong fields leave a club that looks
 * connected and cannot take a payment. **The refusal to run against a live key
 * matters more**: this module creates connected accounts from a script whose
 * sibling command deletes every row in the database, and the only thing
 * standing between that and somebody's real platform is one string check.
 */

const TEST_KEY = { secretKey: 'sk_test_abc123' };

/** A stand-in for the Stripe client, so no network call is made. */
const stripeClient = (over: Record<string, any> = {}) => ({
  accounts: {
    create: jest.fn().mockResolvedValue({
      id: 'acct_seeded',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    }),
    retrieve: jest.fn(),
    del: jest.fn().mockResolvedValue({ deleted: true }),
    list: jest.fn(),
    ...over,
  },
});

describe('stripeUnavailableReason', () => {
  it('allows a test key', () => {
    expect(stripeUnavailableReason(TEST_KEY)).toBeNull();
    expect(stripeUnavailableReason({ secretKey: 'rk_test_restricted' })).toBeNull();
  });

  it('refuses a live key, which is the whole point of the guard', () => {
    const reason = stripeUnavailableReason({ secretKey: 'sk_live_realmoney' });

    expect(reason).toMatch(/not a test key/i);
  });

  it('refuses anything it does not recognise rather than assuming it is safe', () => {
    expect(stripeUnavailableReason({ secretKey: 'whsec_something' })).toMatch(/not a test key/i);
  });

  it('reports a missing key as a skip, not a fault', () => {
    // A database full of clubs is still useful without Stripe; refusing to seed
    // at all because a card key is absent would not be.
    expect(stripeUnavailableReason({ secretKey: '' })).toMatch(/not set/i);
  });
});

describe('isTestKey', () => {
  it.each([
    ['sk_test_x', true],
    ['rk_test_x', true],
    ['sk_live_x', false],
    ['rk_live_x', false],
    ['', false],
  ])('%s → %s', (key, expected) => {
    expect(isTestKey(key)).toBe(expected);
  });
});

describe('StripeSeeder', () => {
  it('will not be constructed against a live key', () => {
    expect(() => new StripeSeeder({ secretKey: 'sk_live_realmoney' })).toThrow(/not a test key/i);
  });

  describe('createTestAccount', () => {
    const create = async (over: Record<string, any> = {}) => {
      const client = stripeClient(over);
      const seeder = new StripeSeeder(TEST_KEY, client as any);
      const account = await seeder.createTestAccount({
        displayName: 'Meath Hunt Pony Club',
        email: 'secretary@meathhunt.test',
        seedTag: 'demo-tag',
      });
      return { client, account, params: client.accounts.create.mock.calls[0]?.[0] };
    };

    it('creates a custom account, because a standard one needs a human', async () => {
      // Standard accounts stay `charges_enabled: false` until somebody clicks
      // through Stripe's hosted onboarding, which a seed cannot do.
      const { params } = await create();

      expect(params.type).toBe('custom');
    });

    it('asks for the capabilities a destination charge needs', async () => {
      const { params } = await create();

      expect(params.capabilities.card_payments.requested).toBe(true);
      expect(params.capabilities.transfers.requested).toBe(true);
    });

    it('supplies a bank account and a state', async () => {
      /*
       * The two requirements that otherwise leave an account complete-looking
       * and permanently `charges_enabled: false` — found the hard way, since
       * Stripe reports them only in `requirements.past_due`.
       */
      expect((await create()).params.external_account.object).toBe('bank_account');
      expect((await create()).params.individual.address.state).toBeTruthy();
    });

    it('describes the business rather than giving a URL', async () => {
      // Stripe validates the URL against real domains and rejects the seed's
      // `.test` addresses — and `example.com` — with a bare "Not a valid URL".
      const { params } = await create();

      expect(params.business_profile.product_description).toBeTruthy();
      expect(params.business_profile.url).toBeUndefined();
    });

    it('tags the account so the purge can prove it created it', async () => {
      const { params } = await create();

      expect(params.metadata.seededBy).toBe('demo-tag');
    });

    it('reports what Stripe settled on', async () => {
      const { account } = await create();

      expect(account).toEqual({
        accountId: 'acct_seeded',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });
    });
  });

  describe('reconcile', () => {
    it('re-reads only the accounts that were not yet enabled', async () => {
      const retrieve = jest.fn().mockResolvedValue({
        id: 'acct_slow',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      });
      const seeder = new StripeSeeder(TEST_KEY, stripeClient({ retrieve }) as any);

      const settled = await seeder.reconcile(
        [
          { accountId: 'acct_ready', chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true },
          { accountId: 'acct_slow', chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: true },
        ],
        [0]
      );

      expect(retrieve).toHaveBeenCalledTimes(1);
      expect(retrieve).toHaveBeenCalledWith('acct_slow');
      expect(settled[1].chargesEnabled).toBe(true);
    });

    it('does nothing at all when every account is already enabled', async () => {
      const retrieve = jest.fn();
      const seeder = new StripeSeeder(TEST_KEY, stripeClient({ retrieve }) as any);

      await seeder.reconcile(
        [{ accountId: 'acct_ready', chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true }],
        [0, 0]
      );

      expect(retrieve).not.toHaveBeenCalled();
    });

    it('gives up rather than waiting for ever', async () => {
      // Verification can stay pending for minutes. The seed records what it
      // found and says so; it must not block on Stripe.
      const retrieve = jest.fn().mockResolvedValue({
        id: 'acct_stuck',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
      });
      const seeder = new StripeSeeder(TEST_KEY, stripeClient({ retrieve }) as any);

      const settled = await seeder.reconcile(
        [{ accountId: 'acct_stuck', chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: true }],
        [0, 0]
      );

      expect(retrieve).toHaveBeenCalledTimes(2);
      expect(settled[0].chargesEnabled).toBe(false);
    });
  });

  describe('purgeSeededAccounts', () => {
    /** `accounts.list` is an async iterable in the Stripe SDK. */
    const listing = (accounts: any[]) => ({
      list: jest.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const account of accounts) yield account;
        },
      }),
    });

    it('deletes only what it can prove it created', async () => {
      // The important property. A platform's own test accounts, and any created
      // by something else, must survive a `--reset`.
      const client = stripeClient(
        listing([
          { id: 'acct_mine', metadata: { seededBy: 'demo-tag' } },
          { id: 'acct_someone_elses', metadata: { seededBy: 'another-tool' } },
          { id: 'acct_untagged', metadata: {} },
        ])
      );
      const seeder = new StripeSeeder(TEST_KEY, client as any);

      const result = await seeder.purgeSeededAccounts('demo-tag');

      expect(client.accounts.del).toHaveBeenCalledTimes(1);
      expect(client.accounts.del).toHaveBeenCalledWith('acct_mine');
      expect(result).toEqual({ deleted: 1, failed: 0 });
    });

    it('counts a refusal rather than aborting the reset', async () => {
      const client = stripeClient({
        ...listing([{ id: 'acct_mine', metadata: { seededBy: 'demo-tag' } }]),
        del: jest.fn().mockRejectedValue(new Error('account has a balance')),
      });
      const seeder = new StripeSeeder(TEST_KEY, client as any);

      await expect(seeder.purgeSeededAccounts('demo-tag')).resolves.toEqual({
        deleted: 0,
        failed: 1,
      });
    });
  });
});

describe('connectSettings', () => {
  it('writes the shape the application reads back', () => {
    /*
     * Must match `EMPTY_CONNECT_STATE` in `stripe-connect.service`. A club whose
     * settings are shaped differently looks connected on the settings screen and
     * still refuses to take a payment.
     */
    const settings = connectSettings(
      {
        accountId: 'acct_seeded',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      },
      new Date('2026-08-17T09:00:00.000Z')
    );

    expect(settings).toEqual({
      accountId: 'acct_seeded',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirementsDue: [],
      updatedAt: '2026-08-17T09:00:00.000Z',
    });
  });
});
