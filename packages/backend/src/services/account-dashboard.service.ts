import { logger } from '../config/logger';
import { db } from '../database/pool';
import { accountActivityService } from './account-activity.service';
import { accountCatalogueService } from './account-catalogue.service';
import { cartService } from './cart.service';

/**
 * The member's home screen (B3), assembled in one request.
 *
 * **One call, not eight.** A dashboard that fanned out over
 * entries, bookings, memberships, cart and four catalogues would make
 * the first screen a member sees the slowest, and every one of those requests
 * repeats the same authentication and membership resolution. `/me` is built the
 * same way and for the same reason.
 *
 * **Nothing here has rules of its own.** Every section calls the service that
 * already owns its domain — the renewal window, the entry-window arithmetic,
 * cart totals and handling fees are all decided elsewhere and read here. A
 * dashboard is a view; the moment it starts deciding what is renewable, it and
 * C4 begin to disagree.
 *
 * **A section a club has not enabled is absent, not empty.** `null` means "this
 * club does not do this", which the screen renders as nothing at all. An empty
 * card for a feature the club never switched on reads as a broken page.
 */

/** How much of each list a dashboard card can usefully show. */
const COMING_UP_LIMIT = 3;
/**
 * One row's worth each.
 *
 * Bookings are counted separately because the home screen gives them their own
 * row: sharing a budget of four across every kind meant a club with events, a
 * shop and calendars showed exactly **one** calendar, whatever it had, and the
 * bookings row looked broken next to a bookings page listing three.
 */
/**
 * One row's worth each.
 *
 * Every kind the home screen gives its own heading gets its own budget. Sharing
 * one across all of them meant a club with several kinds showed a single card
 * of each, with nothing on screen to say that was a limit rather than all it
 * had.
 */
const EVENTS_LIMIT = 4;
const BOOKINGS_LIMIT = 4;
const SHOP_LIMIT = 4;
const REGISTRATIONS_LIMIT = 4;

/**
 * How close an unopened event has to be before it is worth teasing.
 *
 * Shorter than the client's `OPENING_SOON_DAYS` (14), which decides how a
 * window is *phrased* once an event is on screen. This decides whether it
 * belongs there at all, and a home screen advertising something a fortnight
 * away crowds out what a member can act on today.
 */
const OPENING_WITHIN_DAYS = 3;

export interface DashboardComingUp {
  kind: 'entry' | 'booking';
  id: string;
  title: string;
  detail: string | null;
  /** `YYYY-MM-DD` — what the card sorts and prints. */
  on: string;
  startTime: string | null;
  status: string;
}

export interface DashboardWhatsOn {
  kind: 'event' | 'merchandise' | 'calendar' | 'registration';
  id: string;
  title: string;
  detail: string | null;
  /** Minor units; null when the thing has no single price. */
  fee: number | null;
  /**
   * When it happens, and where its entry window sits. Events only — nothing
   * else in this list has a date or a window, and the fields stay null rather
   * than absent so the teaser can read them without narrowing the kind first.
   *
   * The window and the capacity are handed over raw rather than as a decided
   * status, because the client already owns those rules: `entryWindowFor` and
   * `capacityFor` phrase them for the browse page, and a second opinion
   * computed here would eventually disagree with the first.
   */
  startDate: string | null;
  endDate: string | null;
  entriesOpenDate: string | null;
  entriesClosingDate: string | null;
  entriesLimit: number | null;
  placesRemaining: number | null;
  /**
   * Calendars only: the club's chosen icon and colour for this one.
   *
   * A club's bookable things are not interchangeable — a court, an arena and a
   * clubhouse read very differently — and the home screen groups them into one
   * row, where colour and an icon are what tell them apart at a glance.
   */
  icon: string | null;
  colour: string | null;
  /** Merchandise only: the first product image, for a thumbnail. */
  imageUrl: string | null;
}

