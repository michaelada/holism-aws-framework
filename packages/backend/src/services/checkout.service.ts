import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { cartService, CartView } from './cart.service';
import {
  paymentProviderRegistry,
  PaymentProviderRegistry,
  PaymentProviderError,
} from './payment-providers';
import { calculateApplicationFee, ApplicationFeeConfig } from '../utils/handling-fee';
import { fulfilmentService } from './fulfilment.service';

/**
 * Turning a cart into a payment.
 *
 * The sequence, and why it is this way round:
 *
 *  1. **Re-read and re-price the cart on the server.** Nothing the client sends
 *     about money is trusted. A member who edits the total in the browser must
 *     get the server's figure, and prices can move between adding an item and
 *     paying for it.
 *  2. **Create the `payments` row first, in `pending`.** It is what the
 *     provider's metadata points back at, so it has to exist before the charge
 *     does. A payment with no successful charge is a harmless abandoned row; a
 *     charge with no payment row is money that cannot be reconciled.
 *  3. **Snapshot the fee configuration onto the payment.** The super-admin can
 *     change an organisation type's handling fees at any time. Without a
 *     snapshot, last month's payment silently re-prices when someone opens the
 *     report.
 *  4. **Then create the provider intent**, keyed idempotently on the payment id.
 *
 * Fulfilment — creating the entry, membership or booking — deliberately does
 * **not** happen here. It happens when the webhook confirms the money arrived
 * (`confirmPayment`). Doing it at checkout would hand out entries for payments
 * that then fail.
 */

export interface CheckoutResult {
  paymentId: string;
  /** Null for an order with nothing to pay by card. */
  clientSecret: string | null;
  provider: string | null;
  amountDue: number;
  handlingFee: number;
  offlineAmount: number;
  currency: string;
  /** True when there is nothing to charge and the order is already complete. */
  completed: boolean;
}

