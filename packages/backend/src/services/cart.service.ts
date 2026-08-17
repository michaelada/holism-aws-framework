import { db } from '../database/pool';
import { formSummariesFor } from '../utils/form-summary';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { isCardPaymentMethod } from '../utils/payment-method';
import {
  calculateCartTotals,
  describeCartSummary,
  CartLine,
  CartTotals,
} from '../utils/handling-fee';
import { organizationTypePaymentFeeService } from './organization-type-payment-fee.service';

/**
 * The member's cart.
 *
 * All money is in **integer minor units**, end to end. The totals are computed
 * here and never on the client: the rules are fiddly enough (offline vs card,
 * fee included vs added on, per-provider fixed elements) that a second
 * implementation would drift, and the number it drifts on is the one a member
 * is asked to approve.
 *
 * See G3 and Part 4 of docs/ACCOUNT_USER_APP_WIREFRAMES.md.
 */

export type CartItemType =
  | 'event_entry'
  | 'membership'
  | 'registration'
  | 'booking'
  | 'merchandise';

/**
 * One answer, as a member would read it back.
 *
 * Returns an empty string for anything they did not answer, which the caller
 * takes as "leave it out" — an unticked optional box is not worth a line in a
 * summary meant to be scanned before paying.
 */
/** The shape a payment method id has to have before it reaches `::uuid[]`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AddCartItemDto {
  itemType: CartItemType;
  /** Activity id, membership type id, slot, variant — whatever identifies it. */
  contextRef: Record<string, any>;
  description: string;
  formSubmissionId?: string;
  quantity?: number;
  /** Minor units, before discount. */
  unitFee: number;
  /**
   * Which method the member is paying by.
   *
   * Optional: the member is not asked at add time, so when it is absent the
   * cart chooses from what the item accepts — see `defaultPaymentMethodFor`.
   */
  paymentMethodId?: string;
  handlingFeeIncluded: boolean;
  /** Payment methods the source item accepts, snapshotted at add time. */
  supportedPaymentMethodIds: string[];
  discountId?: string;
  discountAmount?: number;
  /** Soft hold for capacity-limited items. */
  expiresAt?: Date;
}

export interface CartItemView {
  id: string;
  itemType: CartItemType;
  contextRef: Record<string, any>;
  description: string;
  formSubmissionId: string | null;
  quantity: number;
  unitFee: number;
  fee: number;
  discountAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodDisplayName: string;
  isCard: boolean;
  handlingFeeIncluded: boolean;
  /**
   * Methods the member may switch this item to, named.
   *
   * Ids alone were enough to *validate* a switch but not to offer one — the
   * cart page has no other source for what a method is called, so it could only
   * show the one already chosen.
   */
  availablePaymentMethods: Array<{
    id: string;
    name: string;
    displayName: string;
    isCard: boolean;
  }>;
  /**
   * The calendar's own mark, for a booking.
   *
   * Null on everything else: an event or a shirt has no per-item icon to carry,
   * and the basket falls back to one drawn from the item's type. A club's
   * bookable things *are* distinguishable from each other, which is the whole
   * reason a calendar carries an icon and a colour at all.
   */
  icon: string | null;
  colour: string | null;
  /**
   * What the member answered on this item's application form, in the order the
   * club asked for it.
   *
   * Present so the basket can be checked before paying: a member who mistyped a
   * pony's height or picked the wrong age group has no other sight of it
   * between filling the form in and the club receiving the entry. Empty answers
   * are left out — a summary is for confirming what was said, and a list of
   * blanks buries it.
   */
  formSummary: Array<{ label: string; value: string }>;
  /** True when the fee shown should carry "(plus handling fee)". */
  showsHandlingFeeNote: boolean;
  expiresAt: Date | null;
  expired: boolean;
}

export interface CartView {
  id: string;
  organisationId: string;
  currency: string;
  status: string;
  items: CartItemView[];
  totals: CartTotals;
  summary: ReturnType<typeof describeCartSummary>;
  /** Items whose soft hold lapsed while the member was elsewhere. */
  warnings: Array<{ itemId: string; code: 'HOLD_EXPIRED'; message: string }>;
}

const EMPTY_TOTALS: CartTotals = {
  offlineSubtotal: 0,
  cardSubtotal: 0,
  feeBearingBase: 0,
  handlingFee: { base: 0, net: 0, tax: 0, total: 0 },
  chargedToCardNow: 0,
  orderTotal: 0,
  perMethod: [],
  allocations: {},
};

