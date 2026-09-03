import { db } from '../database/pool';
import { logger } from '../config/logger';
/*
 * The **named** export, not the default one.
 *
 * `exceljs`'s typings declare `export default Workbook` and its CommonJS module
 * exports a namespace with no `default` at all — so `new ExcelJS()` type-checked
 * and threw "is not a constructor" at runtime, and every Excel export in this
 * application produced a file the operating system refuses to open. It survived
 * because the suites mock `exceljs` with a class of their own, which is exactly
 * the shape the real module does not have.
 */
import { Workbook } from 'exceljs';
import { fulfilmentService, FulfilmentOutcome } from './fulfilment.service';
import { NotFoundError, ValidationError } from '../middleware/errors';

/**
 * Money, to the cent.
 *
 * Refund arithmetic subtracts one float from another repeatedly — three
 * refunds of a third leave `remaining` at -1.4210854715202004e-14, which is
 * neither zero nor a refusal anybody could explain.
 */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Payment interface matching database schema
 */
export interface Payment {
  id: string;
  organisationId: string;
  userId: string;
  paymentType: string;
  contextId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentProvider?: string;
  providerTransactionId?: string;
  paymentDate?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Who paid, where the query joined them in.
   *
   * The list query has always joined `organization_users` for exactly this and
   * the mapper then dropped both columns, so every row reached the payments
   * screen with no name and no email on it. Optional because the single-payment
   * lookup does not join.
   */
  userName?: string | null;
  userEmail?: string | null;
  /**
   * When an offline payment was recorded as received, and how much of it was
   * owed offline in the first place — both in the payment row, and both needed
   * by a screen that offers to record or undo a receipt.
   */
  offlineReceivedAt?: Date | null;
  /** Minor units. Zero on a payment settled entirely by card. */
  offlineAmount?: number;
  /**
   * The handling fee added to this payment, in **minor units**.
   *
   * As `payments.handling_fee` holds it, and as `payment_transactions` holds
   * its own. Zero where the items' prices already absorbed it, which is what
   * makes "refund everything but the fee" meaningless for such a payment
   * rather than merely equal to a full refund.
   */
  handlingFee?: number;
  /**
   * The kinds of thing this payment bought, from its lines.
   *
   * Every payment taken through checkout carries `paymentType: 'cart'`, which
   * is true and useless: the list's Type column read "Basket" on every row.
   * Empty on a payment with no lines, where `paymentType` is all there is.
   */
  itemTypes?: string[];
}

/**
 * Refund interface matching database schema
 */
export interface Refund {
  id: string;
  paymentId: string;
  organisationId: string;
  refundAmount: number;
  refundReason?: string;
  refundStatus: string;
  refundProvider?: string;
  providerRefundId?: string;
  refundDate?: Date;
  requestedBy: string;
  requestedAt: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  /** How the amount was arrived at. See `RefundScope`. */
  refundScope: string;
}

/**
 * A refund with the person who asked for it named.
 *
 * `requested_by` is an `organization_users` id, which is not a name — and a
 * refund record whose whole point is accountability cannot show a uuid where
 * the administrator's name belongs.
 */
export interface RefundRecord extends Refund {
  requestedByName: string | null;
  requestedByEmail: string | null;
  /**
   * The items it covered, where it named any.
   *
   * A `full`, `lessHandlingFee` or `amount` refund names none: it is an amount
   * off the payment rather than a line of it, and pretending otherwise would
   * invent a decision the club did not make.
   */
  items: Array<{ lineId: string; description: string; amount: number }>;
}

/** A refund alongside enough of its payment to be listed on its own. */
export interface RefundListEntry extends RefundRecord {
  paymentAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentDate: Date | null;
  payerName: string | null;
  payerEmail: string | null;
}

/**
 * One thing that happened to an offline settlement.
 *
 * The payment row carries only the *current* state — `offline_received_at` and
 * `offline_received_by`, both nulled again by an undo. The history of it lives
 * in the audit trail, which is why this reads from both: the columns say where
 * the payment stands, the trail says how it got there.
 */
export interface SettlementEvent {
  occurredAt: Date;
  /** `received` or `undone`. */
  kind: 'received' | 'undone';
  actorName: string | null;
  actorEmail: string | null;
  /** What the receipt released, where the trail recorded it. */
  itemsCreated: number | null;
  itemsFailed: number | null;
  outcome: string;
}

/**
 * How a refund's amount was arrived at.
 *
 * Not a presentation detail: it decides what the payment becomes. `full` and
 * `lessHandlingFee` settle it; `items` and `amount` are partial by nature and
 * may be repeated until the payment is covered.
 *
 * `lessHandlingFee` settles it too, deliberately. The handling fee is what the
 * card cost the club, added on top of the price rather than part of it, and a
 * club returning everything it took for the goods has refunded the order — the
 * screen says so in those words rather than leaving the payment looking
 * half-done for ever.
 */
