import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { calculateAvailableSlots, AvailableSlot } from '../utils/slot-availability';
import { RENEWAL_WINDOW_DAYS } from '../utils/activity-status';

/**
 * What a member can buy — events open for entry, and membership types open to
 * join (screens D1–D6).
 *
 * **Eligibility is answered here, on the server** ([G8]). The cart deliberately
 * trusts its caller, so if this service said only "here are the events" and let
 * the client decide what was addable, a member could enter a closed or full
 * event by posting to `/cart/items` directly. Every rule that decides whether
 * something can be bought is therefore evaluated in SQL and returned as an
 * explicit reason, not inferred by the UI.
 *
 * The reasons are returned rather than the rows being filtered out. A member
 * looking for an event they know exists is better served by "entries closed on
 * 1 June" than by an empty list.
 */

export type UnavailableReason =
  | 'entries-not-open'
  | 'entries-closed'
  | 'event-full'
  | 'activity-full'
  | 'already-entered'
  /** Open to the club's members, and this login holds no active membership. */
  | 'members-only'
  /** Members-only, and every membership this login holds is already entered. */
  | 'members-all-entered'
  /** Open across the organisation type, and this person is a member of none of it. */
  | 'org-members-only'
  | 'not-open-for-applications'
  | 'already-a-member'
  | 'not-on-sale'
  | 'out-of-stock'
  | 'not-open-for-bookings'
  /** The last places are in other members' baskets, and may yet come back. */
  | 'held-by-others'
  /** The member already has this in their own basket. */
  | 'in-your-basket';

/**
 * One membership this login holds, reduced to what an entry decision needs.
 *
 * Exported because the cart enforces the same rule the catalogue displays, and
 * two definitions of "may this person enter" is one more than can stay true.
 */
export interface ActiveMembership {
  id: string;
  name: string;
  membershipTypeName: string;
  membershipNumber: string;
  /** The club it is with, when that is not the club running the event. */
  organisationName?: string | null;
}

/**
 * Every membership this login currently holds in this organisation.
 *
 * Several is normal, not exceptional: a parent holds their children's, which is
 * why the account dashboard shows a card per membership rather than the soonest
 * to expire.
 *
 * "Active" is `status = 'active'`, the same test the dashboard applies, **and**
 * a `valid_until` that has not passed. The column and the status can disagree —
 * nothing flips a row to `elapsed` at midnight — and the date is the honest
 * answer, so an expired membership cannot let someone into a members-only
 * event on the strength of a status nobody has run a job to update.
 */
export async function activeMembershipsFor(
  organisationId: string,
  organisationUserId: string,
  today: Date = new Date()
): Promise<ActiveMembership[]> {
  const result = await db.query(
    `SELECT m.id, m.first_name, m.last_name, m.membership_number,
            mt.name AS membership_type_name
       FROM members m
       JOIN membership_types mt ON mt.id = m.membership_type_id
      WHERE m.user_id = $1
        AND m.organisation_id = $2
        AND m.status = 'active'
        AND m.valid_until >= $3
      ORDER BY m.first_name, m.last_name`,
    [organisationUserId, organisationId, today]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    membershipTypeName: row.membership_type_name,
    membershipNumber: row.membership_number,
  }));
}

/**
 * Every membership this **person** holds across the whole organisation type.
 *
 * For activities open to members of any club in a federation. The awkwardness
 * is that `members.user_id` points at `organization_users`, which is *per
 * organisation* — the same human is a different row in every club they belong
 * to — so their memberships elsewhere cannot be reached from the row we have.
 *
 * The join therefore goes out through `keycloak_user_id`, which is the one
 * identifier that is the same person everywhere. Email would have been the
 * obvious alternative and is the wrong choice: it can be changed, can be shared
 * by a family, and is not what anything else in this system treats as identity.
 *
 * Scoped to the organisation type of the club whose event this is, so a
 * federation opens up to itself and no further.
 */
export async function activeMembershipsAcrossType(
  organisationId: string,
  organisationUserId: string,
  today: Date = new Date()
): Promise<ActiveMembership[]> {
  const result = await db.query(
    `SELECT m.id, m.first_name, m.last_name, m.membership_number,
            mt.name AS membership_type_name,
            o.display_name AS organisation_name,
            o.id AS organisation_id
       FROM organization_users me
       JOIN organization_users mine ON mine.keycloak_user_id = me.keycloak_user_id
       JOIN members m ON m.user_id = mine.id
       JOIN membership_types mt ON mt.id = m.membership_type_id
       JOIN organizations o ON o.id = m.organisation_id
      WHERE me.id = $1
        AND o.organization_type_id = (
              SELECT organization_type_id FROM organizations WHERE id = $2
            )
        AND m.status = 'active'
        AND m.valid_until >= $3
      ORDER BY m.first_name, m.last_name`,
    [organisationUserId, organisationId, today]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    membershipTypeName: row.membership_type_name,
    membershipNumber: row.membership_number,
    /*
     * Which club the membership is with. Shown on the entry form only when it
     * is not the club running the event — "Junior Member · Ward Union Pony
     * Club" answers a question a member entering another branch's rally will
     * otherwise ask.
     */
    organisationName: row.organisation_id === organisationId ? null : row.organisation_name,
  }));
}

export interface CatalogueActivity {
  id: string;
  name: string;
  description: string | null;
  fee: number;
  handlingFeeIncluded: boolean;
  applicationFormId: string | null;
  allowSpecifyQuantity: boolean;
  supportedPaymentMethodIds: string[];
  /**
   * The activity's own cap, or null when uncapped.
   *
   * Returned beside the remainder because before entries open the two say
   * different things: the cap is the size of the field, the remainder is a
   * countdown that has not started.
   */
  entriesLimit: number | null;
  /** Remaining places, or null when the activity is not capped. */
  placesRemaining: number | null;
  /**
   * The club's terms for this item, which a member must accept before
   * entering. Returned with the catalogue rather than fetched per item, so the
   * entry page can render them without a second round trip — they are a few
   * hundred characters, and the member is going to need them.
   */
  termsAndConditions: string | null;
  available: boolean;
  unavailableReason: UnavailableReason | null;
  /**
   * Whether this activity is restricted to the club's members.
   *
   * Sent even when the caller *is* eligible, because the entry form needs to
   * know to ask which member — availability alone cannot distinguish "open to
   * everyone" from "open to you".
   */
  membersOnly: boolean;
  /**
   * Which restriction applies, when one does.
   *
   * `membersOnly` alone cannot distinguish "this club's members" from "any club
   * in the federation", and the two need different words on a refusal and a
   * different remedy offered with it.
   */
  entryEligibility: 'all' | 'members' | 'org-type-members';
  /**
   * The caller's own active memberships, and whether each is already entered.
   *
   * Populated only for a members-only activity, and only ever with memberships
   * this login holds — it is the answer to "who may I enter?", asked of the
   * person asking. Empty for an open activity, where there is no member to
   * choose.
   */
  eligibleMembers: EligibleMember[];
}

