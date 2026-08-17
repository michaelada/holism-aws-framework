/**
 * Types mirroring the account-user API.
 *
 * These are transcribed from the backend's own interfaces
 * (`packages/backend/src/services/account-organisation.service.ts`) and the
 * route handlers in `account.routes.ts` / `public.routes.ts`. They are
 * deliberately a copy rather than a shared import: the backend package is not a
 * front-end dependency, and inventing a richer shape here than the API actually
 * returns is how a front end ends up rendering `undefined` (CLAUDE.md §1.7 —
 * adapt to the backend that exists).
 */

/** `GET /api/public/organisations` — one entry. Deliberately minimal; no session. */
export interface PublicOrganisation {
  urlCode: string;
  displayName: string;
  organisationType: string | null;
  city?: string;
  country?: string;
  branding: {
    logoUrl: string;
    primaryColor: string;
    /** What this club calls its bookings area; empty means the default. */
    bookingsLabel: string;
  };
}

/** `GET /api/public/organisations/:code`. */
export interface PublicOrganisationDetail extends PublicOrganisation {
  capabilities: string[];
  currency: string;
  language: string | null;
  /** Drives the gateway's call to action — "Register" versus "contact the club". */
  registrationOpen: boolean;
}

/** The envelope `GET /api/public/organisations` returns. */
export interface PublicOrganisationList {
  organisations: PublicOrganisation[];
  total: number;
}

/**
 * `GET /api/account/organisations` — one entry.
 *
 * Includes memberships that are `pending` or `rejected`, so the switcher can
 * explain a state rather than appear to have lost an organisation.
 */
export interface AccountMembership {
  /**
   * These two are declared by the backend's own interface but are **not
   * selected by its query**, so they arrive undefined. Optional here so the
   * front end cannot key a list on them and quietly collide every row.
   */
  organisationId?: string;
  organisationUserId?: string;
  urlCode: string;
  displayName: string;
  currency: string;
  language: string | null;
  capabilities: string[];
  status: string;
  /** The club's mark, as the directory and switcher show it. */
  branding?: {
    logoUrl: string;
    primaryColor: string;
    /** What this club calls its bookings area; empty means the default. */
    bookingsLabel?: string;
  };
}

/** `GET /api/account/:orgCode/me`. */
export interface AccountMe {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    /** The member's own language; null means "follow the organisation". */
    preferredLanguage?: string | null;
  };
  organisation: {
    urlCode: string;
    displayName: string;
    currency: string;
    language: string | null;
    capabilities: string[];
  };
}

/**
 * The states `GET /api/account/:orgCode/registration-status` reports.
 *
 * `connected` is the only one that grants access. The rest each need a
 * different screen, which is why the endpoint reports a state rather than a
 * boolean.
 */
export type RegistrationState =
  | 'connected'
  | 'NOT_CONNECTED'
  | 'PENDING_APPROVAL'
  | 'REGISTRATION_REJECTED'
  | 'ACCOUNT_INACTIVE';

export interface RegistrationStatus {
  state: RegistrationState;
}

/* ------------------------------------------------------------------ *
 * "My activity" — C1, C2, C4. Mirrors
 * packages/backend/src/services/account-activity.service.ts
 * ------------------------------------------------------------------ */

/**
 * The four words the account app uses for a member's own activity, shared
 * across entries, bookings and memberships. A member should not have to learn
 * two vocabularies for the same four situations.
 */
export type ActivityStatus =
  | 'awaiting-payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface AccountEntry {
  id: string;
  eventId: string;
  eventName: string;
  activityId: string;
  activityName: string;
  startDate: string | null;
  endDate: string | null;
  quantity: number;
  fee: number | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  entryDate: string;
  status: ActivityStatus;
}

export interface AccountEntryDetail extends AccountEntry {
  firstName: string;
  lastName: string;
  email: string;
  formSubmissionId: string | null;
  /**
   * What the member answered on the entry form, labelled and in the club's own
   * field order. Empty when the activity asked nothing.
   */
  formSummary: Array<{ label: string; value: string }>;
  eventDescription: string | null;
  activityDescription: string | null;
  confirmationMessage: string | null;
}

export interface AccountBooking {
  id: string;
  bookingReference: string;
  calendarId: string;
  calendarName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  placesBooked: number;
  totalPrice: number | null;
  paymentStatus: string | null;
  bookingStatus: string | null;
  cancelledAt: string | null;
  /** The club's cancellation policy, decided server-side. */
  canCancel: boolean;
  cancellationRefusal: 'not-allowed' | 'already-cancelled' | 'too-late' | 'already-passed' | null;
  cancellationNoticeDays: number;
  /** Whether the club's policy means a refund should be expected. */
  refundExpected: boolean;
  /**
   * The calendar's own icon key and colour, so a booking is marked with the
   * same symbol the member picked it from rather than one generic glyph.
   */
  displayIcon: string | null;
  displayColour: string | null;
  status: ActivityStatus;
}