export type RefundScope = 'full' | 'lessHandlingFee' | 'items' | 'amount';

/**
 * DTO for requesting a refund
 */
export interface RequestRefundDto {
  paymentId: string;
  organisationId: string;
  /**
   * Only read for `scope: 'amount'`.
   *
   * Every other scope is computed from the payment itself: a client that names
   * both a scope and an amount could otherwise refund the whole of a payment
   * while calling it one line of it, and the payment's status would follow the
   * label rather than the money.
   */
  refundAmount?: number;
  refundReason?: string;
  requestedBy: string;
  scope?: RefundScope;
  /** `payment_transactions` ids, for `scope: 'items'`. */
  lineIds?: string[];
  /**
   * Whether to withdraw the event entries the refunded lines produced.
   *
   * Asked rather than assumed: a club that refunds an entry as a goodwill
   * gesture may well still expect the rider on the day.
   */
  removeEntries?: boolean;
}

/** What a refund did, beyond the money. */
export interface RefundOutcome {
  refund: Refund;
  /** The payment's status after it. */
  paymentStatus: string;
  /** How many event entries were withdrawn as part of it. */
  entriesRemoved: number;
}

/**
 * Filter options for payments
 */
export interface PaymentFilters {
  paymentStatus?: string[];
  paymentMethod?: string[];
  paymentType?: string[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

/**
 * Service for managing payments and refunds
 */
/**
 * One line of a payment: what it bought, for whom, and what it produced.
 *
 * The same shape the member sees on their own receipt
 * (`account-activity.service.listPayments`), because it answers the same
 * question from the other side of the counter.
 */
export interface PaymentLine {
  id: string;
  itemType: string;
  description: string;
  /** Minor units. */
  fee: number;
  handlingFee: number;
  /** How this line was settled. A basket may be part card and part offline. */
  paymentMethod: string | null;
  status: string;
  fulfilled: boolean;
  /** The record it produced — an entry, a membership — or null if it has not. */
  fulfilmentRef: string | null;
  /** Who or what it was for: the entrant, the member, the horse. */
  subjectName: string | null;
  /** What the basket recorded about it, which is how an entry names its event. */
  contextRef: Record<string, unknown> | null;
}

export class PaymentService {
  /**
   * Convert database row to Payment object
   */
  /**
   * What a payment bought, line by line.
   *
   * The payment row is a total; this is the answer to "for what". Each line
   * names the item, who it was for and what it produced, so an administrator
   * looking at €185 can see the two entries, the membership and the shirt
   * inside it and open any of them.
   *
   * The names come from the records the lines produced, followed through
   * `fulfilment_ref` — a description is composed when the basket is filled and
   * says what was bought, not who for, so two children entered in one class
   * give two identical lines.
   *
   * Scoped by organisation as well as by payment: this is reached from an
   * org-admin screen, and a payment id from another club must not resolve.
   */
  async getPaymentLines(paymentId: string, organisationId: string): Promise<PaymentLine[]> {
    try {
      const result = await db.query(
        `SELECT pt.id, pt.item_type, pt.description, pt.fee, pt.handling_fee,
                pt.status, pt.fulfilled_at, pt.fulfilment_ref, pt.context_ref,
                pm.name AS payment_method,
                -- What has already gone back on this line, so the screen can
                -- offer it for refund only while there is something left.
                COALESCE((
                  SELECT SUM(rt.amount) FROM refund_transactions rt
                   WHERE rt.payment_transaction_id = pt.id
                ), 0) AS refunded_amount,
                -- An entry withdrawn as part of a refund: still a real entry,
                -- simply off the entrant list.
                ee.entry_status AS entry_status,
                -- NULLIF around each branch, not around the COALESCE: CONCAT_WS
                -- returns an empty string rather than NULL when every argument
                -- is null, so the first branch would always win.
                COALESCE(
                  NULLIF(TRIM(CONCAT_WS(' ', ee.first_name, ee.last_name)), ''),
                  NULLIF(TRIM(CONCAT_WS(' ', mem.first_name, mem.last_name)), ''),
                  NULLIF(TRIM(reg.entity_name), ''),
                  NULLIF(TRIM(bk.booking_reference), '')
                ) AS subject_name
           FROM payment_transactions pt
           JOIN payments p ON p.id = pt.payment_id
           LEFT JOIN payment_methods pm ON pm.id = pt.payment_method_id
           LEFT JOIN event_entries ee
                  ON pt.item_type = 'event_entry' AND ee.id = pt.fulfilment_ref
           LEFT JOIN members mem
                  ON pt.item_type = 'membership' AND mem.id = pt.fulfilment_ref
           LEFT JOIN registrations reg
                  ON pt.item_type = 'registration' AND reg.id = pt.fulfilment_ref
           LEFT JOIN bookings bk
                  ON pt.item_type = 'booking' AND bk.id = pt.fulfilment_ref
          WHERE pt.payment_id = $1 AND p.organisation_id = $2
          ORDER BY pt.created_at`,
        [paymentId, organisationId]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        itemType: row.item_type,
        description: row.description ?? '',
        fee: row.fee ?? 0,
        handlingFee: row.handling_fee ?? 0,
        paymentMethod: row.payment_method ?? null,
        status: row.status,
        fulfilled: row.fulfilled_at !== null,
        fulfilmentRef: row.fulfilment_ref ?? null,
        subjectName: row.subject_name ?? null,
        contextRef: row.context_ref ?? null,
        refundedAmount: Number(row.refunded_amount ?? 0),
        entryStatus: row.entry_status ?? null,
      }));
    } catch (error) {
      logger.error('Error getting payment lines:', error);
      throw error;
    }
  }