/** One membership the caller holds, as an option on the entry form. */
export interface EligibleMember {
  id: string;
  name: string;
  membershipTypeName: string;
  membershipNumber: string;
  /** The club it is with, when that is not the club running the event. */
  organisationName?: string | null;
  /** Already entered in this activity — offered but disabled, never hidden. */
  alreadyEntered: boolean;
}

export interface CatalogueEvent {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  entriesOpenDate: string | null;
  entriesClosingDate: string | null;
  /**
   * The event-wide cap on entries, or null when uncapped.
   *
   * Exposed alongside `placesRemaining` because "12 of 50 places left" is a
   * different message from "12 places left" — a member deciding whether to
   * enter now wants to know how tight it is, and the bare remainder does not
   * say. An activity's own cap is separate and lives on the activity.
   */
  entriesLimit: number | null;
  /** Null when uncapped; 0 means full. */
  placesRemaining: number | null;
  available: boolean;
  unavailableReason: UnavailableReason | null;
  activities: CatalogueActivity[];
}

export interface CatalogueMembershipType {
  id: string;
  name: string;
  description: string | null;
  validUntil: string | null;
  membershipFormId: string | null;
  automaticallyApprove: boolean;
  /**
   * Minor units, from `membership_types.fee`.
   *
   * The price is a property of the membership type, not of its application
   * form — the basket line takes it from here, and a line priced at zero means
   * the club has genuinely set no fee.
   */
  fee: number;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  /**
   * The member already holds this, and it is close enough to expiry to renew.
   *
   * Distinguished from a fresh application so the screen can say "Renew" — and
   * so that holding one does not bar the member from taking the next year out.
   */
  isRenewal: boolean;
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/** One choice within an option — "Large", "Navy" — and what it costs. */
export interface CatalogueOptionValue {
  id: string;
  name: string;
  /** Minor units. The price of the item is the sum of the chosen values. */
  price: number;
  /** Null when the club does not track stock for this item. */
  stockQuantity: number | null;
}

export interface CatalogueOptionType {
  id: string;
  name: string;
  values: CatalogueOptionValue[];
}

export interface CatalogueMerchandise {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  /**
   * The price of the cheapest combination, in minor units.
   *
   * A club sells "a club polo" at one price per size, so the list needs a
   * number before any option has been chosen. It is a *from* price and the
   * screen says so; the real price follows from the options.
   */
  fromPrice: number;
  optionTypes: CatalogueOptionType[];
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  quantityIncrements: number | null;
  /** `free` | `fixed` | `quantity_based` — how delivery is priced. */
  deliveryType: string;
  /** Minor units, for `fixed`. Quantity-based rules are priced server-side. */
  deliveryFee: number;
  trackStockLevels: boolean;
  applicationFormId: string | null;
  termsAndConditions: string | null;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/**
 * Something a member can register — a horse, a boat, a dog (D7, D8).
 *
 * `entityName` is the club's word for the thing being registered, and the
 * screens use it verbatim: "Register your horse", "Horse name". A registration
 * scheme with no word for what it registers is unreadable.
 */
export interface CatalogueRegistrationType {
  id: string;
  name: string;
  description: string | null;
  entityName: string;
  registrationFormId: string | null;
  /** Rolling runs N months from the day it is taken out; fixed ends on a date. */
  isRollingRegistration: boolean;
  validUntil: string | null;
  numberOfMonths: number | null;
  /** False means the club reviews it — the member waits rather than being in. */
  automaticallyApprove: boolean;
  /** Minor units. */
  fee: number;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  termsAndConditions: string | null;
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/** A bookable resource — a court, a mooring, a room (D11). */
export interface CatalogueCalendar {
  id: string;
  name: string;
  description: string | null;
  displayColour: string | null;
  /** A Material icon name the club chose; null falls back to a generic marker. */
  displayIcon: string | null;
  /** The club's notice period, and how far ahead it will take a booking. */
  minDaysInAdvance: number;
  maxDaysInAdvance: number;
  allowCancellations: boolean;
  cancelDaysInAdvance: number | null;
  termsAndConditions: string | null;
  supportedPaymentMethodIds: string[];
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/**
 * The end of the window in which a membership counts as renewable.
 *
 * The same 30 days C4 uses to decide whether to offer the button, shared
 * through `activity-status` so the two cannot disagree — a screen offering a
 * renewal the catalogue then refuses is the worst of both.
 */
const renewalWindowEnd = (today: Date): Date => {
  const end = new Date(today);
  end.setDate(end.getDate() + RENEWAL_WINDOW_DAYS);
  return end;
};

/** Decimal money out of the database, minor units everywhere else. */
const toMinorUnits = (value: unknown): number =>
  value === null || value === undefined ? 0 : Math.round(Number(value) * 100);

/** JSONB that is sometimes stored double-encoded (see `merchandise.service`). */
const parseJsonArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseImages = (value: unknown): string[] =>
  parseJsonArray(value).filter((image): image is string => typeof image === 'string');

/**
 * The cheapest way to buy this item, in minor units.
 *
 * Each option type contributes its cheapest value, because the price is their
 * sum. An item with no options priced at zero is a club that has not finished
 * setting it up; it is left to the availability rules to refuse.
 */
const cheapestCombination = (optionTypes: CatalogueOptionType[]): number =>
  optionTypes.reduce((total, type) => {
    if (type.values.length === 0) return total;
    return total + Math.min(...type.values.map((value) => value.price));
  }, 0);

/** Whether anything is left, for an item whose club tracks stock. */
const hasStock = (optionTypes: CatalogueOptionType[]): boolean =>
  optionTypes.every((type) =>
    type.values.some((value) => value.stockQuantity === null || value.stockQuantity > 0)
  );

const merchandiseUnavailableReason = (
  row: any,
  optionTypes: CatalogueOptionType[]
): UnavailableReason | null => {
  if (row.status !== 'active') return 'not-on-sale';
  // Nothing to choose from is not something a member can buy.
  if (optionTypes.length === 0 || optionTypes.some((type) => type.values.length === 0)) {
    return 'not-on-sale';
  }
  if (row.track_stock_levels && !hasStock(optionTypes)) return 'out-of-stock';
  return null;
};

export class AccountCatalogueService {
  /**
   * Events a member can enter, with per-activity availability.
   *
   * Published events only. A draft is a club's working copy and must not be
   * visible to members at all — that is a visibility rule, not an availability
   * one, so drafts are excluded rather than returned as unavailable.
   */
  async listEvents(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date(),
    options: {
      /**
       * Leave the member's own basket holds out of the capacity sum.
       *
       * Set only where the caller is redeeming that hold — capture-time and
       * fulfilment re-checks — because counting it would have a member's own
       * reservation report the activity full and refuse the entry it exists to
       * guarantee.
       */
      excludeOwnHolds?: boolean;
    } = {}
  ): Promise<CatalogueEvent[]> {
    try {
      const events = await db.query(
        `SELECT e.id, e.name, e.description, e.start_date, e.end_date,
                e.open_date_entries, e.entries_closing_date,
                e.limit_entries, e.entries_limit,
                (SELECT COUNT(*) FROM event_entries ee WHERE ee.event_id = e.id) AS entry_count
         FROM events e
         WHERE e.organisation_id = $1
           AND e.status = 'published'
           AND e.deleted = FALSE
           AND (e.end_date IS NULL OR e.end_date >= $2)
         ORDER BY e.start_date ASC NULLS LAST`,
        [organisationId, today]
      );

      if (events.rows.length === 0) return [];

      const eventIds = events.rows.map((row) => row.id);

      const activities = await db.query(
        `SELECT a.id, a.event_id, a.name, a.description, a.fee,
                a.handling_fee_included, a.application_form_id,
                a.allow_specify_quantity, a.supported_payment_methods,
                a.limit_applicants, a.applicants_limit,
                a.use_terms_and_conditions, a.terms_and_conditions,
                a.entry_eligibility,
                (SELECT COUNT(*) FROM event_entries ee WHERE ee.event_activity_id = a.id)
                  AS entry_count,
                (SELECT COUNT(*) FROM event_entries ee
                  WHERE ee.event_activity_id = a.id AND ee.user_id = $2) AS mine
         FROM event_activities a
         WHERE a.event_id = ANY($1::uuid[])
           AND a.show_publicly = TRUE
         ORDER BY a.created_at ASC`,
        [eventIds, organisationUserId]
      );

      /*
       * Who this login could enter as, loaded once for the whole catalogue.
       *
       * Only when something actually restricts entry — most clubs restrict
       * nothing, and a page of open events should not pay for a membership
       * lookup it will not read.
       */
      const ownOnly = activities.rows.some((row) => row.entry_eligibility === 'members');
      const acrossType = activities.rows.some(
        (row) => row.entry_eligibility === 'org-type-members'
      );

      /*
       * Two sets, because the two restrictions ask different questions.
       *
       * The wider set is a superset of the narrower — every membership of this
       * club is also a membership within its type — but they cannot be merged:
       * a "members only" activity must not be opened by a membership of a
       * different branch, which is exactly what using the wider set for both
       * would do.
       *
       * Loaded only when something actually restricts entry. Most clubs
       * restrict nothing, and a page of open events should not pay for a
       * membership lookup it will not read.
       */
      const myMembers = ownOnly
        ? await activeMembershipsFor(organisationId, organisationUserId, today)
        : [];
      const myTypeMembers = acrossType
        ? await activeMembershipsAcrossType(organisationId, organisationUserId, today)
        : [];

      /*
       * Which of those are already entered, per activity.
       *
       * Per member rather than per login: a parent may enter each child once,
       * so the account-level `mine` count cannot answer this.
       */
      const enteredByActivity = new Map<string, Set<string>>();
      const allMyMemberIds = [
        ...new Set([...myMembers, ...myTypeMembers].map((member) => member.id)),
      ];
      if (allMyMemberIds.length > 0) {
        const entered = await db.query(
          `SELECT event_activity_id, member_id
             FROM event_entries
            WHERE event_activity_id = ANY($1::uuid[])
              AND member_id = ANY($2::uuid[])`,
          [activities.rows.map((row) => row.id), allMyMemberIds]
        );
        for (const row of entered.rows) {
          const set = enteredByActivity.get(row.event_activity_id) ?? new Set<string>();
          set.add(row.member_id);
          enteredByActivity.set(row.event_activity_id, set);
        }
      }

      const byEvent = new Map<string, any[]>();
      for (const row of activities.rows) {
        const list = byEvent.get(row.event_id) ?? [];
        list.push(row);
        byEvent.set(row.event_id, list);
      }

      /*
       * Live basket holds against these activities.
       *
       * The same mechanism as a court: an entry sitting in somebody's basket is
       * a place nobody else can have, until the hold lapses of its own accord.
       * `SUM(quantity)` rather than a row count because an activity that lets a
       * member enter several at once takes several places with one line.
       */
      const entryHolds = await db.query(
        `SELECT ci.context_ref->>'activityId' AS activity_id,
                c.user_id,
                COALESCE(SUM(ci.quantity), 0)::int AS places
         FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE c.organisation_id = $1
           AND c.status = 'open'
           AND ci.item_type = 'event_entry'
           AND ci.expires_at IS NOT NULL
           AND ci.expires_at > NOW()
           AND ci.context_ref->>'activityId' = ANY($2::text[])
         GROUP BY 1, 2`,
        [organisationId, activities.rows.map((row) => row.id)]
      );

      /** activity id → places held in total, and how many of them the member's own. */
      const heldByActivity = new Map<string, { total: number; mine: number }>();
      for (const row of entryHolds.rows) {
        const isMine = row.user_id === organisationUserId;
        if (isMine && options.excludeOwnHolds) continue;

        const held = heldByActivity.get(row.activity_id) ?? { total: 0, mine: 0 };
        held.total += Number(row.places);
        if (isMine) held.mine += Number(row.places);
        heldByActivity.set(row.activity_id, held);
      }

      return events.rows.map((event) => {
        const capped = event.limit_entries && event.entries_limit !== null;

        // An event's cap is spent by holds against any of its activities.
        const eventHeld = (byEvent.get(event.id) ?? []).reduce(
          (total, activity) => total + (heldByActivity.get(activity.id)?.total ?? 0),
          0
        );

        const eventReason = this.eventUnavailableReason(event, today, eventHeld);

        return {
          id: event.id,
          name: event.name,
          description: event.description ?? null,
          startDate: event.start_date ?? null,
          endDate: event.end_date ?? null,
          entriesOpenDate: event.open_date_entries ?? null,
          entriesClosingDate: event.entries_closing_date ?? null,
          entriesLimit: capped ? Number(event.entries_limit) : null,
          placesRemaining: capped
            ? Math.max(
                0,
                Number(event.entries_limit) - Number(event.entry_count) - eventHeld
              )
            : null,
          available: eventReason === null,
          unavailableReason: eventReason,
          activities: (byEvent.get(event.id) ?? []).map((activity) =>
            this.toActivity(
              activity,
              eventReason,
              heldByActivity.get(activity.id) ?? { total: 0, mine: 0 },
              activity.entry_eligibility === 'org-type-members' ? myTypeMembers : myMembers,
              enteredByActivity.get(activity.id) ?? new Set<string>()
            )
          ),
        };
      });
    } catch (error) {
      logger.error('Failed to list the event catalogue:', error);
      throw error;
    }
  }