export interface AccountMembershipRecord {
  id: string;
  membershipNumber: string;
  membershipTypeId: string;
  membershipTypeName: string;
  /** Who it is for — a parent holds their children's memberships. */
  memberName: string;
  status: string;
  validUntil: string;
  dateLastRenewed: string;
  paymentStatus: string | null;
  daysRemaining: number | null;
  /**
   * What the member answered on the application form, labelled and in the
   * club's own field order. Empty when the club asked nothing.
   */
  formSummary: Array<{ label: string; value: string }>;
  /** In the renewal window *and* something exists to renew into. */
  canRenew: boolean;
  /** Due, but the club has published nothing to renew into (C4). */
  renewalNotOpen: boolean;
}

/* ------------------------------------------------------------------ *
 * Catalogue, cart and checkout — phase 8. Mirrors
 * account-catalogue.service.ts, cart.service.ts and checkout.service.ts
 * ------------------------------------------------------------------ */

/**
 * Why something cannot be bought.
 *
 * Returned by the server rather than inferred here: the cart trusts its
 * caller, so availability that the browser decided would be no protection at
 * all (G8).
 */
export type UnavailableReason =
  | 'entries-not-open'
  | 'entries-closed'
  | 'event-full'
  | 'activity-full'
  | 'already-entered'
  | 'not-open-for-applications'
  | 'already-a-member'
  | 'not-on-sale'
  | 'out-of-stock'
  | 'not-open-for-bookings'
  /** The last places are in other members' baskets, and may yet come back. */
  | 'held-by-others'
  /** Already in the member's own basket. */
  | 'in-your-basket';