  /**
   * Every refund recorded against one payment.
   *
   * The detail screen showed a "Refund Information" card built from fields the
   * payment row does not have, so a refunded payment rendered a box of "N/A".
   * Refunds live in their own table, one row per refund — a payment can be
   * refunded twice — and each carries who asked, when, how much and why.
   */
  async getRefundsForPayment(paymentId: string, organisationId: string): Promise<RefundRecord[]> {
    try {
      const result = await db.query(
        `SELECT r.*,
                NULLIF(TRIM(CONCAT_WS(' ', ou.first_name, ou.last_name)), '') AS requested_by_name,
                ou.email AS requested_by_email,
                -- The items it covered. An empty array for a refund that
                -- named none, which is every scope but 'items'.
                COALESCE((
                  SELECT json_agg(json_build_object(
                           'lineId', rt.payment_transaction_id,
                           'description', pt.description,
                           'amount', rt.amount
                         ) ORDER BY pt.created_at)
                    FROM refund_transactions rt
                    JOIN payment_transactions pt ON pt.id = rt.payment_transaction_id
                   WHERE rt.refund_id = r.id
                ), '[]'::json) AS items
           FROM refunds r
           LEFT JOIN organization_users ou ON ou.id = r.requested_by
          WHERE r.payment_id = $1 AND r.organisation_id = $2
          ORDER BY r.requested_at DESC`,
        [paymentId, organisationId]
      );

      return result.rows.map((row: any) => this.rowToRefundRecord(row));
    } catch (error) {
      logger.error('Error getting refunds for payment:', error);
      throw error;
    }
  }

  /**
   * Every refund this organisation has made.
   *
   * Listed on its own screen rather than found by opening payments one at a
   * time: "what have we refunded, and who authorised it" is a question about
   * the refunds, and a payments list filtered by status answers a different
   * one — it shows the payments, not the amounts that went back.
   */
  async listRefunds(organisationId: string): Promise<RefundListEntry[]> {
    try {
      const result = await db.query(
        `SELECT r.*,
                NULLIF(TRIM(CONCAT_WS(' ', ou.first_name, ou.last_name)), '') AS requested_by_name,
                ou.email AS requested_by_email,
                p.amount AS payment_amount,
                p.payment_status,
                p.payment_method,
                p.payment_date,
                NULLIF(TRIM(CONCAT_WS(' ', payer.first_name, payer.last_name)), '') AS payer_name,
                payer.email AS payer_email
           FROM refunds r
           JOIN payments p ON p.id = r.payment_id
           LEFT JOIN organization_users ou ON ou.id = r.requested_by
           LEFT JOIN organization_users payer ON payer.id = p.user_id
          WHERE r.organisation_id = $1
          ORDER BY r.requested_at DESC`,
        [organisationId]
      );

      return result.rows.map((row: any) => ({
        ...this.rowToRefundRecord(row),
        paymentAmount: parseFloat(row.payment_amount),
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        paymentDate: row.payment_date ?? null,
        payerName: row.payer_name ?? null,
        payerEmail: row.payer_email ?? null,
      }));
    } catch (error) {
      logger.error('Error listing refunds:', error);
      throw error;
    }
  }