  /**
   * Why a member cannot enter this event, or null.
   *
   * Order matters: a closed event is closed whether or not it is also full, and
   * "entries closed on 1 June" is the more useful thing to be told.
   */
  private eventUnavailableReason(
    event: any,
    today: Date,
    /** Places against this event's cap sitting in baskets right now. */
    held: number = 0
  ): UnavailableReason | null {
    if (event.open_date_entries && new Date(event.open_date_entries) > today) {
      return 'entries-not-open';
    }
    if (event.entries_closing_date && new Date(event.entries_closing_date) < today) {
      return 'entries-closed';
    }
    if (event.limit_entries && event.entries_limit !== null) {
      const taken = Number(event.entry_count);
      const limit = Number(event.entries_limit);

      // Genuinely gone before holds are counted: nothing is coming back.
      if (taken >= limit) return 'event-full';
      /*
       * Only the holds stand between the member and a place. Worded as held
       * rather than full because it may well free up in a minute or two, and a
       * member told "full" goes away for good.
       */
      if (taken + held >= limit) return 'held-by-others';
    }
    return null;
  }

  private toActivity(
    row: any,
    eventReason: UnavailableReason | null,
    held: { total: number; mine: number } = { total: 0, mine: 0 },
    myMembers: ActiveMembership[] = [],
    enteredMemberIds: Set<string> = new Set()
  ): CatalogueActivity {
    const capped = row.limit_applicants && row.applicants_limit !== null;
    const taken = Number(row.entry_count);
    const limit = Number(row.applicants_limit);
    const placesRemaining = capped ? Math.max(0, limit - taken - held.total) : null;

    /*
     * The event's own reason wins — an activity with places left in a closed
     * event is still not enterable, and saying "3 places left" beside a button
     * that refuses would be worse than saying nothing.
     */
    const eligibility: 'all' | 'members' | 'org-type-members' =
      row.entry_eligibility === 'members' || row.entry_eligibility === 'org-type-members'
        ? row.entry_eligibility
        : 'all';
    const membersOnly = eligibility !== 'all';
    const acrossType = eligibility === 'org-type-members';
    const eligibleMembers: EligibleMember[] = membersOnly
      ? myMembers.map((member) => ({
          id: member.id,
          name: member.name,
          membershipTypeName: member.membershipTypeName,
          membershipNumber: member.membershipNumber,
          organisationName: member.organisationName ?? null,
          alreadyEntered: enteredMemberIds.has(member.id),
        }))
      : [];

    let reason: UnavailableReason | null = eventReason;

    /*
     * Placed above the account-level "already entered" on purpose. Not holding
     * a membership is the more fundamental fact, and reporting it first tells
     * someone whose membership lapsed why the activity closed to them, rather
     * than a capacity message that would send them looking for a place that
     * exists.
     */
    if (!reason && membersOnly && eligibleMembers.length === 0) {
      // Different words for a different remedy: one is "renew here", the other
      // is "join any club in the federation".
      reason = acrossType ? 'org-members-only' : 'members-only';
    }
    if (!reason && membersOnly && eligibleMembers.every((member) => member.alreadyEntered)) {
      reason = 'members-all-entered';
    }

    /*
     * The account-level duplicate check applies to open activities only.
     *
     * On a members-only activity the question is per member — a parent must be
     * able to enter each child once — and that is answered above. Keeping this
     * here as well would block the second child on the strength of the first.
     */
    if (!reason && !membersOnly && Number(row.mine) > 0) reason = 'already-entered';
    /*
     * A member's own hold is called what it is. They cannot enter twice, but
     * "in your basket" sends them to the basket, where "full" would send them
     * away from an entry they have already got.
     */
    if (!reason && held.mine > 0) reason = 'in-your-basket';
    if (!reason && placesRemaining === 0) {
      // Held rather than full whenever a lapsing hold would bring it back.
      reason = capped && taken < limit ? 'held-by-others' : 'activity-full';
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      fee: row.fee === null ? 0 : Math.round(Number(row.fee) * 100),
      handlingFeeIncluded: row.handling_fee_included ?? false,
      applicationFormId: row.application_form_id ?? null,
      allowSpecifyQuantity: row.allow_specify_quantity ?? false,
      /*
       * `supported_payment_methods`, the jsonb list of method ids — the same
       * column memberships, merchandise and calendars read.
       *
       * This used to read `allowed_payment_method`, which is a *single* value
       * (`any` / `pay-offline` / `stripe`) rather than a list. Assigning it to
       * a `string[]` gave every activity a string where an array belonged, so
       * `includes()` did substring matching and the cart's `ANY($1::uuid[])`
       * was handed a bare slug — a 500 with "malformed array literal".
       */
      supportedPaymentMethodIds: parseJsonArray(row.supported_payment_methods),
      entriesLimit: capped ? Number(row.applicants_limit) : null,
      placesRemaining,
      // Only when the club has switched them on: stale text left in the column
      // from a previous configuration is not a set of terms anyone agreed to
      // present.
      termsAndConditions: row.use_terms_and_conditions ? row.terms_and_conditions ?? null : null,
      available: reason === null,
      unavailableReason: reason,
      membersOnly,
      /** Which restriction, for a screen that must word the refusal correctly. */
      entryEligibility: eligibility,
      eligibleMembers,
    };
  }