export interface CatalogueActivity {
  id: string;
  name: string;
  description: string | null;
  /** Minor units. */
  fee: number;
  handlingFeeIncluded: boolean;
  applicationFormId: string | null;
  allowSpecifyQuantity: boolean;
  supportedPaymentMethodIds: string[];
  /** The activity's own cap, or null when uncapped. */
  entriesLimit: number | null;
  /** Null when the activity is not capped. */
  placesRemaining: number | null;
  /** The club's terms for this activity; null when it has none switched on. */
  termsAndConditions: string | null;
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

export interface CatalogueEvent {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  entriesOpenDate: string | null;
  entriesClosingDate: string | null;
  /** The event-wide cap, or null when uncapped. */
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
  /** Minor units, from the membership type — not from its application form. */
  fee: number;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  /** The club's terms; null when it has none switched on. */
  termsAndConditions: string | null;
  /** Held already and near expiry — a renewal, not a fresh application. */
  isRenewal: boolean;
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/** One choice within an option — "Large", "Navy" — and what it costs. */
export interface CatalogueOptionValue {
  id: string;
  name: string;
  /** Minor units. An item's price is the sum of the values chosen. */
  price: number;
  /** Null when the club does not track stock for this item. */
  stockQuantity: number | null;
}

export interface CatalogueOptionType {
  id: string;
  name: string;
  values: CatalogueOptionValue[];
}

/** `GET /api/account/:orgCode/catalogue/merchandise` — screens D9 and D10. */
export interface CatalogueMerchandise {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  /** The cheapest combination, in minor units — a *from* price. */
  fromPrice: number;
  optionTypes: CatalogueOptionType[];
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  quantityIncrements: number | null;
  /** `free` | `fixed` | `quantity_based`. */
  deliveryType: string;
  /** Minor units, meaningful for `fixed`. */
  deliveryFee: number;
  trackStockLevels: boolean;
  applicationFormId: string | null;
  termsAndConditions: string | null;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/** `GET /api/account/:orgCode/orders` — screen C8. */
export interface AccountMerchandiseOrder {
  id: string;
  merchandiseTypeId: string;
  itemName: string;
  image: string | null;
  /** Option names to chosen values — `{ Size: 'Large' }`. */
  options: Record<string, string>;
  quantity: number;
  /** Minor units. */
  unitPrice: number;
  deliveryFee: number;
  totalPrice: number;
  orderDate: string;
  paymentStatus: string | null;
  /** The club's progress on the goods, separate from the payment. */
  orderStatus: string | null;
  status: ActivityStatus;
}

/** One thing the member has coming up — an entry or a booking. */
export interface DashboardComingUp {
  kind: 'entry' | 'booking';
  id: string;
  title: string;
  detail: string | null;
  /** `YYYY-MM-DD`. */
  on: string;
  startTime: string | null;
  status: ActivityStatus;
}

/** One teaser on the "what's on" row. */
export interface DashboardWhatsOn {
  kind: 'event' | 'merchandise' | 'calendar' | 'registration';
  id: string;
  title: string;
  detail: string | null;
  /** Minor units; null when the thing has no single price. */
  fee: number | null;
  /** Events only; null on everything else, which has no date or window. */
  startDate: string | null;
  endDate: string | null;
  entriesOpenDate: string | null;
  entriesClosingDate: string | null;
  entriesLimit: number | null;
  placesRemaining: number | null;
  /** Calendars only: the club's chosen icon name and colour. */
  icon: string | null;
  colour: string | null;
  /** Merchandise only: the first product image, shown as a thumbnail. */
  imageUrl: string | null;
}

/**
 * `GET /api/account/:orgCode/dashboard` — screen B3.
 *
 * A `null` section means the club has not enabled that area, and the screen
 * renders nothing at all rather than an empty card.
 */
export interface AccountDashboard {
  /**
   * Every active membership this login holds here.
   *
   * `null` means the club has no memberships at all, which is different from
   * holding none of them.
   */
  memberships: Array<{
    id: string;
    name: string;
    /** Who it is for — a parent holds their children's memberships. */
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

/** One line of a payment — what it bought, and whether that arrived. */
/**
 * What a basket line is for.
 *
 * These are the exact strings `cart_items.item_type` allows — the column has a
 * check constraint, so a value that merely looks right (`event-entry` for
 * `event_entry`) is refused by Postgres at insert time. Typed here rather than
 * left as `string` because that is what let the hyphenated spelling reach the
 * database at all.
 */
export type CartItemType =
  | 'event_entry'
  | 'membership'
  | 'registration'
  | 'booking'
  | 'merchandise';

/** The body of `POST /api/account/:orgCode/cart/items`. */
export interface AddCartItemRequest {
  itemType: CartItemType;
  contextRef: Record<string, unknown>;
  description: string;
  unitFee: number;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  quantity?: number;
  formSubmissionId?: string;
  discountId?: string;
  discountAmount?: number;
}

export interface AccountPaymentLine {
  id: string;
  itemType: CartItemType;
  description: string;
  /** Minor units. */
  fee: number;
  handlingFee: number;
  fulfilled: boolean;
  fulfilmentError: string | null;
}

/** `GET /api/account/:orgCode/payments` — screens F1 and F2. */
export interface AccountPayment {
  id: string;
  status: string;
  currency: string;
  paymentMethod: string | null;
  paidOn: string | null;
  createdAt: string;
  /** Minor units. Card and offline are separate: one order can be both. */
  cardAmount: number;
  offlineAmount: number;
  handlingFee: number;
  total: number;
  offlineReceivedAt: string | null;
  lines: AccountPaymentLine[];
}

/** `GET /api/account/:orgCode/catalogue/registration-types` — screens D7, D8. */
export interface CatalogueRegistrationType {
  id: string;
  name: string;
  description: string | null;
  /** The club's word for the thing registered — "Horse", "Boat". */
  entityName: string;
  registrationFormId: string | null;
  isRollingRegistration: boolean;
  validUntil: string | null;
  numberOfMonths: number | null;
  /** False means the club reviews it before it takes effect. */
  automaticallyApprove: boolean;
  /** Minor units. */
  fee: number;
  handlingFeeIncluded: boolean;
  supportedPaymentMethodIds: string[];
  termsAndConditions: string | null;
  available: boolean;
  unavailableReason: UnavailableReason | null;
}

/** `GET /api/account/:orgCode/registrations` — screen C6. */
export interface AccountRegistration {
  id: string;
  registrationNumber: string;
  registrationTypeId: string;
  typeName: string;
  entityLabel: string;
  entityName: string;
  ownerName: string | null;
  validUntil: string | null;
  dateLastRenewed: string | null;
  registrationStatus: string | null;
  paymentStatus: string | null;
  status: ActivityStatus;
}

/** `GET /api/account/:orgCode/catalogue/calendars` — screen D11. */
export interface CatalogueCalendar {
  id: string;
  name: string;
  description: string | null;
  displayColour: string | null;
  /** A shared icon-set key; null falls back to the generic calendar mark. */
  displayIcon: string | null;
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
 * One bookable slot. Derived server-side from the schedule, the blocks, the
 * bookings and any live holds — there is no table of slots.
 */
export interface AvailableSlot {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`. */
  startTime: string;
  endTime: string;
  /** Minutes. */
  duration: number;
  /** Minor units. */
  price: number;
  placesAvailable: number;
  placesBooked: number;
  placesRemaining: number;
  available: boolean;
  /**
   * Why not: full, taken by a longer booking, held by another member's basket,
   * or already in the member's own.
   */
  unavailableReason: 'full' | 'in-use' | 'held' | 'in-your-basket' | null;
  /**
   * When the member's own hold on this slot lapses; ISO, null unless it is
   * theirs. Never carries somebody else's expiry.
   */
  heldUntil: string | null;
}

/** `GET …/calendars/:id/availability?from=&to=` — screens D12 and D13. */
export interface AvailabilityResponse {
  calendar: CatalogueCalendar;
  slots: AvailableSlot[];
}

export interface CartItemView {
  id: string;
  itemType: CartItemType;
  contextRef: Record<string, unknown>;
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
  /** A booking's calendar mark; null on every other kind. */
  icon?: string | null;
  colour?: string | null;
  /** What the member answered on this item's form, in the club's own order. */
  formSummary?: Array<{ label: string; value: string }>;
  /** Methods this item may be switched to, named, so the cart can offer them. */
  availablePaymentMethods?: Array<{
    id: string;
    name: string;
    displayName: string;
    isCard: boolean;
  }>;
  /**
   * When this line's soft hold lapses; ISO, and null for lines that hold
   * nothing — a membership or a jumper is not contended.
   */
  expiresAt?: string | null;
  /** Whether that hold has already gone. Checkout refuses while any has. */
  expired?: boolean;
}

export interface HandlingFeeBreakdown {
  base: number;
  net: number;
  tax: number;
  total: number;
}

export interface CartTotals {
  offlineSubtotal: number;
  cardSubtotal: number;
  feeBearingBase: number;
  handlingFee: HandlingFeeBreakdown;
  /** What the card is charged now, fee included. Minor units. */
  chargedToCardNow: number;
  orderTotal: number;
  allocations: Record<string, number>;
}

export interface CartView {
  id: string;
  organisationId: string;
  currency: string;
  status: string;
  items: CartItemView[];
  totals: CartTotals;
  /** Soft holds that lapsed while the member was elsewhere. */
  warnings: Array<{ itemId: string; code: 'HOLD_EXPIRED'; message: string }>;
}

/** `POST /api/account/:orgCode/checkout`. */
export interface CheckoutResult {
  paymentId: string;
  /** Null when there is nothing to pay by card. */
  clientSecret: string | null;
  provider: string | null;
  /**
   * The provider's public key, served by the API so this app needs no payment
   * configuration of its own.
   */
  publishableKey: string | null;
  amountDue: number;
  handlingFee: number;
  offlineAmount: number;
  currency: string;
  /** True when the order needs no card charge and is already placed. */
  completed: boolean;
  /**
   * When the earliest hold on this order lapses; ISO, null when it holds
   * nothing. The earliest, because one lapsed line refuses the whole basket.
   */
  holdExpiresAt: string | null;
}

/** `GET /api/account/:orgCode/payments/:paymentId`. */
export interface PaymentStatus {
  paymentId: string;
  status: string;
  amount: number;
  handlingFee: number;
  offlineAmount: number;
  currency: string;
  failureMessage: string | null;
}

/**
 * Why a ticket will or will not get a member through a gate.
 *
 * Four states rather than a boolean, because each has a different remedy: pay,
 * nothing, nothing, and talk to the club.
 */
export type TicketState = 'valid' | 'awaiting-payment' | 'used' | 'expired';

/** A row on `GET /api/account/:orgCode/tickets`. */
export interface AccountTicketSummary {
  id: string;
  ticketReference: string;
  state: TicketState;
  eventId: string;
  eventName: string;
  activityName: string | null;
  eventStartDate: string;
  eventEndDate: string | null;
  entrantName: string;
  validUntil: string;
  /** Set only once scanned; drives the "Used …" banner. */
  scannedAt: string | null;
}

/**
 * `GET /api/account/:orgCode/tickets/:id` — everything the ticket screen
 * renders, in one response, so the whole ticket can be cached for a gate with
 * no signal.
 */
export interface AccountTicketDetail extends AccountTicketSummary {
  qrCode: string;
  entrantEmail: string;
  validFrom: string | null;
  organisationName: string;
  config: {
    headerText: string | null;
    instructions: string | null;
    footerText: string | null;
    includeEventLogo: boolean;
    backgroundColour: string | null;
  };
}

/** `GET`/`PUT /api/account/:orgCode/profile` — screen P1. */
export interface AccountProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  memberSince: string;
  lastLogin: string | null;
  /** Null means "follow the organisation's language". */
  preferredLanguage: string | null;
  /**
   * How many organisations this identity belongs to. Above one, the screen says
   * that edits here apply to all of them.
   */
  organisationCount: number;
}