export interface AccountDashboard {
  /** Absent when the club has no memberships, or the member holds none. */
  /**
   * Every active membership this login holds here, not just one.
   *
   * A parent holds their children's, and a card about only the soonest to
   * expire left the rest invisible until they thought to open C4. `null` still
   * means the club has no memberships at all, which is different from holding
   * none — the screen renders no section in the first case and can say so in
   * the second.
   */
  memberships: Array<{
    id: string;
    name: string;
    /** Who it is for — a parent's card must say which child it is about. */
    memberName: string;
    membershipNumber: string;
    validUntil: string;
    daysRemaining: number | null;
    canRenew: boolean;
    renewalNotOpen: boolean;
  }> | null;
  comingUp: DashboardComingUp[] | null;
  cart: { itemCount: number; total: number; handlingFee: number; currency: string } | null;
  whatsOn: DashboardWhatsOn[];
  /**
   * Events run by *other* clubs of the same type that this club's members may
   * enter. Empty for almost everyone; null is not used, because "none" and
   * "not applicable" look the same on the screen and neither renders anything.
   */
  externalEvents: DashboardExternalEvent[];
  /**
   * What the federation is called — "Irish Pony Clubs".
   *
   * Only the external-events section names it, so it is null whenever that
   * section is empty rather than being looked up for every dashboard that will
   * never show it. It is the *caller's* organisation type, which is the same
   * type every external event belongs to: that equality is the join condition,
   * not a coincidence.
   */
  organisationTypeName: string | null;
}

/**
 * An event another branch is running, open across the organisation type.
 *
 * Deliberately **not** folded into `whatsOn`. Everything in that list is
 * something the member can act on here and now; this is something happening
 * somewhere else, which they may first have to join a club to enter. Putting
 * the two in one list would mean every consumer of `whatsOn` having to
 * re-establish the difference, and the first one to forget would offer an
 * "Enter" button that leads nowhere.
 */
export interface DashboardExternalEvent {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  entriesClosingDate: string | null;
  /** The club running it — the whole point of the row. */
  organisationName: string;
  /** Its account-app code, for the link that takes the member there. */
  organisationCode: string;
  /**
   * Whether this person already has an account with that club.
   *
   * Decides the wording: someone who has joined is being sent to an event,
   * someone who has not is being asked to join first — and being asked to join
   * something you already belong to reads as the software not knowing you.
   */
  alreadyJoined: boolean;
}

/** What a teaser without a date or an entry window fills those fields with. */
const NO_SCHEDULE = {
  startDate: null,
  endDate: null,
  entriesOpenDate: null,
  entriesClosingDate: null,
  entriesLimit: null,
  placesRemaining: null,
  icon: null,
  colour: null,
  imageUrl: null,
} as const;

export class AccountDashboardService {
  async build(
    organisationId: string,
    organisationUserId: string,
    capabilities: string[],
    currency: string,
    today: Date = new Date()
  ): Promise<AccountDashboard> {
    const has = (capability: string) => capabilities.includes(capability);

    /*
     * Fired together rather than in sequence: they do not depend on each
     * other, and a member on a phone waits for the slowest, not the sum. A
     * section the club has not enabled is not asked for at all.
     */
    const [entries, bookings, memberships, cart, whatsOn, externalEvents] = await Promise.all([
      has('event-management')
        ? accountActivityService.listEntries(organisationId, organisationUserId, today)
        : null,
      has('calendar-bookings')
        ? accountActivityService.listBookings(organisationId, organisationUserId, today)
        : null,
      has('memberships')
        ? accountActivityService.listMemberships(organisationId, organisationUserId, today)
        : null,
      cartService.getCart(organisationId, organisationUserId, currency, today).catch((error) => {
        // A dashboard is not worth failing over a basket. The card is dropped
        // and the rest of the screen still renders.
        logger.warn('Dashboard could not read the cart', { organisationId, error });
        return null;
      }),
      this.buildWhatsOn(organisationId, organisationUserId, capabilities, today),
      this.externalEvents(organisationId, organisationUserId, today).catch((error) => {
        // A cross-club courtesy is not worth failing a dashboard over.
        logger.warn('Dashboard could not read external events', { organisationId, error });
        return { events: [], typeName: null };
      }),
    ]);

    return {
      memberships: this.activeMemberships(memberships),
      comingUp: this.pickComingUp(entries, bookings, today),
      cart:
        cart && cart.items.length > 0
          ? {
              itemCount: cart.items.length,
              total: cart.totals.orderTotal,
              handlingFee: cart.totals.handlingFee.total,
              currency: cart.currency,
            }
          : null,
      whatsOn,
      externalEvents: externalEvents.events,
      organisationTypeName: externalEvents.typeName,
    };
  }