export class CartService {
  /**
   * The member's open cart for this organisation, creating one if needed.
   *
   * Carts are scoped by organisation as well as user: switching organisation
   * switches cart. Merging them would be meaningless — different currencies,
   * different payment providers, different handling fees.
   */
  async getOrCreateOpenCart(
    organisationId: string,
    organisationUserId: string,
    currency: string
  ): Promise<{ id: string; currency: string; status: string }> {
    const existing = await db.query(
      `SELECT id, currency, status FROM carts
       WHERE organisation_id = $1 AND user_id = $2 AND status = 'open'
       LIMIT 1`,
      [organisationId, organisationUserId]
    );

    if (existing.rows.length > 0) return existing.rows[0];

    const created = await db.query(
      `INSERT INTO carts (organisation_id, user_id, currency)
       VALUES ($1, $2, $3)
       RETURNING id, currency, status`,
      [organisationId, organisationUserId, currency]
    );
    return created.rows[0];
  }

  /** Raw rows for one cart, joined to their payment method. */
  private async loadItems(cartId: string) {
    const result = await db.query(
      `SELECT ci.*, pm.name AS payment_method_name, pm.display_name AS payment_method_display_name
       FROM cart_items ci
       JOIN payment_methods pm ON pm.id = ci.payment_method_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at`,
      [cartId]
    );
    return result.rows;
  }

  /**
   * Every payment method any item in this cart could switch to, by id.
   *
   * One query for the whole cart: the alternatives are a small set drawn from
   * the same handful of methods, and a lookup per item would be a query per row
   * to answer the same question.
   */
  private async paymentMethodsFor(
    rows: any[]
  ): Promise<Map<string, { id: string; name: string; display_name: string }>> {
    const ids = [
      ...new Set(
        rows.flatMap((row) => (row.context_ref?.supportedPaymentMethodIds ?? []) as string[])
      ),
    ];
    if (ids.length === 0) return new Map();

    const result = await db.query(
      'SELECT id, name, display_name FROM payment_methods WHERE id = ANY($1::uuid[])',
      [ids]
    );
    return new Map(result.rows.map((row: any) => [row.id, row]));
  }

  /**
   * The answers behind every form submission in this cart, by submission id.
   *
   * Delegates to `utils/form-summary`, which the member's own records read too:
   * the basket and My Memberships must describe the same submission the same
   * way, and two copies of this drift.
   */
  private async formSummariesFor(
    rows: any[]
  ): Promise<Map<string, Array<{ label: string; value: string }>>> {
    return formSummariesFor(rows.map((row) => row.form_submission_id));
  }

  /**
   * The calendars behind any bookings in this cart, by id.
   *
   * One query for the cart, and none at all when it holds no bookings — most
   * baskets do not.
   */
  private async calendarsFor(
    rows: any[]
  ): Promise<Map<string, { display_icon: string | null; display_colour: string | null }>> {
    const ids = [
      ...new Set(
        rows
          .filter((row) => row.item_type === 'booking')
          .map((row) => row.context_ref?.calendarId)
          .filter(Boolean)
      ),
    ];
    if (ids.length === 0) return new Map();

    const result = await db.query(
      'SELECT id, display_icon, display_colour FROM calendars WHERE id = ANY($1::uuid[])',
      [ids]
    );
    return new Map(result.rows.map((row: any) => [row.id, row]));
  }

  private toItemView(
    row: any,
    now: Date,
    methodsById: Map<string, { id: string; name: string; display_name: string }> = new Map(),
    formSummaries: Map<string, Array<{ label: string; value: string }>> = new Map(),
    calendarsById: Map<string, { display_icon: string | null; display_colour: string | null }> =
      new Map()
  ): CartItemView {
    const calendar = calendarsById.get(row.context_ref?.calendarId);
    const isCard = isCardPaymentMethod(row.payment_method_name);
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;

    return {
      id: row.id,
      itemType: row.item_type,
      contextRef: row.context_ref || {},
      description: row.description || '',
      formSubmissionId: row.form_submission_id,
      quantity: row.quantity,
      unitFee: row.unit_fee,
      fee: row.fee,
      discountAmount: row.discount_amount,
      paymentMethodId: row.payment_method_id,
      paymentMethodName: row.payment_method_name,
      paymentMethodDisplayName: row.payment_method_display_name,
      isCard,
      handlingFeeIncluded: row.handling_fee_included,
      icon: calendar?.display_icon ?? null,
      colour: calendar?.display_colour ?? null,
      formSummary: formSummaries.get(row.form_submission_id) ?? [],
      availablePaymentMethods: ((row.context_ref?.supportedPaymentMethodIds ?? []) as string[])
        .map((id) => methodsById.get(id))
        .filter(Boolean)
        .map((method) => ({
          id: method!.id,
          name: method!.name,
          displayName: method!.display_name,
          isCard: isCardPaymentMethod(method!.name),
        })),
      // The note the brief calls for: only on a card item whose fee does not
      // already absorb the handling fee. Never on an offline line.
      showsHandlingFeeNote: isCard && !row.handling_fee_included,
      expiresAt,
      expired: Boolean(expiresAt && expiresAt.getTime() <= now.getTime()),
    };
  }

