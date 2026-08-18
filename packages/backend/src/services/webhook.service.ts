import { db } from '../database/pool';
import { logger } from '../config/logger';
import { checkoutService, CheckoutService } from './checkout.service';
import { fulfilmentService, FulfilmentService } from './fulfilment.service';
import { stripeConnectService, StripeConnectService } from './stripe-connect.service';
import { WebhookEvent } from './payment-providers';

/**
 * Processing a provider webhook, exactly once.
 *
 * Payment providers retry until they get a 2xx, and will deliver the same event
 * more than once regardless of what the endpoint returns. Processing an event
 * twice means fulfilling an order twice — two entries, two memberships, one
 * payment.
 *
 * The guard is an **insert-first** claim on `processed_webhook_events`, which
 * has a unique constraint on `(provider, event_id)`:
 *
 *   1. Try to insert the event.
 *   2. A unique violation means someone else already has it — stop.
 *   3. Otherwise, do the work.
 *
 * Checking for the row and then inserting would leave a window in which two
 * concurrent deliveries both find nothing and both proceed. Letting the
 * database's constraint arbitrate closes it, because only one insert can win.
 *
 * `confirmPayment` takes a row lock and re-checks the status as a second line
 * of defence, so even a bug here cannot double-fulfil.
 */

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505';

export interface WebhookProcessResult {
  /** False when the event had already been handled. */
  processed: boolean;
  outcome: WebhookEvent['outcome'];
  /**
   * What was decided about an authorisation: captured, released because the
   * order was no longer available, or ignored as already settled. Absent on
   * every other kind of event.
   */
  settlement?: 'captured' | 'released' | 'ignored';
}

export class WebhookService {
  constructor(
    private readonly checkout: CheckoutService = checkoutService,
    private readonly fulfilment: FulfilmentService = fulfilmentService,
    private readonly connect: StripeConnectService = stripeConnectService
  ) {}