  /**
   * Membership types a member can apply for.
   *
   * A type the member already holds an active membership of is returned as
   * unavailable rather than hidden — "you are already a member" is the answer
   * they are looking for.
   */
  async listMembershipTypes(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date()
  ): Promise<CatalogueMembershipType[]> {
    try {
      const result = await db.query(
        `SELECT mt.id, mt.name, mt.description, mt.valid_until,
                mt.membership_form_id, mt.automatically_approve,
                mt.membership_status, mt.supported_payment_methods,
                mt.fee, mt.handling_fee_included,
                mt.use_terms_and_conditions, mt.terms_and_conditions,
                (SELECT COUNT(*) FROM members m
                  WHERE m.membership_type_id = mt.id
                    AND m.user_id = $2
                    AND m.status = 'active'
                    AND m.valid_until >= $3) AS mine,
                /*
                 * Of those, how many are close enough to expiry to renew.
                 *
                 * Holding a membership normally bars applying for it again —
                 * but a member whose year is nearly up is not applying, they
                 * are renewing, and refusing them is how C4's Renew button
                 * ended up leading nowhere.
                 */
                (SELECT COUNT(*) FROM members m
                  WHERE m.membership_type_id = mt.id
                    AND m.user_id = $2
                    AND m.status = 'active'
                    AND m.valid_until >= $3
                    AND m.valid_until <= $4) AS renewable
         FROM membership_types mt
         WHERE mt.organisation_id = $1 AND mt.deleted = FALSE
         ORDER BY mt.name ASC`,
        [organisationId, organisationUserId, today, renewalWindowEnd(today)]
      );

      return result.rows.map((row) => {
        const mine = Number(row.mine);
        const renewable = Number(row.renewable);
        /*
         * Every membership of this type the member holds is nearly up, so this
         * is a renewal rather than a fresh application. If they hold two and
         * only one is expiring, the other still bars it — they would end up
         * with overlapping cover they did not ask for.
         */
        const isRenewal = mine > 0 && renewable === mine;

        let reason: UnavailableReason | null = null;

        /*
         * `'open'`, which is the word this column actually uses.
         *
         * The column defaults to `'open'` (migration `1707000000006`), the
         * org-admin form writes `'open'` and `'closed'`, and
         * `account-activity.service` selects on `membership_status = 'open'`.
         * This line alone tested for `'active'`, so it was true of every row —
         * every membership type in every club read as not open for
         * applications, and no member could apply for or pay for one. A
         * vocabulary used in one place and checked in another is how that
         * survives: nothing fails, the list simply comes back all-refused.
         */
        if (row.membership_status !== 'open') {
          reason = 'not-open-for-applications';
        } else if (row.valid_until && new Date(row.valid_until) < today) {
          // The period this type covers has already ended.
          reason = 'not-open-for-applications';
        } else if (mine > 0 && !isRenewal) {
          reason = 'already-a-member';
        }

        return {
          id: row.id,
          name: row.name,
          description: row.description ?? null,
          validUntil: row.valid_until ?? null,
          membershipFormId: row.membership_form_id ?? null,
          automaticallyApprove: row.automatically_approve ?? false,
          // `fee` is decimal in the database and minor units everywhere the
          // money arithmetic runs, so it is converted once, here.
          fee: row.fee === null || row.fee === undefined ? 0 : Math.round(Number(row.fee) * 100),
          handlingFeeIncluded: row.handling_fee_included ?? false,
          supportedPaymentMethodIds: row.supported_payment_methods ?? [],
          termsAndConditions: row.use_terms_and_conditions
            ? row.terms_and_conditions ?? null
            : null,
          isRenewal,
          available: reason === null,
          unavailableReason: reason,
        };
      });
    } catch (error) {
      logger.error('Failed to list membership types:', error);
      throw error;
    }
  }