/** uuid v1–v5, matching what the column accepts. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The first uuid-shaped identifier in a cart item's context, if any. */
export function contextIdFrom(contextRef: Record<string, unknown> | null | undefined): string | null {
  if (!contextRef) return null;

  const candidates = [
    contextRef.activityId,
    contextRef.eventActivityId,
    contextRef.membershipTypeId,
    contextRef.calendarId,
    contextRef.merchandiseTypeId,
    contextRef.registrationTypeId,
    contextRef.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && UUID_PATTERN.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

export class CheckoutService {
  constructor(private readonly providers: PaymentProviderRegistry = paymentProviderRegistry) {}

  /**
   * Begin checkout for the member's open cart.
   *
   * Returns what the client needs to complete payment. Safe to call more than
   * once for the same cart: an existing pending payment is reused rather than a
   * second one created, so a member who reloads the checkout page does not end
   * up with two charges.
   */
  async startCheckout(
    organisationId: string,
    organisationUserId: string,
    currency: string
  ): Promise<CheckoutResult> {
    const cart = await cartService.getCart(organisationId, organisationUserId, currency);

    if (cart.items.length === 0) {
      throw new ValidationError('Your basket is empty');
    }

    // Holds that lapsed while the member was elsewhere. Charging for a place
    // that is no longer reserved is worse than making them re-add it.
    if (cart.warnings.some((w) => w.code === 'HOLD_EXPIRED')) {
      throw new ValidationError(
        'Some items are no longer held. Please review your basket.'
      );
    }

    const existing = await this.findPendingPayment(cart.id);
    if (existing) {
      return existing;
    }

    return this.createPayment(organisationId, organisationUserId, cart);
  }

  /**
   * An in-flight payment for this cart, if there is one.
   *
   * Reusing it is what makes `startCheckout` idempotent from the member's point
   * of view. The provider intent is reused too — Stripe returns the same intent
   * for the same idempotency key.
   */
  private async findPendingPayment(cartId: string): Promise<CheckoutResult | null> {
    const result = await db.query(
      `SELECT id, currency, card_amount, offline_amount, handling_fee,
              payment_provider, provider_transaction_id, metadata
       FROM payments
       WHERE cart_id = $1 AND payment_status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [cartId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      paymentId: row.id,
      clientSecret: row.metadata?.clientSecret ?? null,
      provider: row.payment_provider ?? null,
      amountDue: row.card_amount ?? 0,
      handlingFee: row.handling_fee ?? 0,
      offlineAmount: row.offline_amount ?? 0,
      currency: row.currency,
      completed: false,
    };
  }

  private async createPayment(
    organisationId: string,
    organisationUserId: string,
    cart: CartView
  ): Promise<CheckoutResult> {
    const { totals } = cart;
    const feeConfigSnapshot = await this.feeConfigSnapshot(organisationId);

    const client = await db.getClient();
    let paymentId: string;

    try {
      await client.query('BEGIN');

      const payment = await client.query(
        `INSERT INTO payments
           (organisation_id, user_id, payment_type, amount, currency,
            payment_method, payment_status, cart_id, handling_fee,
            offline_amount, card_amount, fee_config_snapshot, metadata,
            created_at, updated_at)
         VALUES ($1, $2, 'cart', $3, $4, 'card', 'pending', $5, $6, $7, $8, $9, '{}'::jsonb,
                 NOW(), NOW())
         RETURNING id`,
        [
          organisationId,
          organisationUserId,
          // `amount` is the order total in major units for the existing reports
          // that read this column; the minor-unit figures sit alongside it.
          totals.orderTotal / 100,
          cart.currency,
          cart.id,
          totals.handlingFee.total,
          totals.offlineSubtotal,
          totals.chargedToCardNow,
          JSON.stringify(feeConfigSnapshot),
        ]
      );
      paymentId = payment.rows[0].id;

      /*
       * One `payment_transactions` row per cart item, carrying that item's
       * share of the handling fee. The allocation is the largest-remainder
       * split from `utils/handling-fee.ts`, so the parts sum exactly to the
       * total charged — refunding items individually later depends on it.
       */
      for (const item of cart.items) {
        await client.query(
          `INSERT INTO payment_transactions
             (payment_id, organisation_id, item_type, context_id, context_ref,
              quantity, description, fee, handling_fee, payment_method_id,
              form_submission_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW(), NOW())`,
          [
            paymentId,
            organisationId,
            item.itemType,
            /*
             * `contextRef` is free-form JSONB — an activity id, a membership
             * type id, a slot — while `payment_transactions.context_id` is a
             * single uuid. The common identifying keys are tried in turn, and
             * anything that is not a uuid is stored as null rather than
             * failing the insert: the item type and description still identify
             * the line, and losing a payment over an unrecognised context
             * shape would be far worse.
             */
            contextIdFrom(item.contextRef),
            /*
             * And the whole of it alongside. Fulfilment runs from the payment
             * line long after the basket is gone, and for anything richer than
             * an entry — a size, a slot, a quantity — the id is not the line.
             */
            JSON.stringify(item.contextRef ?? {}),
            item.quantity ?? 1,
            item.description ?? null,
            item.fee,
            totals.allocations[item.id] ?? 0,
            item.paymentMethodId,
            item.formSubmissionId ?? null,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create a payment for checkout:', error);
      throw error;
    } finally {
      client.release();
    }

    /*
     * An order paid entirely offline has nothing to charge. It is completed
     * immediately — the club records the money when it arrives — rather than
     * being sent to a provider that would reject a zero charge.
     */
    if (totals.chargedToCardNow <= 0) {
      await this.markAwaitingOfflinePayment(paymentId);

      /*
       * Fulfil now, rather than when the money arrives.
       *
       * A card order is confirmed by Stripe seconds later, so its entries and
       * tickets can wait for the webhook. An offline order may wait weeks for a
       * cheque to be posted and recorded, and leaving the member with nothing
       * for that whole time — no entry, no ticket to bring on the day — is the
       * wrong trade. The entry is created `pending` and the ticket reads
       * "awaiting payment", so nobody is told the order has been paid for.
       *
       * Non-fatal on purpose. The order is placed and the payment row exists;
       * a fulfilment problem is for an administrator to resolve, not a reason
       * to fail a checkout the member has completed.
       */
      try {
        await fulfilmentService.fulfilPayment(paymentId);
      } catch (error) {
        logger.error(`Offline order ${paymentId} was placed but could not be fulfilled:`, error);
      }

      return {
        paymentId,
        clientSecret: null,
        provider: null,
        amountDue: 0,
        handlingFee: totals.handlingFee.total,
        offlineAmount: totals.offlineSubtotal,
        currency: cart.currency,
        completed: true,
      };
    }

    return this.attachProviderIntent(organisationId, paymentId, cart);
  }

  /** Create the provider intent and record it against the payment. */
  private async attachProviderIntent(
    organisationId: string,
    paymentId: string,
    cart: CartView
  ): Promise<CheckoutResult> {
    const provider = this.providers.forCardPayment();
    if (!provider) {
      throw new ValidationError(
        'This organisation cannot take card payments yet'
      );
    }

    const connected = await this.connectedAccount(organisationId);
    if (!connected.accountId) {
      // Without it the club's share would settle into the platform's balance.
      throw new ValidationError(
        'This organisation has not finished connecting its payment account'
      );
    }
    /*
     * Having an account id is not the same as being able to receive money. A
     * club that started onboarding and stopped — at the bank-account screen, or
     * at Stripe's terms — has an `acct_…` recorded here while Stripe still
     * reports `charges_enabled: false` and no `transfers` capability.
     *
     * Checking only for the id lets that club through to
     * `paymentIntents.create`, which fails with Stripe's own wording about
     * destination-account capabilities: accurate, but meaningless to the member
     * holding the card, and it surfaces as a failed payment rather than as the
     * setup problem it is. The message below already existed for exactly this
     * situation; it just was not reachable.
     */
    if (!connected.chargesEnabled) {
      throw new ValidationError(
        'This organisation has not finished connecting its payment account'
      );
    }
    const destinationAccountId = connected.accountId;

    const { totals } = cart;

    /*
     * What the platform keeps, which is **not** necessarily the handling fee.
     *
     * The handling fee is what the member was charged on top; the application
     * fee is the platform's share of the money collected. They were the same
     * number until organisation types could configure the split, and an
     * unconfigured type still behaves that way.
     */
    const applicationFeeConfig = await this.applicationFeeConfig(organisationId);
    const applicationFeeAmount = calculateApplicationFee(
      totals.cardSubtotal,
      totals.chargedToCardNow,
      totals.handlingFee.total,
      applicationFeeConfig
    );

    try {
      const intent = await provider.createPaymentIntent({
        amount: totals.chargedToCardNow,
        currency: cart.currency,
        applicationFeeAmount,
        destinationAccountId,
        description: `Order for ${cart.items.length} item(s)`,
        // The webhook has only this to tie an event back to a payment.
        metadata: { paymentId, organisationId, cartId: cart.id },
        // Derived from the payment id, so a retry of this same checkout
        // produces the same intent instead of a second charge.
        idempotencyKey: `payment_${paymentId}`,
      });

      await db.query(
        `UPDATE payments
         SET payment_provider = $2,
             provider_transaction_id = $3,
             provider_account_id = $4,
             application_fee_amount = $5,
             metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{clientSecret}', to_jsonb($6::text)),
             updated_at = NOW()
         WHERE id = $1`,
        [
          paymentId,
          provider.name,
          intent.providerTransactionId,
          intent.destinationAccountId,
          applicationFeeAmount,
          intent.clientSecret,
        ]
      );

      return {
        paymentId,
        clientSecret: intent.clientSecret,
        provider: provider.name,
        amountDue: totals.chargedToCardNow,
        handlingFee: totals.handlingFee.total,
        offlineAmount: totals.offlineSubtotal,
        currency: cart.currency,
        completed: false,
      };
    } catch (error) {
      // The payment row stays, marked failed. Deleting it would lose the record
      // that a member tried to pay and could not.
      await db.query(
        `UPDATE payments SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );
      if (error instanceof PaymentProviderError) {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  }

  /**
   * Record that the money arrived, and hand the order to fulfilment.
   *
   * Called only from the webhook. Returns false when the payment is already
   * settled, which is the normal case for a provider retry.
   */
  async confirmPayment(paymentId: string, providerTransactionId: string | null): Promise<boolean> {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      /*
       * `FOR UPDATE` plus the status check is the concurrency guard. Two
       * simultaneous deliveries of the same event would otherwise both read
       * `pending` and both fulfil the order.
       */
      const result = await client.query(
        `SELECT id, payment_status, cart_id
         FROM payments
         WHERE id = $1
         FOR UPDATE`,
        [paymentId]
      );

      const payment = result.rows[0];
      if (!payment) {
        await client.query('ROLLBACK');
        throw new NotFoundError('Payment not found');
      }

      if (payment.payment_status === 'paid') {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `UPDATE payments
         SET payment_status = 'paid',
             payment_date = NOW(),
             provider_transaction_id = COALESCE($2, provider_transaction_id),
             updated_at = NOW()
         WHERE id = $1`,
        [paymentId, providerTransactionId]
      );

      await client.query(
        `UPDATE payment_transactions SET status = 'paid', updated_at = NOW() WHERE payment_id = $1`,
        [paymentId]
      );

      if (payment.cart_id) {
        await client.query(
          `UPDATE carts SET status = 'ordered', updated_at = NOW() WHERE id = $1`,
          [payment.cart_id]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to confirm a payment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Record a failed attempt. The cart is left open so the member can retry. */
  async failPayment(paymentId: string, reason?: string): Promise<void> {
    await db.query(
      `UPDATE payments
       SET payment_status = 'failed',
           metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{failureMessage}', to_jsonb($2::text)),
           updated_at = NOW()
       WHERE id = $1 AND payment_status <> 'paid'`,
      [paymentId, reason ?? 'Payment failed']
    );
  }

  /**
   * The status of one of the member's own payments.
   *
   * Scoped by member as well as organisation, like everything else in the
   * account API: a payment id must not be readable by whoever guesses it.
   */
  async getPaymentStatus(
    organisationId: string,
    organisationUserId: string,
    paymentId: string
  ): Promise<{
    paymentId: string;
    status: string;
    amount: number;
    handlingFee: number;
    offlineAmount: number;
    currency: string;
    failureMessage: string | null;
  }> {
    const result = await db.query(
      `SELECT id, payment_status, card_amount, handling_fee, offline_amount,
              currency, metadata
       FROM payments
       WHERE id = $1 AND organisation_id = $2 AND user_id = $3`,
      [paymentId, organisationId, organisationUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Payment not found');
    }

    return {
      paymentId: row.id,
      status: row.payment_status,
      amount: row.card_amount ?? 0,
      handlingFee: row.handling_fee ?? 0,
      offlineAmount: row.offline_amount ?? 0,
      currency: row.currency,
      failureMessage: row.metadata?.failureMessage ?? null,
    };
  }

  /** Nothing to charge — the club records the money when it arrives. */
  private async markAwaitingOfflinePayment(paymentId: string): Promise<void> {
    await db.query(
      `UPDATE payments
       SET payment_status = 'awaiting_offline', payment_method = 'offline', updated_at = NOW()
       WHERE id = $1`,
      [paymentId]
    );
  }

  /**
   * The club's Stripe connected account.
   *
   * Read from `settings.stripeConnect`, **not** from `settings.paymentSettings`.
   * That separation is deliberate: `updatePaymentSettings` rebuilds the whole
   * `paymentSettings` object from its own defaults and sanitiser on every save,
   * so any key it does not know about is wiped. Putting the connected account
   * id in there would mean an unrelated settings change silently severed the
   * club's Stripe connection — and the next member to pay would be refused with
   * no obvious cause.
   *
   * It is also not user-editable configuration: it is state Stripe gave us
   * during onboarding, which is another reason it does not belong in the form's
   * payload.
   */
  /**
   * The platform's configured cut for this organisation.
   *
   * Resolution order:
   *
   *   1. the **organisation's** own row for the card method;
   *   2. failing that, its **type's** row;
   *   3. failing that, null — which `calculateApplicationFee` reads as "take
   *      the handling fee", the arrangement in force before any of this was
   *      configurable.
   *
   * Step 2 is a fallback, not live inheritance. Every organisation is given a
   * copy of its type's value when it is created, and the migration backfilled
   * the ones that already existed, so it is only reached when a payment method
   * is added to a type after organisations exist. Falling back to the type
   * there beats the alternative, which is an organisation silently reverting to
   * "take the whole handling fee" because a row happened not to exist.
   *
   * Card payments are the only ones that reach a provider, so the card method's
   * rates are what matter.
   */
  private async applicationFeeConfig(
    organisationId: string
  ): Promise<ApplicationFeeConfig | null> {
    /*
     * Driven from `payment_methods` rather than from either fee table, so the
     * row is found whether the value lives at organisation level, type level or
     * both. A CASE on `oaf.id` rather than COALESCE on the values, because
     * COALESCE cannot tell "the organisation set this to unconfigured" from
     * "the organisation has no row": both look like NULL, and they mean
     * opposite things. When the organisation has a row its values are
     * authoritative even when both are NULL, which is how a club opts back into
     * "take the handling fee" while its type has a split configured.
     */
    const result = await db.query(
      `SELECT CASE WHEN oaf.id IS NOT NULL
                   THEN oaf.application_fee_fixed
                   ELSE tf.application_fee_fixed END        AS application_fee_fixed,
              CASE WHEN oaf.id IS NOT NULL
                   THEN oaf.application_fee_percentage
                   ELSE tf.application_fee_percentage END   AS application_fee_percentage
       FROM organizations o
       JOIN payment_methods pm ON pm.name IN ('card', 'stripe')
       LEFT JOIN organization_payment_application_fees oaf
         ON oaf.organization_id = o.id AND oaf.payment_method_id = pm.id
       LEFT JOIN organization_type_payment_fees tf
         ON tf.organization_type_id = o.organization_type_id
        AND tf.payment_method_id = pm.id
       WHERE o.id = $1 AND (oaf.id IS NOT NULL OR tf.id IS NOT NULL)
       ORDER BY CASE pm.name WHEN 'stripe' THEN 0 ELSE 1 END
       LIMIT 1`,
      [organisationId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      fixedFee: row.application_fee_fixed === null ? null : Number(row.application_fee_fixed),
      percentageFee:
        row.application_fee_percentage === null ? null : Number(row.application_fee_percentage),
    };
  }

  /**
   * The club's connected account and whether Stripe will let it take money.
   *
   * `chargesEnabled` is read from what onboarding and the `account.updated`
   * webhook persisted, rather than by calling Stripe on every checkout: an
   * extra round trip on the payment path buys little, since the webhook keeps
   * this current. A stale `false` costs a club one clear "finish your setup"
   * message until the next refresh, which is the safe direction to be wrong in.
   */
  private async connectedAccount(
    organisationId: string
  ): Promise<{ accountId: string | null; chargesEnabled: boolean }> {
    const result = await db.query(
      `SELECT settings->'stripeConnect'->>'accountId' AS account_id,
              COALESCE((settings->'stripeConnect'->>'chargesEnabled')::boolean, false)
                AS charges_enabled
       FROM organizations WHERE id = $1`,
      [organisationId]
    );
    return {
      accountId: result.rows[0]?.account_id || null,
      chargesEnabled: result.rows[0]?.charges_enabled === true,
    };
  }

  /**
   * The fee configuration in force right now, stored with the payment.
   *
   * Read from the organisation's *type*, which is where the super-admin
   * configures fees, and frozen here so a later change cannot re-price a
   * completed order.
   */
  private async feeConfigSnapshot(organisationId: string): Promise<Record<string, unknown>> {
    /*
     * The handling fee still comes from the type — it is configured there and
     * nowhere else. The application fee is resolved organisation-first, and the
     * snapshot records **which level supplied it** as well as the value, so a
     * payment can be explained months later without re-deriving the resolution
     * from a schema that may have moved on.
     */
    const result = await db.query(
      `SELECT f.payment_method_id, f.fixed_fee, f.percentage_fee, f.tax_percentage,
              CASE WHEN oaf.id IS NOT NULL
                   THEN oaf.application_fee_fixed
                   ELSE f.application_fee_fixed END        AS application_fee_fixed,
              CASE WHEN oaf.id IS NOT NULL
                   THEN oaf.application_fee_percentage
                   ELSE f.application_fee_percentage END   AS application_fee_percentage,
              f.application_fee_fixed                      AS type_application_fee_fixed,
              f.application_fee_percentage                 AS type_application_fee_percentage,
              (oaf.id IS NOT NULL)                         AS application_fee_from_organisation
       FROM organization_type_payment_fees f
       JOIN organizations o ON o.organization_type_id = f.organization_type_id
       LEFT JOIN organization_payment_application_fees oaf
         ON oaf.organization_id = o.id AND oaf.payment_method_id = f.payment_method_id
       WHERE o.id = $1`,
      [organisationId]
    );

    return {
      capturedAt: new Date().toISOString(),
      fees: result.rows.map((row) => ({
        paymentMethodId: row.payment_method_id,
        fixedFee: row.fixed_fee,
        percentageFee: row.percentage_fee,
        taxPercentage: row.tax_percentage,
        applicationFeeFixed: row.application_fee_fixed,
        applicationFeePercentage: row.application_fee_percentage,
        applicationFeeSource: row.application_fee_from_organisation ? 'organisation' : 'type',
        typeApplicationFeeFixed: row.type_application_fee_fixed,
        typeApplicationFeePercentage: row.type_application_fee_percentage,
      })),
    };
  }
}

export const checkoutService = new CheckoutService();