  /**
   * How an offline settlement came to be where it is.
   *
   * Read from the **audit trail**, because the payment row cannot answer it: an
   * undo nulls `offline_received_at` and `offline_received_by`, so a payment
   * that was marked received in error and put back looks exactly like one
   * nobody ever touched. The trail keeps both acts, with who did them.
   *
   * Scoped by the organisation as well as the payment: the trail is per-club,
   * and a payment id is not a secret.
   */
  async getSettlementHistory(
    paymentId: string,
    organisationId: string
  ): Promise<SettlementEvent[]> {
    try {
      const result = await db.query(
        `SELECT occurred_at, action, outcome, actor_display, actor_email, changes
           FROM audit_events
          WHERE entity_id = $1
            AND organisation_id = $2
            AND action IN ('offline-payment.recorded', 'offline-payment.receipt-undone')
            AND outcome = 'success'
          ORDER BY occurred_at ASC`,
        [paymentId, organisationId]
      );

      return result.rows.map((row: any) => {
        const created = (row.changes ?? {}).created ?? {};
        return {
          occurredAt: row.occurred_at,
          kind: row.action === 'offline-payment.recorded' ? 'received' : 'undone',
          actorName: row.actor_display ?? null,
          actorEmail: row.actor_email ?? null,
          /*
           * Only the events recorded since the settlement audit was given
           * content carry these. An older one is honestly null rather than
           * zero, which would claim the receipt released nothing.
           */
          itemsCreated: typeof created.itemsCreated === 'number' ? created.itemsCreated : null,
          itemsFailed: typeof created.itemsFailed === 'number' ? created.itemsFailed : null,
          outcome: row.outcome,
        } as SettlementEvent;
      });
    } catch (error) {
      logger.error('Error getting settlement history:', error);
      throw error;
    }
  }

  /**
   * The `organization_users` row for a caller, in one club.
   *
   * Every column that records *who did this* — `offline_received_by`,
   * `refunds.requested_by` — references `organization_users(id)`, and a token
   * carries a **Keycloak** id. They are different identifiers for the same
   * person, and writing the token's straight in violates the foreign key: the
   * offline receipt used to 500 for exactly that reason.
   *
   * Scoped to the organisation as well as the person, because an administrator
   * of several clubs has one row per club and the record belongs to the club
   * whose money it is. Null rather than throwing — an act by somebody whose
   * org-admin row has since been removed is still an act that happened.
   */
  private async organisationUserFor(
    keycloakUserId: string,
    organisationId: string
  ): Promise<string | null> {
    const actor = await db.query(
      `SELECT id
         FROM organization_users
        WHERE keycloak_user_id = $1
          AND organization_id = $2::uuid
          AND user_type = 'org-admin'
        LIMIT 1`,
      [keycloakUserId, organisationId]
    );
    return actor.rows[0]?.id ?? null;
  }

  private rowToRefundRecord(row: any): RefundRecord {
    return {
      ...this.rowToRefund(row),
      requestedByName: row.requested_by_name ?? null,
      requestedByEmail: row.requested_by_email ?? null,
      items: row.items ?? [],
    };
  }

  private rowToPayment(row: any): Payment {

    return {
      id: row.id,
      organisationId: row.organisation_id,
      userId: row.user_id,
      paymentType: row.payment_type,
      contextId: row.context_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      paymentProvider: row.payment_provider,
      providerTransactionId: row.provider_transaction_id,
      paymentDate: row.payment_date,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      /*
       * `user_name` is `first_name || ' ' || last_name`, which is null when
       * either part is, so it is trimmed and emptied to null rather than
       * reaching a screen as the string "null" or as a stray space.
       */
      userName: (row.user_name ?? '').trim() || null,
      userEmail: row.user_email ?? null,
      handlingFee: row.handling_fee ?? 0,
      offlineReceivedAt: row.offline_received_at ?? null,
      offlineAmount: row.offline_amount ?? 0,
      itemTypes: row.item_types ?? [],
    };
  }

  /**
   * Convert database row to Refund object
   */
  private rowToRefund(row: any): Refund {
    return {
      id: row.id,
      paymentId: row.payment_id,
      organisationId: row.organisation_id,
      refundAmount: parseFloat(row.refund_amount),
      refundReason: row.refund_reason,
      refundStatus: row.refund_status,
      refundProvider: row.refund_provider,
      providerRefundId: row.provider_refund_id,
      refundDate: row.refund_date,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      refundScope: row.refund_scope ?? 'full',
    };
  }