  /**
   * What the club sells (D9, D10).
   *
   * Options and their values come back with the item rather than behind a
   * second request: the price *is* the sum of the chosen values, so a list that
   * cannot say "from €25" and a detail screen that cannot price a size are both
   * useless. It is two queries for the whole catalogue, not two per item.
   *
   * **`hide` is the only reason a row is dropped.** It is the club's explicit
   * instruction for what to do when stock runs out. Everything else — withdrawn,
   * sold out — comes back with a reason, because a member looking for the polo
   * they were told about is better served by "out of stock" than by a page that
   * acts as though it never existed.
   */
  async listMerchandise(organisationId: string): Promise<CatalogueMerchandise[]> {
    try {
      const items = await db.query(
        `SELECT id, name, description, images, status, track_stock_levels,
                out_of_stock_behavior, delivery_type, delivery_fee,
                min_order_quantity, max_order_quantity, quantity_increments,
                require_application_form, application_form_id,
                supported_payment_methods, handling_fee_included,
                use_terms_and_conditions, terms_and_conditions
         FROM merchandise_types
         WHERE organisation_id = $1 AND deleted = FALSE
         ORDER BY name ASC`,
        [organisationId]
      );

      if (items.rows.length === 0) return [];

      const itemIds = items.rows.map((row) => row.id);
      const optionTypes = await db.query(
        `SELECT ot.id, ot.merchandise_type_id, ot.name, ot."order",
                ov.id AS value_id, ov.name AS value_name, ov.price,
                ov.stock_quantity, ov."order" AS value_order
         FROM merchandise_option_types ot
         LEFT JOIN merchandise_option_values ov ON ov.option_type_id = ot.id
         WHERE ot.merchandise_type_id = ANY($1)
         ORDER BY ot."order", ov."order"`,
        [itemIds]
      );

      const optionsByItem = new Map<string, CatalogueOptionType[]>();
      for (const row of optionTypes.rows) {
        const forItem = optionsByItem.get(row.merchandise_type_id) ?? [];
        let optionType = forItem.find((type) => type.id === row.id);
        if (!optionType) {
          optionType = { id: row.id, name: row.name, values: [] };
          forItem.push(optionType);
        }
        // The LEFT JOIN yields a row for an option type with no values yet.
        if (row.value_id) {
          optionType.values.push({
            id: row.value_id,
            name: row.value_name,
            price: toMinorUnits(row.price),
            stockQuantity: row.stock_quantity ?? null,
          });
        }
        optionsByItem.set(row.merchandise_type_id, forItem);
      }

      return items.rows
        .map((row) => {
          const itemOptions = optionsByItem.get(row.id) ?? [];
          const reason = merchandiseUnavailableReason(row, itemOptions);

          return {
            hideWhenSoldOut: row.out_of_stock_behavior === 'hide',
            id: row.id,
            name: row.name,
            description: row.description ?? null,
            images: parseImages(row.images),
            fromPrice: cheapestCombination(itemOptions),
            optionTypes: itemOptions,
            minOrderQuantity: row.min_order_quantity ?? 1,
            maxOrderQuantity: row.max_order_quantity ?? null,
            quantityIncrements: row.quantity_increments ?? null,
            deliveryType: row.delivery_type ?? 'free',
            deliveryFee: toMinorUnits(row.delivery_fee),
            trackStockLevels: row.track_stock_levels ?? false,
            applicationFormId: row.require_application_form
              ? row.application_form_id ?? null
              : null,
            termsAndConditions: row.use_terms_and_conditions
              ? row.terms_and_conditions ?? null
              : null,
            handlingFeeIncluded: row.handling_fee_included ?? false,
            supportedPaymentMethodIds: parseJsonArray(row.supported_payment_methods),
            available: reason === null,
            unavailableReason: reason,
          };
        })
        // `hide` is the club's instruction for a sold-out item, and the only
        // reason anything leaves the catalogue.
        .filter((item) => !(item.hideWhenSoldOut && item.unavailableReason === 'out-of-stock'))
        .map(({ hideWhenSoldOut, ...item }) => item);
    } catch (error) {
      logger.error('Failed to list merchandise:', error);
      throw error;
    }
  }

