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
const WHATS_ON_LIMIT = 4;

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
}

export interface AccountDashboard {
  /** Absent when the club has no memberships, or the member holds none. */
  membership: {
    id: string;
    name: string;
    membershipNumber: string;
    validUntil: string;
    daysRemaining: number | null;
    canRenew: boolean;
    renewalNotOpen: boolean;
  } | null;
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
      membership: this.pickMembership(memberships),
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
   * The membership the card is about.
   *
   * The one expiring soonest, because that is the one with something to do
   * about it. A member holding several sees the one whose renewal is due; the
   * rest are a click away on C4.
   */
  private pickMembership(
    memberships: Awaited<ReturnType<typeof accountActivityService.listMemberships>> | null
  ): AccountDashboard['membership'] {
    if (!memberships || memberships.length === 0) return null;

    const active = memberships.filter((membership) => membership.status === 'active');
    if (active.length === 0) return null;

    const soonest = [...active].sort((a, b) =>
      String(a.validUntil).localeCompare(String(b.validUntil))
    )[0];

    return {
      id: soonest.id,
      name: soonest.membershipTypeName,
      membershipNumber: soonest.membershipNumber,
      validUntil: soonest.validUntil,
      daysRemaining: soonest.daysRemaining,
      canRenew: soonest.canRenew,
      renewalNotOpen: soonest.renewalNotOpen,
    };
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
   * Only what can actually be acted on: an unavailable row here would be a
   * promotion for something the member cannot have. The catalogues themselves
   * still return unavailable rows with reasons — that is right on a listing
   * page, and wrong on a teaser.
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

      for (const event of events.filter((candidate) => candidate.available)) {
        items.push({
          kind: 'event',
          id: event.id,
          title: event.name,
          detail: event.startDate ?? null,
          // An event's price lives on its activities, and they differ.
          fee: null,
        });
      }

      for (const item of merchandise.filter((candidate) => candidate.available)) {
        items.push({
          kind: 'merchandise',
          id: item.id,
          title: item.name,
          detail: item.description,
          fee: item.fromPrice,
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
        });
      }

      for (const type of registrations.filter((candidate) => candidate.available)) {
        items.push({
          kind: 'registration',
          id: type.id,
          title: type.name,
          detail: type.entityName,
          fee: type.fee,
        });
      }
    } catch (error) {
      // The teaser row is the least important thing on the screen.
      logger.warn('Dashboard could not build what’s on', { organisationId, error });
      return [];
    }

    /*
     * One of each kind first, then whatever else fits. A club with forty
     * shirts and one event should not show four shirts and hide the event.
     */
    const seen = new Set<string>();
    const spread: DashboardWhatsOn[] = [];
    for (const item of items) {
      if (!seen.has(item.kind)) {
        seen.add(item.kind);
        spread.push(item);
      }
    }
    for (const item of items) {
      if (spread.length >= WHATS_ON_LIMIT) break;
      if (!spread.includes(item)) spread.push(item);
    }

    return spread.slice(0, WHATS_ON_LIMIT);
  }
}

/** `YYYY-MM-DD` from whatever the driver returned, for comparing days. */
const toDateKey = (value: string | Date): string => {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
};

export const accountDashboardService = new AccountDashboardService();