  /**
   * The cart as the member should see it: items, totals and any warnings.
   *
   * Expired holds are reported rather than silently dropped — an item vanishing
   * between page loads with no explanation is worse than being told the hold
   * lapsed.
   */
  async getCart(
    organisationId: string,
    organisationUserId: string,
    currency: string,
    now: Date = new Date()
  ): Promise<CartView> {
    const cart = await this.getOrCreateOpenCart(
      organisationId,
      organisationUserId,
      currency
    );

    const rows = await this.loadItems(cart.id);
    const [methodsById, formSummaries, calendarsById] = await Promise.all([
      this.paymentMethodsFor(rows),
      this.formSummariesFor(rows),
      this.calendarsFor(rows),
    ]);
    const items = rows.map((row: any) =>
      this.toItemView(row, now, methodsById, formSummaries, calendarsById)
    );

    const configs = await organizationTypePaymentFeeService.resolveForOrganisation(
      organisationId
    );

    // An expired hold is no longer a thing the member can buy, so it must not
    // contribute to a total they are about to be charged.
    const priceable = items.filter((item) => !item.expired);
    const lines: CartLine[] = priceable.map((item) => ({
      id: item.id,
      fee: item.fee,
      paymentMethodId: item.paymentMethodId,
      isCard: item.isCard,
      handlingFeeIncluded: item.handlingFeeIncluded,
    }));

    const totals = lines.length > 0
      ? calculateCartTotals(lines, configs)
      : { ...EMPTY_TOTALS };

    return {
      id: cart.id,
      organisationId,
      currency: cart.currency,
      status: cart.status,
      items,
      totals,
      summary: describeCartSummary(totals),
      warnings: items
        .filter((item) => item.expired)
        .map((item) => ({
          itemId: item.id,
          code: 'HOLD_EXPIRED' as const,
          message: `"${item.description}" was held for you but the hold has expired`,
        })),
    };
  }

  /**
   * Add an item.
   *
   * Assumes the caller has already checked eligibility — that entries are open,
   * the activity is not full, and the fee is what the source item says. That
   * check belongs with the domain module and is re-run at checkout; see G8.
   */
  async addItem(
    organisationId: string,
    organisationUserId: string,
    currency: string,
    item: AddCartItemDto
  ): Promise<CartItemView> {
    const quantity = item.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ValidationError('Quantity must be a whole number of at least 1');
    }
    if (!Number.isInteger(item.unitFee) || item.unitFee < 0) {
      throw new ValidationError('Fee must be a whole number of minor units');
    }

    const discount = item.discountAmount ?? 0;
    const gross = item.unitFee * quantity;
    if (discount < 0 || discount > gross) {
      throw new ValidationError('Discount cannot exceed the item fee');
    }

    const paymentMethodId = item.paymentMethodId
      ?? (await this.defaultPaymentMethodFor(item.supportedPaymentMethodIds));

    if (!item.supportedPaymentMethodIds?.includes(paymentMethodId)) {
      throw new ValidationError(
        'That payment method is not accepted for this item'
      );
    }

    const cart = await this.getOrCreateOpenCart(
      organisationId,
      organisationUserId,
      currency
    );

    const contextRef = {
      ...item.contextRef,
      supportedPaymentMethodIds: item.supportedPaymentMethodIds,
    };