  /**
   * Registration types a member can register something for (D7, D8).
   *
   * **A registration is of a *thing*, not of a person** — a horse, a boat, a
   * dog. `entity_name` on the type is the club's word for that thing, and the
   * screen asks for one by that name rather than for "a registration". It is
   * the difference between "Register your horse" and a form nobody understands.
   *
   * Unlike a membership, holding one already is no bar to another: a member with
   * two horses registers twice.
   */
  async listRegistrationTypes(
    organisationId: string,
    today: Date = new Date()
  ): Promise<CatalogueRegistrationType[]> {
    try {
      const result = await db.query(
        `SELECT rt.id, rt.name, rt.description, rt.entity_name, rt.registration_form_id,
                rt.registration_status, rt.is_rolling_registration, rt.valid_until,
                rt.number_of_months, rt.automatically_approve, rt.fee,
                rt.handling_fee_included, rt.supported_payment_methods,
                rt.use_terms_and_conditions, rt.terms_and_conditions
         FROM registration_types rt
         WHERE rt.organisation_id = $1 AND rt.deleted = FALSE
         ORDER BY rt.name ASC`,
        [organisationId]
      );

      return result.rows.map((row) => {
        let reason: UnavailableReason | null = null;

        if (row.registration_status !== 'open') {
          reason = 'not-open-for-applications';
        } else if (
          // A fixed-period scheme whose period has ended. A rolling one runs
          // from the day it is taken out, so `valid_until` says nothing.
          !row.is_rolling_registration &&
          row.valid_until &&
          new Date(row.valid_until) < today
        ) {
          reason = 'not-open-for-applications';
        }

        return {
          id: row.id,
          name: row.name,
          description: row.description ?? null,
          entityName: row.entity_name,
          registrationFormId: row.registration_form_id ?? null,
          isRollingRegistration: row.is_rolling_registration ?? false,
          validUntil: row.is_rolling_registration ? null : row.valid_until ?? null,
          numberOfMonths: row.is_rolling_registration ? row.number_of_months ?? null : null,
          automaticallyApprove: row.automatically_approve ?? false,
          fee: toMinorUnits(row.fee),
          handlingFeeIncluded: row.handling_fee_included ?? false,
          supportedPaymentMethodIds: parseJsonArray(row.supported_payment_methods),
          termsAndConditions: row.use_terms_and_conditions
            ? row.terms_and_conditions ?? null
            : null,
          available: reason === null,
          unavailableReason: reason,
        };
      });
    } catch (error) {
      logger.error('Failed to list registration types:', error);
      throw error;
    }
  }

  /** Re-check a registration type at the moment of adding it to the cart. */
  async assertRegistrationTypeAvailable(
    organisationId: string,
    registrationTypeId: string,
    entityName: unknown,
    today: Date = new Date()
  ): Promise<CatalogueRegistrationType> {
    const type = (await this.listRegistrationTypes(organisationId, today)).find(
      (candidate) => candidate.id === registrationTypeId
    );

    if (!type) {
      throw new ValidationError('That registration is no longer offered');
    }
    if (!type.available) {
      throw new ValidationError('That registration is not open at the moment');
    }
    /*
     * `registrations.entity_name` is NOT NULL and is the whole point of the
     * record — a registration with no horse named on it is not a registration.
     * Refusing here beats failing at fulfilment, after the money.
     */
    if (typeof entityName !== 'string' || entityName.trim().length === 0) {
      throw new ValidationError(`Give the name of the ${type.entityName.toLowerCase()}`);
    }

    return type;
  }

  /**
   * Calendars a member can book against (D11).
   *
   * Only the club's terms, its notice period and whether it takes bookings at
   * all — no availability. Working out free slots means reading a calendar's
   * schedule, its blocks and every booking on it, which is per-calendar work
   * and belongs to the screen that shows one.
   */
  async listCalendars(organisationId: string): Promise<CatalogueCalendar[]> {
    try {
      const result = await db.query(
        `SELECT c.id, c.name, c.description, c.display_colour, c.display_icon, c.status,
                c.min_days_in_advance, c.max_days_in_advance,
                c.use_terms_and_conditions, c.terms_and_conditions,
                c.supported_payment_methods, c.allow_cancellations,
                c.cancel_days_in_advance,
                (SELECT COUNT(*) FROM time_slot_configurations tsc
                  WHERE tsc.calendar_id = c.id) AS configuration_count
         FROM calendars c
         WHERE c.organisation_id = $1 AND c.deleted = FALSE
         ORDER BY c.name ASC`,
        [organisationId]
      );

      return result.rows.map((row) => {
        /*
         * A calendar with no schedule can produce no slot, so it is not
         * bookable however open the club has marked it.
         *
         * `open`, not `active`: those are the only two values the column takes
         * (`calendar.service` writes `open` by default and the type union is
         * `open | closed`). Testing for `active` matched nothing, so every
         * calendar came back unbookable.
         */
        const reason: UnavailableReason | null =
          row.status !== 'open' || Number(row.configuration_count) === 0
            ? 'not-open-for-bookings'
            : null;

        return {
          id: row.id,
          name: row.name,
          description: row.description ?? null,
          displayColour: row.display_colour ?? null,
          displayIcon: row.display_icon ?? null,
          minDaysInAdvance: row.min_days_in_advance ?? 0,
          maxDaysInAdvance: row.max_days_in_advance ?? 90,
          allowCancellations: row.allow_cancellations ?? false,
          cancelDaysInAdvance: row.cancel_days_in_advance ?? null,
          termsAndConditions: row.use_terms_and_conditions
            ? row.terms_and_conditions ?? null
            : null,
          supportedPaymentMethodIds: parseJsonArray(row.supported_payment_methods),
          available: reason === null,
          unavailableReason: reason,
        };
      });
    } catch (error) {
      logger.error('Failed to list calendars:', error);
      throw error;
    }
  }