  /**
   * Get all payments for an organisation with optional filters
   */
  async getPaymentsByOrganisation(
    organisationId: string,
    filters?: PaymentFilters
  ): Promise<Payment[]> {
    try {
      let query = `
        SELECT p.*, 
               ou.first_name || ' ' || ou.last_name as user_name,
               ou.email as user_email,
               /*
                * What is actually in the basket.
                *
                * Every payment taken through checkout has payment_type
                * 'cart', so the list's Type column said "Basket" on every row
                * and told a club nothing. The lines know: one distinct item
                * type per kind of thing bought, so a basket reads as
                * "Entry, Membership, Shop" rather than as itself.
                *
                * Ordered, so the same basket does not shuffle its labels
                * between requests.
                */
               ARRAY(
                 SELECT DISTINCT pt.item_type
                   FROM payment_transactions pt
                  WHERE pt.payment_id = p.id
                  ORDER BY pt.item_type
               ) AS item_types
        FROM payments p
        LEFT JOIN organization_users ou ON p.user_id = ou.id
        WHERE p.organisation_id = $1
      `;
      const params: any[] = [organisationId];
      let paramCount = 2;

      // Apply filters
      if (filters) {
        if (filters.paymentStatus && filters.paymentStatus.length > 0) {
          query += ` AND p.payment_status = ANY($${paramCount})`;
          params.push(filters.paymentStatus);
          paramCount++;
        }

        if (filters.paymentMethod && filters.paymentMethod.length > 0) {
          query += ` AND p.payment_method = ANY($${paramCount})`;
          params.push(filters.paymentMethod);
          paramCount++;
        }

        if (filters.paymentType && filters.paymentType.length > 0) {
          query += ` AND p.payment_type = ANY($${paramCount})`;
          params.push(filters.paymentType);
          paramCount++;
        }

        if (filters.startDate) {
          query += ` AND p.payment_date >= $${paramCount}`;
          params.push(filters.startDate);
          paramCount++;
        }

        if (filters.endDate) {
          query += ` AND p.payment_date <= $${paramCount}`;
          params.push(filters.endDate);
          paramCount++;
        }

        if (filters.searchTerm) {
          query += ` AND (
            ou.first_name ILIKE $${paramCount} OR 
            ou.last_name ILIKE $${paramCount} OR 
            ou.email ILIKE $${paramCount} OR
            p.provider_transaction_id ILIKE $${paramCount}
          )`;
          params.push(`%${filters.searchTerm}%`);
          paramCount++;
        }
      }

      query += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

      const result = await db.query(query, params);

      return result.rows.map(row => this.rowToPayment(row));
    } catch (error) {
      logger.error('Error getting payments by organisation:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment | null> {
    try {
      const result = await db.query(
        `SELECT p.*, 
                ou.first_name || ' ' || ou.last_name as user_name,
                ou.email as user_email
         FROM payments p
         LEFT JOIN organization_users ou ON p.user_id = ou.id
         WHERE p.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToPayment(result.rows[0]);
    } catch (error) {
      logger.error('Error getting payment by ID:', error);
      throw error;
    }
  }

  /**
   * Refund a payment, or part of one.
   *
   * Four ways to arrive at an amount, and the difference between them is not
   * cosmetic — it decides what the payment becomes:
   *
   * | scope | amount | payment becomes |
   * |---|---|---|
   * | `full` | everything still refundable | `refunded` |
   * | `lessHandlingFee` | everything but the fee the card cost | `refunded` |
   * | `items` | those lines, at what was paid for them | `partially_refunded`, or `refunded` once the lines add up to the payment |
   * | `amount` | what the caller asked for | as above |
   *
   * **The amount is computed here for every scope but `amount`.** A client that
   * could name both a scope and a figure could refund the whole of a payment
   * while calling it one line of it, and the status would follow the label
   * rather than the money.
   *
   * Repeatable: a club may refund one child's entry today and the other's next
   * week, and the payment settles to `refunded` when the parts cover it.
   */
  async requestRefund(data: RequestRefundDto): Promise<RefundOutcome> {
    /*
     * A caller that names an amount and no scope means that amount.
     *
     * Defaulting to `full` there would ignore the figure they sent and refund
     * the whole payment instead — the one mistake in this method that moves
     * more money than was asked for.
     */
    const scope: RefundScope =
      data.scope ?? (data.refundAmount !== undefined ? 'amount' : 'full');

    try {
      const payment = await this.getPaymentById(data.paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      if (payment.organisationId !== data.organisationId) {
        throw new NotFoundError('Payment not found');
      }

      /*
       * A part-refunded payment can be refunded again — that is the whole point
       * of refunding one item at a time — so `partially_refunded` is as
       * refundable as `paid`. Nothing else is: a pending payment has taken no
       * money, and a fully refunded one has none left.
       */
      if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partially_refunded') {
        throw new ValidationError('Can only refund paid payments');
      }

      const alreadyRefunded = await db.query(
        `SELECT COALESCE(SUM(refund_amount), 0) AS total_refunded
           FROM refunds
          WHERE payment_id = $1 AND refund_status IN ('pending', 'completed')`,
        [data.paymentId]
      );
      const totalRefunded = parseFloat(alreadyRefunded.rows[0]?.total_refunded ?? '0');
      const remaining = round2(payment.amount - totalRefunded);

      if (remaining <= 0) {
        throw new ValidationError('This payment has already been refunded in full');
      }

      const lines = await this.refundableLines(data.paymentId, data.organisationId);
      const { amount, lineAllocations } = this.refundAmountFor(
        scope,
        data,
        payment,
        remaining,
        lines
      );

      if (amount <= 0) {
        throw new ValidationError('Refund amount must be greater than 0');
      }
      if (amount > remaining) {
        throw new ValidationError(
          `Refund amount exceeds remaining refundable amount (${remaining} ${payment.currency})`
        );
      }

      const requestedBy = await this.organisationUserFor(data.requestedBy, data.organisationId);

      const result = await db.query(
        `INSERT INTO refunds 
         (payment_id, organisation_id, refund_amount, refund_reason, 
          refund_status, requested_by, refund_scope)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.paymentId,
          data.organisationId,
          amount,
          data.refundReason || null,
          'pending',
          requestedBy,
          scope,
        ]
      );
      const refund = this.rowToRefund(result.rows[0]);

      /*
       * Which lines it covered, where the caller named them. Recorded so the
       * same item cannot be refunded twice and so the screen can say which
       * items went back rather than only how much.
       */
      for (const [lineId, lineAmount] of Object.entries(lineAllocations)) {
        await db.query(
          `INSERT INTO refund_transactions (refund_id, payment_transaction_id, amount)
           VALUES ($1, $2, $3)`,
          [refund.id, lineId, lineAmount]
        );
      }

      /*
       * What the payment now is.
       *
       * `full` and `lessHandlingFee` settle it outright. Everything else is
       * partial until the parts cover the payment — a club refunding one entry
       * at a time ends at `refunded`, not at a payment that is for ever
       * "partially" so.
       */
      const settles =
        scope === 'full' ||
        scope === 'lessHandlingFee' ||
        round2(totalRefunded + amount) >= payment.amount;
      const paymentStatus = settles ? 'refunded' : 'partially_refunded';

      await db.query(
        `UPDATE payments SET payment_status = $3, updated_at = NOW()
          WHERE id = $1 AND organisation_id = $2`,
        [data.paymentId, data.organisationId, paymentStatus]
      );

      /*
       * Which entries to withdraw, where the caller asked for that.
       *
       * The lines the refund named, or — for a refund that settles the whole
       * payment — every line on it. **Never for an arbitrary amount that
       * leaves the payment part-refunded**: €20 off a basket of four names no
       * item, and picking entries to withdraw would be inventing a decision
       * the club did not make.
       */
      const entriesRemoved = data.removeEntries
        ? await this.withdrawEntries(
            Object.keys(lineAllocations).length > 0
              ? Object.keys(lineAllocations)
              : settles
                ? lines.map((line) => line.id)
                : [],
            requestedBy,
            data.refundReason ?? null
          )
        : 0;

      logger.info('Refund recorded', {
        refundId: refund.id,
        paymentId: data.paymentId,
        scope,
        amount,
        paymentStatus,
        entriesRemoved,
      });

      return { refund, paymentStatus, entriesRemoved };
    } catch (error) {
      logger.error('Error requesting refund:', error);
      throw error;
    }
  }

  /**
   * The lines of a payment, with what has already gone back on each.
   *
   * A line refunded in full cannot be refunded again; one refunded in part —
   * which happens when an `amount` refund is spread across the basket — can be
   * refunded up to what is left of it.
   */
  private async refundableLines(
    paymentId: string,
    organisationId: string
  ): Promise<Array<{ id: string; itemType: string; fee: number; handlingFee: number; refunded: number; fulfilmentRef: string | null }>> {
    const result = await db.query(
      `SELECT pt.id, pt.item_type, pt.fee, pt.handling_fee, pt.fulfilment_ref,
              COALESCE((
                SELECT SUM(rt.amount) FROM refund_transactions rt
                 WHERE rt.payment_transaction_id = pt.id
              ), 0) AS refunded
         FROM payment_transactions pt
         JOIN payments p ON p.id = pt.payment_id
        WHERE pt.payment_id = $1 AND p.organisation_id = $2
        ORDER BY pt.created_at`,
      [paymentId, organisationId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      itemType: row.item_type,
      fee: row.fee ?? 0,
      handlingFee: row.handling_fee ?? 0,
      refunded: Number(row.refunded ?? 0),
      fulfilmentRef: row.fulfilment_ref ?? null,
    }));
  }