  /**
   * Events other branches are running that this member may enter.
   *
   * Shown to *every* account user of a club whose type contains such an event —
   * not only to members. Someone who has not joined is exactly who the link is
   * for: it takes them to the organising club so they can. Whether they may
   * ultimately enter is decided there, by that club's catalogue, against their
   * memberships.
   *
   * Restricted to events with at least one publicly visible activity opened
   * across the type. An event whose organiser has not opened anything to other
   * branches is not other branches' business.
   */
  private async externalEvents(
    organisationId: string,
    organisationUserId: string,
    today: Date
  ): Promise<{ events: DashboardExternalEvent[]; typeName: string | null }> {
    const result = await db.query(
      `SELECT DISTINCT e.id, e.name, e.start_date, e.end_date, e.entries_closing_date,
              o.display_name AS organisation_name, o.url_code,
              ot.display_name AS organisation_type_name,
              EXISTS (
                SELECT 1
                  FROM organization_users theirs
                  JOIN organization_users mine ON mine.keycloak_user_id = theirs.keycloak_user_id
                 WHERE mine.id = $2
                   AND theirs.organization_id = o.id
                   AND theirs.status = 'active'
                   -- Joined *as a member*. Administering a club is not being a
                   -- member of it, and since migration 1709000000038 a person
                   -- can be either, both, or neither, so this has to say which
                   -- it means. Otherwise a club the member only administers
                   -- reads as one they have already joined, and the offer to
                   -- join it never appears.
                   AND theirs.user_type = 'account-user'
              ) AS already_joined
         FROM events e
         JOIN organizations o ON o.id = e.organisation_id
         JOIN organization_types ot ON ot.id = o.organization_type_id
         JOIN event_activities a ON a.event_id = e.id
        WHERE o.organization_type_id = (
                SELECT organization_type_id FROM organizations WHERE id = $1
              )
          AND o.id <> $1
          AND o.status = 'active'
          AND e.status = 'published'
          AND e.deleted = FALSE
          AND (e.end_date IS NULL OR e.end_date >= $3)
          AND a.entry_eligibility = 'org-type-members'
          AND a.show_publicly = TRUE
        ORDER BY e.start_date ASC NULLS LAST`,
      [organisationId, organisationUserId, today]
    );

    return {
      typeName: result.rows[0]?.organisation_type_name ?? null,
      events: result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
      endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
      entriesClosingDate: row.entries_closing_date
        ? new Date(row.entries_closing_date).toISOString()
        : null,
      organisationName: row.organisation_name,
      organisationCode: row.url_code,
      alreadyJoined: Boolean(row.already_joined),
      })),
    };
  }

  /**
   * Every active membership this login holds, as its own card.
   *
   * A single card about the soonest to expire was the wrong shape once parents
   * turned out to hold their children's: it told them something was expiring
   * without showing the other three, which were only reachable by thinking to
   * open C4. Elapsed and pending ones stay out — this section is about what is
   * currently held.
   *
   * Which makes *whose* each one is essential rather than decorative: a row of
   * cards naming only the type would be four cards reading "Junior Member".
   */
  private activeMemberships(
    memberships: Awaited<ReturnType<typeof accountActivityService.listMemberships>> | null
  ): AccountDashboard['memberships'] {
    // The club has no memberships at all — a different thing from holding none.
    if (!memberships) return null;

    /*
     * Soonest to expire first, so anything needing renewal is the first card
     * read rather than buried behind memberships with months left.
     */
    return memberships
      .filter((membership) => membership.status === 'active')
      .sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil)))
      .map((membership) => ({
        id: membership.id,
        name: membership.membershipTypeName,
        memberName: membership.memberName,
        membershipNumber: membership.membershipNumber,
        validUntil: membership.validUntil,
        daysRemaining: membership.daysRemaining,
        canRenew: membership.canRenew,
        renewalNotOpen: membership.renewalNotOpen,
      }));
  }

  /**
   * What the member has coming, entries and bookings together.
   *
   * Merged rather than kept in two lists: a member's Saturday morning is one
   * thing whether it is a class or a court, and two half-empty cards say less
   * than one full one. Anything in the past is dropped — this card is about
   * what to turn up to.
   */
  private pickComingUp(
    entries: Awaited<ReturnType<typeof accountActivityService.listEntries>> | null,
    bookings: Awaited<ReturnType<typeof accountActivityService.listBookings>> | null,
    today: Date
  ): DashboardComingUp[] | null {
    if (entries === null && bookings === null) return null;

    const todayKey = toDateKey(today);

    const fromEntries: DashboardComingUp[] = (entries ?? [])
      .filter((entry) => entry.startDate && toDateKey(entry.startDate) >= todayKey)
      .map((entry) => ({
        kind: 'entry' as const,
        id: entry.id,
        title: entry.eventName,
        detail: entry.activityName,
        on: toDateKey(entry.startDate as string),
        startTime: null,
        status: entry.status,
      }));

    const fromBookings: DashboardComingUp[] = (bookings ?? [])
      .filter(
        (booking) =>
          booking.bookingStatus !== 'cancelled' && toDateKey(booking.bookingDate) >= todayKey
      )
      .map((booking) => ({
        kind: 'booking' as const,
        id: booking.id,
        title: booking.calendarName,
        detail: `${booking.startTime}–${booking.endTime}`,
        on: toDateKey(booking.bookingDate),
        startTime: booking.startTime,
        status: booking.status,
      }));

    const soonestFirst = [...fromEntries, ...fromBookings].sort(
      (a, b) => a.on.localeCompare(b.on) || (a.startTime ?? '').localeCompare(b.startTime ?? '')
    );

    return soonestFirst.slice(0, COMING_UP_LIMIT);
  }

  /**
   * A few things the club is offering, across whatever it has enabled.
   *
   * For everything except events, only what can actually be acted on: an
   * out-of-stock shirt here would be a promotion for something the member
   * cannot have.
   *
   * **Events are different**, because their unavailability is itself the news —
   * entries opening on Friday, closing yesterday, or a camp that filled up are
   * all things a member wants to know, and each card carries a status chip
   * saying which. See `teasableEvent` below.
   */
  private async buildWhatsOn(
    organisationId: string,
    organisationUserId: string,
    capabilities: string[],
    today: Date
  ): Promise<DashboardWhatsOn[]> {
    const has = (capability: string) => capabilities.includes(capability);
    const items: DashboardWhatsOn[] = [];

    try {
      const [events, merchandise, calendars, registrations] = await Promise.all([
        has('event-management')
          ? accountCatalogueService.listEvents(organisationId, organisationUserId, today)
          : [],
        has('merchandise') ? accountCatalogueService.listMerchandise(organisationId) : [],
        has('calendar-bookings') ? accountCatalogueService.listCalendars(organisationId) : [],
        has('registrations')
          ? accountCatalogueService.listRegistrationTypes(organisationId, today)
          : [],
      ]);

      /*
       * Events are the exception to the "only what can be acted on" rule below.
       *
       * A club's home screen is also how a member finds out that entries open
       * on Friday, that they closed yesterday, or that the camp filled up — and
       * an events list that silently omits all three reads as a club with
       * nothing on. The status chip on each card says which it is, so nothing
       * here is mistakable for an invitation.
       *
       * Not-yet-open events are still filtered by *how far off* they are: an
       * event opening in a fortnight is not news, and would push out something
       * closing this week.
       */
      const teasableEvent = (event: (typeof events)[number]): boolean => {
        if (event.available) return true;

        switch (event.unavailableReason) {
          case 'entries-closed':
          case 'event-full':
            return true;
          case 'entries-not-open':
            return withinDays(event.entriesOpenDate, today, OPENING_WITHIN_DAYS);
          default:
            // 'already-entered' and anything later added: the member has no
            // reason to be shown it.
            return false;
        }
      };

      for (const event of events.filter(teasableEvent)) {
        items.push({
          kind: 'event',
          id: event.id,
          title: event.name,
          // The date now has a field of its own; `detail` goes back to being a
          // description, and the card no longer prints the same date twice.
          detail: null,
          // An event's price lives on its activities, and they differ.
          fee: null,
          startDate: event.startDate ?? null,
          endDate: event.endDate ?? null,
          entriesOpenDate: event.entriesOpenDate ?? null,
          entriesClosingDate: event.entriesClosingDate ?? null,
          entriesLimit: event.entriesLimit ?? null,
          placesRemaining: event.placesRemaining ?? null,
          // An event's mark is its date tile; the icon is for calendars.
          icon: null,
          colour: null,
          imageUrl: null,
        });
      }

      for (const item of merchandise.filter((candidate) => candidate.available)) {
        items.push({
          kind: 'merchandise',
          id: item.id,
          title: item.name,
          detail: item.description,
          fee: item.fromPrice,
          ...NO_SCHEDULE,
          /*
           * The first image only: a teaser is a thumbnail, not a gallery.
           * Guarded, because this whole block sits inside one try/catch — a row
           * missing its images array would otherwise take out the entire
           * what's-on section rather than just its own picture.
           */
          imageUrl: item.images?.[0] ?? null,
        });
      }

      for (const calendar of calendars.filter((candidate) => candidate.available)) {
        items.push({
          kind: 'calendar',
          id: calendar.id,
          title: calendar.name,
          detail: calendar.description,
          // Price depends on the slot chosen.
          fee: null,
          ...NO_SCHEDULE,
          icon: calendar.displayIcon ?? null,
          colour: calendar.displayColour ?? null,
          imageUrl: null,
        });
      }

      for (const type of registrations.filter((candidate) => candidate.available)) {
        items.push({
          kind: 'registration',
          id: type.id,
          title: type.name,
          detail: type.entityName,
          fee: type.fee,
          ...NO_SCHEDULE,
        });
      }
    } catch (error) {
      // The teaser row is the least important thing on the screen.
      logger.warn('Dashboard could not build what’s on', { organisationId, error });
      return [];
    }

    /*
     * Each row on the home screen gets its own budget, because each is shown
     * on its own: bookings and the shop have their own headings, and taking
     * their places from one shared four left a club showing a single calendar
     * out of three with nothing on screen to say that was a limit rather than
     * all it had.
     */
    const take = (kind: DashboardWhatsOn['kind'], limit: number) =>
      items.filter((item) => item.kind === kind).slice(0, limit);

    /*
     * Grouped by kind because the screen groups by kind: each has its own
     * heading, so each gets its own share rather than competing for one.
     */
    return [
      ...take('event', EVENTS_LIMIT),
      ...take('calendar', BOOKINGS_LIMIT),
      ...take('merchandise', SHOP_LIMIT),
      ...take('registration', REGISTRATIONS_LIMIT),
    ];
  }
}

/** `YYYY-MM-DD` from whatever the driver returned, for comparing days. */
/** Whether `date` falls within `days` of `from`, counting whole days. */
const withinDays = (date: string | null, from: Date, days: number): boolean => {
  if (!date) return false;

  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return false;

  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const wholeDays = Math.round(
    (startOfTarget.getTime() - startOfFrom.getTime()) / 86_400_000
  );

  return wholeDays >= 0 && wholeDays <= days;
};

const toDateKey = (value: string | Date): string => {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
};

export const accountDashboardService = new AccountDashboardService();
