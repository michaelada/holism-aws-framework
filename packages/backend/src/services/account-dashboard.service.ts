import { logger } from '../config/logger';
import { accountActivityService } from './account-activity.service';
import { accountCatalogueService } from './account-catalogue.service';
import { cartService } from './cart.service';

/**
 * The member's home screen (B3), assembled in one request.
 *
 * **One call, not eight.** A dashboard that fanned out over
 * entries, bookings, memberships, cart, payments and four catalogues would make
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
const RECENT_PAYMENTS_LIMIT = 3;
/**
 * One row's worth each.
 *
 * Bookings are counted separately because the home screen gives them their own
 * row: sharing a budget of four across every kind meant a club with events, a
 * shop and calendars showed exactly **one** calendar, whatever it had, and the
 * bookings row looked broken next to a bookings page listing three.
 */
const WHATS_ON_LIMIT = 4;
const BOOKINGS_LIMIT = 4;
const SHOP_LIMIT = 4;

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
  recentPayments: Array<{
    id: string;
    total: number;
    status: string;
    currency: string;
    on: string;
  }> | null;
  whatsOn: DashboardWhatsOn[];
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
    const [entries, bookings, memberships, cart, payments, whatsOn] = await Promise.all([
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
      accountActivityService.listPayments(organisationId, organisationUserId),
      this.buildWhatsOn(organisationId, organisationUserId, capabilities, today),
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
      recentPayments:
        payments.length > 0
          ? payments.slice(0, RECENT_PAYMENTS_LIMIT).map((payment) => ({
              id: payment.id,
              total: payment.total,
              status: payment.status,
              currency: payment.currency,
              on: payment.paidOn ?? payment.createdAt,
            }))
          : null,
      whatsOn,
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
    const bookings = items.filter((item) => item.kind === 'calendar');
    const shop = items.filter((item) => item.kind === 'merchandise');
    const rest = items.filter(
      (item) => item.kind !== 'calendar' && item.kind !== 'merchandise'
    );

    /*
     * One of each remaining kind first, then whatever else fits — so a club
     * with a dozen registration types and one event still shows the event.
     */
    const seen = new Set<string>();
    const spread: DashboardWhatsOn[] = [];
    for (const item of rest) {
      if (!seen.has(item.kind)) {
        seen.add(item.kind);
        spread.push(item);
      }
    }
    for (const item of rest) {
      if (spread.length >= WHATS_ON_LIMIT) break;
      if (!spread.includes(item)) spread.push(item);
    }

    return [
      ...spread.slice(0, WHATS_ON_LIMIT),
      ...bookings.slice(0, BOOKINGS_LIMIT),
      ...shop.slice(0, SHOP_LIMIT),
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