  async process(provider: string, event: WebhookEvent): Promise<WebhookProcessResult> {
    /*
     * Logged on arrival, before anything can go wrong with it.
     *
     * Nothing recorded a webhook that *worked* — only duplicates, warnings and
     * failures — so a tail of the logs during a payment showed a bare request
     * line and nothing about which event it carried or what it concerned. That
     * is precisely the case being diagnosed when someone goes looking: a
     * payment that stays pending because the event never arrived is
     * indistinguishable, in the log, from one that arrived and did nothing.
     *
     * `paymentId` is the join back to this platform's own records, so a single
     * grep follows one payment from Stripe's event to the row it settles.
     */
    logger.info('Webhook received', {
      provider,
      eventId: event.id,
      type: event.type,
      outcome: event.outcome,
      paymentId: event.paymentId,
    });

    const claimed = await this.claim(provider, event);
    if (!claimed) {
      logger.info('Webhook already processed', { provider, eventId: event.id });

      /*
       * Already claimed — but fulfilment is still attempted.
       *
       * The claim guards *event processing*; it is not a record that the order
       * was completed. A previous delivery can have confirmed the payment and
       * then failed to create what it paid for, leaving lines outstanding. If a
       * redelivery returned here immediately, that order would stay unfulfilled
       * with the member charged.
       *
       * This is safe because fulfilment is idempotent per line: a line with a
       * `fulfilled_at` is never touched again, so a redelivery can only ever
       * complete work, never duplicate it.
       */
      if (event.outcome === 'succeeded' && event.paymentId) {
        await this.fulfilment.fulfilPayment(event.paymentId);
      }

      /*
       * The same reasoning for an authorisation. If the first delivery claimed
       * the event and then died before capturing, returning here would leave
       * the funds authorised and never taken — an authorisation that expires
       * silently after a few days, so the club is simply never paid.
       *
       * Safe to repeat: `settleAuthorisation` acts only on a payment still
       * awaiting a decision, and reports `ignored` for any other.
       */
      if (event.outcome === 'authorised' && event.paymentId) {
        await this.checkout.settleAuthorisation(event.paymentId, event.providerTransactionId);
      }

      return { processed: false, outcome: event.outcome };
    }

    /*
     * `account.updated` is how Stripe reports that a club finished onboarding
     * or that its requirements changed. It settles no payment, but it is the
     * only prompt we get — without acting on it a club stays marked as unable
     * to take payments until somebody happens to open the settings screen.
     */
    if (event.type === 'account.updated' && event.account) {
      await this.refreshConnectedAccount(event.account);
      return { processed: true, outcome: event.outcome };
    }

    /*
     * Other events this application does not act on are claimed and then
     * dropped. Recording them still matters: it is what stops a provider
     * retrying an irrelevant event, and it leaves a trace of what arrived.
     */
    if (event.outcome === 'ignored' || !event.paymentId) {
      return { processed: true, outcome: event.outcome };
    }

    /*
     * The card authorised: funds held, nothing taken yet.
     *
     * This is the decision point manual capture exists to create. The checkout
     * service re-checks that the slots and capped entries in the order are
     * still available, then either captures — which brings a
     * `payment_intent.succeeded` along shortly and settles the order through
     * the branch below — or reverses the authorisation.
     *
     * Nothing is confirmed or fulfilled here. An authorisation is not money.
     */
    if (event.outcome === 'authorised') {
      const settlement = await this.checkout.settleAuthorisation(
        event.paymentId,
        event.providerTransactionId
      );
      await this.linkToPayment(provider, event.id, event.paymentId);
      return { processed: true, outcome: event.outcome, settlement };
    }

    try {
      if (event.outcome === 'succeeded') {
        const confirmed = await this.checkout.confirmPayment(
          event.paymentId,
          event.providerTransactionId
        );
        if (confirmed) {
          await this.linkToPayment(provider, event.id, event.paymentId);
        }

        /*
         * Fulfilment runs whether or not *this* delivery confirmed the payment.
         * `confirmPayment` returns false for an already-paid payment, and that
         * order may still have lines outstanding.
         */
        const outcome = await this.fulfilment.fulfilPayment(event.paymentId);
        if (!outcome.complete) {
          // Recorded, not thrown. Retrying the webhook will not fix a
          // membership with no application form, and a provider hammering the
          // endpoint over an unfulfillable line helps nobody — the reason is on
          // the line for a human to act on.
          logger.warn('A payment was confirmed but not fully fulfilled', {
            paymentId: event.paymentId,
            fulfilled: outcome.fulfilled,
            failed: outcome.failed,
          });
        }
      } else {
        await this.checkout.failPayment(event.paymentId, event.failureMessage);
        await this.linkToPayment(provider, event.id, event.paymentId);
      }
    } catch (error) {
      /*
       * The claim is released so the provider's retry can try again. Without
       * this a transient database failure would permanently mark the event as
       * handled and the payment would never be confirmed — the member is
       * charged and gets nothing.
       */
      await this.release(provider, event.id);
      logger.error('Failed to process a webhook; released for retry', {
        provider,
        eventId: event.id,
        error,
      });
      throw error;
    }

    return { processed: true, outcome: event.outcome };
  }

  /**
   * Update a club's cached Connect state from an account Stripe sent.
   *
   * An account we do not recognise is ignored rather than treated as an error:
   * the platform's Stripe account may serve more than this deployment, and a
   * 500 here would have Stripe retrying an event that will never match.
   */
  private async refreshConnectedAccount(account: unknown): Promise<void> {
    const typed = account as { id?: string };
    if (!typed?.id) return;

    const organisationId = await this.connect.organisationIdForAccount(typed.id);
    if (!organisationId) {
      logger.info('Ignoring account.updated for an unknown connected account', {
        accountId: typed.id,
      });
      return;
    }

    await this.connect.persistFromAccount(organisationId, account as never);
  }

  /** Returns false when another delivery already claimed this event. */
  private async claim(provider: string, event: WebhookEvent): Promise<boolean> {
    try {
      await db.query(
        `INSERT INTO processed_webhook_events (provider, event_id, event_type)
         VALUES ($1, $2, $3)`,
        [provider, event.id, event.type]
      );
      return true;
    } catch (error: any) {
      if (error?.code === UNIQUE_VIOLATION) return false;
      throw error;
    }
  }

  private async release(provider: string, eventId: string): Promise<void> {
    try {
      await db.query(
        `DELETE FROM processed_webhook_events WHERE provider = $1 AND event_id = $2`,
        [provider, eventId]
      );
    } catch (error) {
      // Best effort. Failing to release must not mask the original error.
      logger.error('Failed to release a webhook claim', { provider, eventId, error });
    }
  }

  private async linkToPayment(
    provider: string,
    eventId: string,
    paymentId: string
  ): Promise<void> {
    await db.query(
      `UPDATE processed_webhook_events
       SET payment_id = $3
       WHERE provider = $1 AND event_id = $2`,
      [provider, eventId, paymentId]
    );
  }
}

export const webhookService = new WebhookService();