  /** The amount a scope comes to, and which lines it is made of. */
  private refundAmountFor(
    scope: RefundScope,
    data: RequestRefundDto,
    payment: Payment,
    remaining: number,
    lines: Array<{ id: string; fee: number; handlingFee: number; refunded: number }>
  ): { amount: number; lineAllocations: Record<string, number> } {
    switch (scope) {
      case 'full':
        return { amount: remaining, lineAllocations: {} };

      case 'lessHandlingFee': {
        /*
         * The fee the card cost, kept back.
         *
         * Only where it was **added on**: an item whose price already absorbs
         * its fee has none to keep back, and `payments.handling_fee` is zero
         * for such a basket — so this comes to the same thing as a full refund
         * and is refused rather than offered as a distinction that is not one.
         */
        const handlingFee = (payment.handlingFee ?? 0) / 100;
        if (handlingFee <= 0) {
          throw new ValidationError('No handling fee was added to this payment');
        }
        return { amount: round2(remaining - handlingFee), lineAllocations: {} };
      }

      case 'items': {
        const wanted = data.lineIds ?? [];
        if (wanted.length === 0) {
          throw new ValidationError('No items were named for this refund');
        }

        const allocations: Record<string, number> = {};
        for (const id of wanted) {
          const line = lines.find((candidate) => candidate.id === id);
          if (!line) {
            throw new ValidationError('That item is not part of this payment');
          }

          /*
           * What is left of the line, in minor units — its own fee plus the
           * share of the handling fee it bore, which the member paid and is
           * therefore owed back with it.
           */
          const refundable = line.fee + line.handlingFee - line.refunded;
          if (refundable <= 0) {
            throw new ValidationError('That item has already been refunded');
          }
          allocations[id] = refundable;
        }

        const total = Object.values(allocations).reduce((sum, value) => sum + value, 0);
        return { amount: round2(total / 100), lineAllocations: allocations };
      }

      case 'amount':
      default: {
        const amount = Number(data.refundAmount);
        if (!Number.isFinite(amount)) {
          throw new ValidationError('refundAmount is required');
        }
        return { amount: round2(amount), lineAllocations: {} };
      }
    }
  }