  /**
   * What is free on one calendar between two dates (D12).
   *
   * Availability is **derived, never stored** — the schedule, the blocks, the
   * bookings and the live holds are read and subtracted by
   * `calculateAvailableSlots`. That is why this cannot be a simple query: there
   * is no table of slots to select from.
   *
   * Unavailable slots come back with a reason rather than being dropped. A
   * member looking at a Saturday needs to see that it is taken, not an empty
   * morning that reads as "the club is closed".
   */
  async listCalendarAvailability(
    organisationId: string,
    calendarId: string,
    from: string,
    to: string,
    today: Date = new Date(),
    /**
     * The member the calendar is being drawn for, so their own basket holds can
     * be worded as theirs. Omitted by callers with no member in hand, which
     * then see every hold as somebody else's — the safe reading.
     */
    viewerId?: string,
    /**
     * Leave the viewer's own holds out of the sum altogether.
     *
     * Fulfilment is redeeming the member's hold, so counting it would have the
     * hold block the booking it exists to guarantee — and it takes places, so
     * merely relabelling the reason would still leave the slot looking full.
     */
    excludeViewerHolds = false
  ): Promise<{ calendar: CatalogueCalendar; slots: AvailableSlot[] }> {
    const calendar = (await this.listCalendars(organisationId)).find(
      (candidate) => candidate.id === calendarId
    );

    if (!calendar) {
      throw new NotFoundError('Calendar not found');
    }

    const [configurations, blocked, bookings, reservations, holds] = await Promise.all([
      db.query(
        `SELECT tsc.id, tsc.days_of_week, tsc.start_time, tsc.effective_date_start,
                tsc.effective_date_end, tsc.recurrence_weeks, tsc.places_available,
                tsc.min_places_required,
                COALESCE(
                  json_agg(
                    json_build_object('duration', d.duration, 'price', d.price, 'label', d.label)
                    ORDER BY d."order"
                  ) FILTER (WHERE d.id IS NOT NULL),
                  '[]'
                ) AS duration_options
         FROM time_slot_configurations tsc
         LEFT JOIN duration_options d ON d.time_slot_configuration_id = tsc.id
         WHERE tsc.calendar_id = $1
         GROUP BY tsc.id
         ORDER BY tsc."order"`,
        [calendarId]
      ),
      db.query(
        `SELECT block_type, start_date, end_date, days_of_week, start_time, end_time
         FROM blocked_periods WHERE calendar_id = $1`,
        [calendarId]
      ),
      db.query(
        `SELECT booking_date, start_time, duration, places_booked, booking_status
         FROM bookings
         WHERE calendar_id = $1 AND booking_date BETWEEN $2 AND $3`,
        [calendarId, from, to]
      ),
      db.query(
        `SELECT slot_date, start_time, duration
         FROM slot_reservations
         WHERE calendar_id = $1 AND slot_date BETWEEN $2 AND $3`,
        [calendarId, from, to]
      ),
      /*
       * Live basket holds on this calendar.
       *
       * `expires_at > NOW()` is what makes the hold lapse: nothing sweeps the
       * table, an abandoned basket simply stops counting. The cart must still
       * be open — once it becomes `ordered` the line has been paid for and a
       * real booking stands behind it, so counting the hold as well would take
       * the slot out twice.
       */
      db.query(
        `SELECT ci.context_ref, ci.expires_at, c.user_id,
                (ci.expires_at IS NOT NULL AND ci.expires_at > NOW()) AS live
         FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE c.organisation_id = $1
           AND c.status = 'open'
           AND ci.item_type = 'booking'
           AND ci.context_ref->>'calendarId' = $2
           AND ci.context_ref->>'date' BETWEEN $3 AND $4
           AND (
             -- Somebody else's basket only counts while the hold stands; once it
             -- lapses the slot is genuinely back on sale.
             ci.expires_at > NOW()
             -- The viewer's own line counts either way. It is in their basket
             -- until they remove it or check out, and the add guard refuses a
             -- second copy regardless of the clock — so showing it as free was
             -- the screen contradicting itself.
             OR c.user_id = $5
           )`,
        [organisationId, calendarId, from, to, viewerId ?? null]
      ),
    ]);

    const slots = calculateAvailableSlots({
      configurations: configurations.rows.map((row) => ({
        daysOfWeek: parseJsonArray(row.days_of_week).map(Number),
        startTime: String(row.start_time),
        effectiveDateStart: row.effective_date_start ?? null,
        effectiveDateEnd: row.effective_date_end ?? null,
        recurrenceWeeks: row.recurrence_weeks ?? 1,
        placesAvailable: row.places_available ?? 1,
        minPlacesRequired: row.min_places_required ?? null,
        durationOptions: (row.duration_options ?? []).map((option: any) => ({
          duration: Number(option.duration),
          // Decimal in the database, minor units everywhere the money runs.
          price: Math.round(Number(option.price ?? 0) * 100),
          label: option.label ?? null,
        })),
      })),
      blockedPeriods: blocked.rows.map((row) => ({
        blockType: row.block_type,
        startDate: row.start_date ?? null,
        endDate: row.end_date ?? null,
        daysOfWeek: row.days_of_week ? parseJsonArray(row.days_of_week).map(Number) : null,
        startTime: row.start_time ?? null,
        endTime: row.end_time ?? null,
      })),
      bookings: bookings.rows.map((row) => ({
        bookingDate: row.booking_date,
        startTime: String(row.start_time),
        duration: Number(row.duration),
        placesBooked: Number(row.places_booked ?? 1),
        bookingStatus: row.booking_status,
      })),
      reservations: reservations.rows.map((row) => ({
        slotDate: row.slot_date,
        startTime: String(row.start_time),
        duration: Number(row.duration),
      })),
      holds: holds.rows
        .filter(
          (row) => !(excludeViewerHolds && Boolean(viewerId) && row.user_id === viewerId)
        )
        .map((row) => {
          const ref = (row.context_ref ?? {}) as Record<string, any>;
          return {
            slotDate: String(ref.date),
            startTime: String(ref.startTime),
            duration: Number(ref.duration),
            places: Number(ref.places ?? 1),
            heldByViewer: Boolean(viewerId) && row.user_id === viewerId,
            live: Boolean(row.live),
            expiresAt: new Date(row.expires_at).toISOString(),
          };
        }),
      from,
      to,
      minDaysInAdvance: calendar.minDaysInAdvance,
      maxDaysInAdvance: calendar.maxDaysInAdvance,
      today,
    });

    return { calendar, slots };
  }

