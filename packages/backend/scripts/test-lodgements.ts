/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import path from 'path';
import Stripe from 'stripe';
import { db } from '../src/database/pool';

/**
 * Put money through a club's Stripe test account so the Lodgements screens have
 * something to show.
 *
 * ## The problem this solves
 *
 * Lodgements are **payouts on a club's connected account** — money Stripe has
 * actually sent to the bank — read live from Stripe rather than from our own
 * tables. In a fresh test environment there are none, and there is no obvious
 * way to make one: a connected account starts with a zero balance, test charges
 * land in `pending`, and the seeded accounts pay out daily with a **seven-day**
 * delay. So the screen is empty and stays empty.
 *
 * ## What actually works, in order
 *
 * 1. **Fund the platform's available balance.** Stripe's `pm_card_bypassPending`
 *    (the `4000 0000 0000 0077` card) settles straight to *available* instead of
 *    waiting out the delay. Nothing can move until this exists: a transfer from
 *    an empty platform balance is refused, and the refusal names this card.
 * 2. **Charge the club the way the application does** — a destination charge
 *    with `transfer_data.destination` and an `application_fee_amount`. The
 *    club's share lands in its own available balance, less the platform fee,
 *    which is exactly the arithmetic the lodgement detail explains.
 * 3. **Pay it out.**
 *
 * ## The one thing a manual payout cannot do
 *
 * Stripe refuses to itemise it: `balanceTransactions.list({ payout })` answers
 * *"Balance transaction history can only be filtered on automatic transfers, not
 * manual"*. So a payout created here — or from the dashboard — appears on the
 * **list** with its amount, status and destination, and its **detail** cannot be
 * broken down. That is a fact about hand-made payouts, not a fault in the
 * screen, and the detail page now says so rather than claiming Stripe was
 * unreachable.
 *
 * To exercise the detail page, leave the money in the balance and let Stripe's
 * own schedule pay it out (`--fund-only`). The automatic payout that follows
 * *is* itemisable. It arrives on the account's schedule, so this is a wait
 * rather than a step.
 *
 * ## Use
 *
 * ```bash
 * npm run test:lodgements -w @itsplainsailing/backend -- --club=khpc
 * npm run test:lodgements -w @itsplainsailing/backend -- --club=khpc --amount=250 --charges=3
 * npm run test:lodgements -w @itsplainsailing/backend -- --club=khpc --fund-only
 * ```
 *
 * Test keys only — it refuses to run against a live one.
 */

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const STRIPE_API_VERSION = '2024-06-20' as any;

interface Options {
  club: string;
  /** Major units, per charge. */
  amount: number;
  charges: number;
  /** Leave the money in the balance for Stripe's own payout run. */
  fundOnly: boolean;
}

function parseArguments(argv: string[]): Options {
  const value = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];

  return {
    club: value('club') ?? 'khpc',
    amount: Number(value('amount') ?? 75),
    charges: Number(value('charges') ?? 1),
    fundOnly: argv.includes('--fund-only'),
  };
}

const money = (minor: number, currency = 'EUR') =>
  `${(minor / 100).toFixed(2)} ${currency}`;

const sum = (entries: Array<{ amount: number }>) =>
  entries.reduce((total, entry) => total + entry.amount, 0);

/**
 * Stripe settles a charge a moment after it is confirmed.
 *
 * Reading the balance immediately reports the old figure, which looks exactly
 * like the funding having failed — and was the first thing that went wrong when
 * this was worked out by hand.
 */
async function availableOn(
  stripe: Stripe,
  stripeAccount: string | undefined,
  attempts = 10
): Promise<number> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const balance = await stripe.balance.retrieve({}, stripeAccount ? { stripeAccount } : {});
    const available = sum(balance.available);
    if (available > 0) return available;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return 0;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('No STRIPE_SECRET_KEY. This script needs the platform key.');
  if (!key.startsWith('sk_test')) {
    // Every step here moves money. On a live key it would move real money.
    throw new Error('This is a test-mode script and the key is not a test key. Refusing.');
  }

  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  await db.initialize();

  const club = await db.query(
    `SELECT display_name, url_code, settings->'stripeConnect'->>'accountId' AS account
       FROM organizations WHERE url_code = $1`,
    [options.club]
  );

  if (club.rows.length === 0) throw new Error(`No club with url code "${options.club}"`);
  const { display_name: name, account } = club.rows[0];
  if (!account) {
    throw new Error(
      `${name} is not connected to Stripe. Connect it in Payment Settings, or run the seed.`
    );
  }

  console.log(`${name} — ${account}`);

  const perCharge = Math.round(options.amount * 100);
  const applicationFee = Math.min(250, Math.round(perCharge * 0.03));

  /*
   * The platform needs enough available to cover every destination charge. One
   * funding charge for the lot, rather than one each: fewer objects in the
   * dashboard, and the same effect.
   */
  const funding = await stripe.paymentIntents.create({
    amount: perCharge * options.charges,
    currency: 'eur',
    payment_method: 'pm_card_bypassPending',
    payment_method_types: ['card'],
    confirm: true,
    description: 'Funding a test balance for lodgements',
  });
  console.log(`  funded the platform: ${money(funding.amount)} (${funding.id})`);

  for (let charge = 0; charge < options.charges; charge++) {
    const paid = await stripe.paymentIntents.create({
      amount: perCharge,
      currency: 'eur',
      payment_method: 'pm_card_bypassPending',
      payment_method_types: ['card'],
      confirm: true,
      description: 'Entry fees (test)',
      transfer_data: { destination: account },
      application_fee_amount: applicationFee,
    });
    console.log(
      `  charged ${money(paid.amount)} to the club, less ${money(applicationFee)} platform fee (${paid.id})`
    );
  }

  const available = await availableOn(stripe, account);
  console.log(`  club balance available: ${money(available)}`);

  if (options.fundOnly) {
    console.log(
      '  left in the balance. Stripe pays it out on the account schedule, and *that* payout\n' +
        '  is the one the detail screen can itemise.'
    );
    return;
  }

  if (available <= 0) {
    console.log('  nothing available to pay out — try again in a moment.');
    return;
  }

  const payout = await stripe.payouts.create(
    { amount: available, currency: 'eur', description: 'Lodgement (test)' },
    { stripeAccount: account }
  );

  console.log(
    `  paid out ${money(payout.amount)} — ${payout.id}, ${payout.status}, arriving ` +
      `${new Date(payout.arrival_date * 1000).toISOString().slice(0, 10)}`
  );
  console.log('\nPayments → Lodgements now has a row. Its detail cannot be itemised, because');
  console.log('Stripe only breaks down payouts it made itself — use --fund-only for that.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