  /**
   * Withdraw the entries a set of refunded lines produced.
   *
   * `entry_status`, not a delete: the entry happened, was paid for and was
   * refunded, and all three are worth keeping. It stops appearing on the
   * entrant list — the list a club prints on the day — and the club can still
   * find it.
   *
   * Only `event_entry` lines. A membership or a booking that is refunded is a
   * different conversation, and quietly cancelling either off the back of a
   * refund would be doing something nobody asked for.
   */
  private async withdrawEntries(
    lineIds: string[],
    removedBy: string | null,
    reason: string | null
  ): Promise<number> {
    if (lineIds.length === 0) return 0;

    const result = await db.query(
      `UPDATE event_entries ee
          SET entry_status = 'removed',
              removed_at = NOW(),
              removed_by = $2,
              removal_reason = $3,
              updated_at = NOW()
         FROM payment_transactions pt
        WHERE pt.id = ANY($1::uuid[])
          AND pt.item_type = 'event_entry'
          AND pt.fulfilment_ref = ee.id
          AND ee.entry_status <> 'removed'`,
      [lineIds, removedBy, reason]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Export payments to Excel
   */
  async exportPayments(
    organisationId: string,
    filters?: PaymentFilters
  ): Promise<Buffer> {
    try {
      // Get payments with filters
      const payments = await this.getPaymentsByOrganisation(organisationId, filters);

      // Create workbook
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Payments');

      // Define columns
      worksheet.columns = [
        { header: 'Payment ID', key: 'id', width: 36 },
        { header: 'Date', key: 'paymentDate', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Status', key: 'paymentStatus', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 20 },
        { header: 'Payment Type', key: 'paymentType', width: 20 },
        { header: 'Provider', key: 'paymentProvider', width: 15 },
        { header: 'Transaction ID', key: 'providerTransactionId', width: 30 },
        { header: 'User ID', key: 'userId', width: 36 },
        { header: 'Context ID', key: 'contextId', width: 36 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      payments.forEach(payment => {
        worksheet.addRow({
          id: payment.id,
          paymentDate: payment.paymentDate 
            ? new Date(payment.paymentDate).toLocaleString() 
            : 'N/A',
          amount: payment.amount,
          currency: payment.currency,
          paymentStatus: payment.paymentStatus,
          paymentMethod: payment.paymentMethod,
          paymentType: payment.paymentType,
          paymentProvider: payment.paymentProvider || 'N/A',
          providerTransactionId: payment.providerTransactionId || 'N/A',
          userId: payment.userId,
          contextId: payment.contextId,
        });
      });

      // Format amount column as currency
      worksheet.getColumn('amount').numFmt = '#,##0.00';

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.error('Error exporting payments:', error);
      throw error;
    }
  }

  /**
   * Record that money paid outside the system has arrived (I2).
   *
   * **This is the step that finishes an offline order.** A member who chooses
   * to pay by cheque or transfer checks out into `awaiting_offline`, and
   * fulfilment deliberately defers everything except an event entry: a
   * membership is an entitlement that runs for a year, and granting one before
   * the money arrives gives it away. Those lines sit unfulfilled until this
   * runs — so without it, a paid cheque produces no membership, no order and no
   * booking, and the member's own screen reads "the club has still to record
   * this as received" forever.
   *
   * Fulfilment is therefore triggered here rather than left to a later job, and
   * its outcome is returned so the screen can say what the money actually
   * produced.
   *
   * **Idempotent.** Marking an already-received payment changes nothing and
   * re-runs fulfilment, which is itself safe — it only looks at lines with no
   * `fulfilled_at`. A double click, or two administrators at once, cannot
   * create two memberships.
   */
  async markOfflinePaymentReceived(
    organisationId: string,
    paymentId: string,
    /** The **Keycloak** id of the administrator doing this, from the token. */
    receivedByKeycloakUserId: string
  ): Promise<{ payment: Payment; fulfilment: FulfilmentOutcome }> {
    const existing = await db.query(
      `SELECT id, payment_status, offline_received_at
       FROM payments
       WHERE id = $1 AND organisation_id = $2`,
      [paymentId, organisationId]
    );

    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundError('Payment not found');
    }

    /*
     * Only an offline payment can be received. A card payment's money arrives
     * through the provider and its status is the webhook's to set — marking one
     * received by hand would overwrite what Stripe said with a guess.
     */
    if (row.payment_status !== 'awaiting_offline' && !row.offline_received_at) {
      throw new ValidationError('That payment is not awaiting an offline settlement');
    }

    const receivedBy = await this.organisationUserFor(receivedByKeycloakUserId, organisationId);

    await db.query(
      `UPDATE payments
       SET payment_status = 'paid',
           offline_received_at = COALESCE(offline_received_at, NOW()),
           offline_received_by = COALESCE(offline_received_by, $3),
           payment_date = COALESCE(payment_date, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND organisation_id = $2`,
      [paymentId, organisationId, receivedBy]
    );

    /*
     * Now that it is paid, everything that was waiting can be created. A
     * failure here does not undo the money: the payment stays received and the
     * failing line carries its reason, exactly as a card payment's would.
     */
    const fulfilment = await fulfilmentService.fulfilPayment(paymentId);

    logger.info('Offline payment recorded as received', {
      paymentId,
      receivedBy,
      fulfilled: fulfilment.fulfilled,
      failed: fulfilment.failed,
    });

    const payment = await this.getPaymentById(paymentId);
    return { payment: payment!, fulfilment };
  }

  /**
   * Undo a mistaken "received" (I2).
   *
   * **Refused once anything has been fulfilled**, and that restriction is the
   * substance of this method rather than an omission. Marking a payment
   * received creates memberships, orders, bookings and registrations; quietly
   * flipping the status back would leave every one of them in place, granted
   * against money the club never had, with nothing to say so.
   *
   * So an undo is available only while **the receipt itself** produced nothing —
   * which is the case an administrator actually needs it for: the wrong row
   * clicked, caught immediately. Once the receipt has released records, the
   * honest routes are a refund or cancelling the thing itself, and the error
   * says so.
   *
   * "The receipt itself" is the whole of it. An entry, a booking and a
   * merchandise order are created when the order is *placed*, weeks before the
   * cheque arrives, so counting every fulfilled line refused the undo on almost
   * every offline order there is — and the screen reported success anyway,
   * because `useApi.execute` answered `null` rather than throwing.
   */
  async undoOfflinePaymentReceived(
    organisationId: string,
    paymentId: string
  ): Promise<Payment> {
    const existing = await db.query(
      `SELECT p.id, p.payment_status, p.offline_received_at,
              /*
               * What **this receipt** released, not what the payment has ever
               * produced.
               *
               * An entry, a booking and a merchandise order are created when
               * the order is placed, weeks before the cheque arrives — so
               * counting every fulfilled line made undo impossible for almost
               * every offline order there is, and the button a permanent lie.
               * A line fulfilled before the receipt was not released by it and
               * is not stranded by undoing it.
               */
              (SELECT COUNT(*) FROM payment_transactions pt
                WHERE pt.payment_id = p.id
                  AND pt.fulfilled_at IS NOT NULL
                  AND pt.fulfilled_at >= p.offline_received_at) AS released_lines
       FROM payments p
       WHERE p.id = $1 AND p.organisation_id = $2`,
      [paymentId, organisationId]
    );

    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundError('Payment not found');
    }
    if (!row.offline_received_at) {
      throw new ValidationError('That payment has not been recorded as received');
    }
    if (Number(row.released_lines) > 0) {
      throw new ValidationError(
        'Recording this payment created memberships, bookings or orders. ' +
          'Refund it or cancel those individually instead of undoing the receipt.'
      );
    }

    await db.query(
      `UPDATE payments
       SET payment_status = 'awaiting_offline',
           offline_received_at = NULL,
           offline_received_by = NULL,
           payment_date = NULL,
           updated_at = NOW()
       WHERE id = $1 AND organisation_id = $2`,
      [paymentId, organisationId]
    );

    logger.info('Offline payment receipt undone', { paymentId });

    return (await this.getPaymentById(paymentId))!;
  }
}

// Create singleton instance
export const paymentService = new PaymentService();