  /**
   * Re-check one slot at the moment of adding it to the cart.
   *
   * The screen the member is looking at is a snapshot, and a court is exactly
   * the thing two people want at once. This asks the same question again, for
   * the one day in question, and refuses with the reason.
   */
  async assertSlotAvailable(
    organisationId: string,
    calendarId: string,
    date: string,
    startTime: string,
    duration: number,
    places: number,
    today: Date = new Date(),
    /**
     * The member asking.
     *
     * Passing them lets their own basket hold be told apart from a stranger's,
     * which matters twice: adding the same slot again is refused with "it is
     * already in your basket", and fulfilment — which is redeeming that very
     * hold — must not be blocked by it. See `ignoreViewerHold`.
     */
    viewerId?: string,
    /**
     * Treat the viewer's own hold as no obstacle.
     *
     * Set only by fulfilment, where the hold being checked against *is* the one
     * being turned into a booking. Everywhere else a member's own hold should
     * stop them taking the slot twice.
     */
    ignoreViewerHold = false
  ): Promise<{ calendar: CatalogueCalendar; slot: AvailableSlot }> {
    const { calendar, slots } = await this.listCalendarAvailability(
      organisationId,
      calendarId,
      date,
      date,
      today,
      viewerId,
      ignoreViewerHold
    );

    if (!calendar.available) {
      throw new ValidationError('That calendar is not taking bookings');
    }

    const slot = slots.find(
      (candidate) =>
        candidate.startTime === String(startTime).slice(0, 5) && candidate.duration === duration
    );

    if (!slot) {
      throw new ValidationError('That slot is not on this calendar');
    }
    if (!slot.available) {
      throw new ValidationError(
        slot.unavailableReason === 'full'
          ? 'That slot is fully booked'
          : slot.unavailableReason === 'held'
            ? 'Somebody else is holding that slot at the moment'
            : slot.unavailableReason === 'in-your-basket'
              ? 'That slot is already in your basket'
              : slot.unavailableReason === 'clashes-with-basket'
                ? 'That overlaps a slot already in your basket'
                : 'That slot is already taken'
      );
    }
    if (places > slot.placesRemaining) {
      throw new ValidationError(
        slot.placesRemaining === 1
          ? 'Only one place is left in that slot'
          : `Only ${slot.placesRemaining} places are left in that slot`
      );
    }

    return { calendar, slot };
  }

  /**
   * Re-check an item, its chosen options and the quantity at the moment of
   * adding to the cart.
   *
   * The catalogue the member is looking at may be minutes old, and the last of
   * a size may have gone in between. This is also the only thing standing
   * between a hand-written POST and a line for an option that belongs to
   * another club's item — `optionValueIds` is checked against the item, not
   * merely for existence.
   */
  async assertMerchandiseAvailable(
    organisationId: string,
    merchandiseTypeId: string,
    optionValueIds: string[],
    quantity: number
  ): Promise<CatalogueMerchandise> {
    const item = (await this.listMerchandise(organisationId)).find(
      (candidate) => candidate.id === merchandiseTypeId
    );

    if (!item) {
      throw new ValidationError('That item is no longer for sale');
    }
    if (!item.available) {
      throw new ValidationError(
        item.unavailableReason === 'out-of-stock'
          ? 'That item is out of stock'
          : 'That item is not for sale'
      );
    }

    const valuesById = new Map(
      item.optionTypes.flatMap((type) => type.values.map((value) => [value.id, value] as const))
    );

    /*
     * Every option the club asks for must be answered, exactly once. The
     * per-list check runs first so the message names the list — "Choose one
     * Size" is actionable, "choose an option from each list" is not when the
     * member has chosen two sizes. The count check afterwards catches the
     * remaining case: an id that belongs to no list on this item.
     */
    for (const type of item.optionTypes) {
      const chosen = optionValueIds.filter((id) => type.values.some((value) => value.id === id));
      if (chosen.length !== 1) {
        throw new ValidationError(`Choose one ${type.name}`);
      }
    }
    if (optionValueIds.length !== item.optionTypes.length) {
      throw new ValidationError('Choose an option from each list');
    }

    if (quantity < item.minOrderQuantity) {
      throw new ValidationError(`The smallest order is ${item.minOrderQuantity}`);
    }
    if (item.maxOrderQuantity !== null && quantity > item.maxOrderQuantity) {
      throw new ValidationError(`The largest order is ${item.maxOrderQuantity}`);
    }
    if (item.quantityIncrements && quantity % item.quantityIncrements !== 0) {
      throw new ValidationError(`Order in multiples of ${item.quantityIncrements}`);
    }

    if (item.trackStockLevels) {
      for (const id of optionValueIds) {
        const value = valuesById.get(id);
        if (value && value.stockQuantity !== null && value.stockQuantity < quantity) {
          throw new ValidationError(
            value.stockQuantity <= 0
              ? `${value.name} is out of stock`
              : `Only ${value.stockQuantity} left of ${value.name}`
          );
        }
      }
    }

    return item;
  }

  /**
   * Re-check availability at the moment of adding to the cart.
   *
   * The catalogue a member is looking at may be minutes old, and the last place
   * may have gone in between. This is the check that actually protects
   * capacity — the listing above is presentation.
   */
  /**
   * An activity and the event it belongs to, or null if the member cannot see it.
   *
   * The event comes back as well as the activity because a cap can live at
   * either level: an event limited to 60 entries constrains an activity that
   * sets no limit of its own, and whether an entry takes a hold depends on both.
   */
  async findActivity(
    organisationId: string,
    organisationUserId: string,
    activityId: string,
    today: Date = new Date(),
    options: { excludeOwnHolds?: boolean } = {}
  ): Promise<{ event: CatalogueEvent; activity: CatalogueActivity } | null> {
    const events = await this.listEvents(
      organisationId,
      organisationUserId,
      today,
      options
    );
    for (const event of events) {
      const activity = event.activities.find((a) => a.id === activityId);
      if (activity) return { event, activity };
    }
    return null;
  }

  async assertActivityAvailable(
    organisationId: string,
    organisationUserId: string,
    activityId: string,
    today: Date = new Date()
  ): Promise<CatalogueActivity> {
    const found = await this.findActivity(
      organisationId,
      organisationUserId,
      activityId,
      today
    );
    if (found) return found.activity;

    // Not in the catalogue at all: unpublished, deleted, another club's, or
    // simply wrong. All of them are "you cannot enter this".
    return {
      id: activityId,
      name: '',
      description: null,
      fee: 0,
      handlingFeeIncluded: false,
      applicationFormId: null,
      allowSpecifyQuantity: false,
      supportedPaymentMethodIds: [],
      entriesLimit: null,
      placesRemaining: 0,
      termsAndConditions: null,
      available: false,
      unavailableReason: 'entries-closed',
      membersOnly: false,
      entryEligibility: 'all',
      eligibleMembers: [],
    };
  }
}

export const accountCatalogueService = new AccountCatalogueService();