    const result = await db.query(
      `INSERT INTO cart_items
        (cart_id, item_type, context_ref, description, form_submission_id,
         quantity, unit_fee, fee, payment_method_id, handling_fee_included,
         discount_id, discount_amount, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        cart.id,
        item.itemType,
        JSON.stringify(contextRef),
        item.description,
        item.formSubmissionId ?? null,
        quantity,
        item.unitFee,
        gross - discount,
        paymentMethodId,
        item.handlingFeeIncluded,
        item.discountId ?? null,
        discount,
        item.expiresAt ?? null,
      ]
    );

    await this.touch(cart.id);

    const withMethod = await db.query(
      `SELECT ci.*, pm.name AS payment_method_name, pm.display_name AS payment_method_display_name
       FROM cart_items ci JOIN payment_methods pm ON pm.id = ci.payment_method_id
       WHERE ci.id = $1`,
      [result.rows[0].id]
    );

    logger.info(`Cart item added to ${cart.id}: ${item.itemType}`);
    const [methodsById, formSummaries, calendarsById] = await Promise.all([
      this.paymentMethodsFor([withMethod.rows[0]]),
      this.formSummariesFor([withMethod.rows[0]]),
      this.calendarsFor([withMethod.rows[0]]),
    ]);
    return this.toItemView(
      withMethod.rows[0],
      new Date(),
      methodsById,
      formSummaries,
      calendarsById
    );
  }

  /**
   * Switch an item's payment method.
   *
   * Only to a method the source item declared it accepts — the list was
   * snapshotted when the item entered the cart, so a later change to the
   * source cannot retroactively widen what a member may choose.
   */
  /**
   * Which method to use when the member has not chosen one.
   *
   * A member is never asked at add time — they are adding a thing, not deciding
   * how to pay for it — so the cart picks, and the cart page lets them change
   * it before checkout.
   *
   * One supported method means there is nothing to decide. With more than one,
   * **card**, because that is the one that completes without the club having to
   * do anything: an offline default would leave a member believing they had
   * paid when the club is still waiting to record it.
   *
   * Falls back to the first supported method when a club offers several and
   * none of them is a card — an offline-only club still has to be able to sell.
   */
  private async defaultPaymentMethodFor(supportedIds: unknown): Promise<string> {
    /*
     * Defended rather than trusted. This list is whatever the source item was
     * configured with, and one catalogue mapping was handing over a bare string
     * where an array belonged — which reached Postgres as `ANY('pay-offline')`
     * and failed the whole request with "malformed array literal". A
     * misconfigured item should be a refusal the member can act on, not a 500.
     */
    const ids = (Array.isArray(supportedIds) ? supportedIds : []).filter(
      (id): id is string => typeof id === 'string' && UUID.test(id)
    );

    if (ids.length === 0) {
      throw new ValidationError('This item has no payment method configured');
    }
    if (ids.length === 1) return ids[0]!;

    const methods = await db.query(
      'SELECT id, name FROM payment_methods WHERE id = ANY($1::uuid[])',
      [ids]
    );

    const card = methods.rows.find((row) => isCardPaymentMethod(row.name));
    return card?.id ?? ids[0]!;
  }

  async setItemPaymentMethod(
    cartId: string,
    itemId: string,
    paymentMethodId: string
  ): Promise<void> {
    const existing = await db.query(
      'SELECT context_ref FROM cart_items WHERE id = $1 AND cart_id = $2',
      [itemId, cartId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Cart item not found');
    }

    const supported: string[] =
      existing.rows[0].context_ref?.supportedPaymentMethodIds || [];

    if (!supported.includes(paymentMethodId)) {
      throw new ValidationError(
        'That payment method is not accepted for this item'
      );
    }

    await db.query(
      'UPDATE cart_items SET payment_method_id = $1, updated_at = NOW() WHERE id = $2',
      [paymentMethodId, itemId]
    );
    await this.touch(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
      [itemId, cartId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Cart item not found');
    }
    await this.touch(cartId);
  }

  /** Drop items whose soft hold lapsed, once the member has been told. */
  async removeExpiredItems(cartId: string, now: Date = new Date()): Promise<number> {
    const result = await db.query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND expires_at IS NOT NULL AND expires_at <= $2',
      [cartId, now]
    );
    if (result.rowCount) await this.touch(cartId);
    return result.rowCount ?? 0;
  }

  async clear(cartId: string): Promise<void> {
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await this.touch(cartId);
  }

  private async touch(cartId: string): Promise<void> {
    await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cartId]);
  }
}

export const cartService = new CartService();
