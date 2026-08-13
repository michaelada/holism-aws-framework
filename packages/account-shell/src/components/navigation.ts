/**
 * The account-user navigation model.
 *
 * Every item is capability-gated, and a section disappears entirely when none
 * of its items survive the gate. That is what keeps a memberships-only club to
 * a handful of menu items rather than showing thirteen, most of which would
 * lead to features the club has not enabled.
 *
 * `capabilities: []` means always shown. An item listing several capabilities
 * is shown when **any** of them is enabled — "My entries & bookings" covers two
 * separate features and is worth showing if the member can have either.
 */

/**
 * Icon names, resolved to components in `AppShell`.
 *
 * A name rather than a component so this file stays free of JSX and remains a
 * plain data model — `visibleSections` is tested without rendering anything,
 * and importing MUI icons here would drag the icon set into that test.
 */
export type NavIcon =
  | 'home'
  | 'entries'
  | 'memberships'
  | 'registrations'
  | 'events'
  | 'tickets'
  | 'merchandise'
  | 'calendar'
  | 'cart'
  | 'payments'
  | 'profile';

export interface NavItem {
  /** i18n key under `nav.` */
  labelKey: string;
  /** Appended to `/:orgCode`; empty string is the organisation home. */
  path: string;
  capabilities: string[];
  icon: NavIcon;
}

export interface NavSection {
  /** i18n key under `nav.`, or null for an ungrouped block. */
  titleKey: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: null,
    items: [{ labelKey: 'home', path: '', capabilities: [], icon: 'home' }],
  },
  {
    titleKey: 'myActivity',
    items: [
      {
        labelKey: 'entries',
        path: '/entries',
        capabilities: ['event-management', 'calendar-bookings'],
        icon: 'entries',
      },
      {
        labelKey: 'memberships',
        path: '/memberships',
        capabilities: ['memberships'],
        icon: 'memberships',
      },
      { labelKey: 'tickets', path: '/tickets', capabilities: ['event-ticketing'], icon: 'tickets' },
      { labelKey: 'orders', path: '/orders', capabilities: ['merchandise'], icon: 'merchandise' },
      {
        labelKey: 'registrations',
        path: '/registrations',
        capabilities: ['registrations'],
        icon: 'registrations',
      },
    ],
  },
  {
    titleKey: 'browse',
    items: [
      /*
       * Events and memberships are separate destinations, not tabs of one
       * "Enter or join" screen. A club with only one of the two capabilities
       * then has one menu item and one page, instead of a page whose tab strip
       * has to explain itself.
       */
      {
        labelKey: 'browseEvents',
        path: '/browse/events',
        capabilities: ['event-management'],
        icon: 'events',
      },
      {
        labelKey: 'browseMemberships',
        path: '/browse/memberships',
        capabilities: ['memberships'],
        icon: 'memberships',
      },
      { labelKey: 'merchandise', path: '/shop', capabilities: ['merchandise'], icon: 'merchandise' },
      { labelKey: 'calendar', path: '/book', capabilities: ['calendar-bookings'], icon: 'calendar' },
      {
        labelKey: 'clubRegistrations',
        path: '/register-interest',
        capabilities: ['registrations'],
        icon: 'registrations',
      },
    ],
  },
  {
    titleKey: null,
    items: [
      { labelKey: 'cart', path: '/cart', capabilities: [], icon: 'cart' },
      { labelKey: 'payments', path: '/payments', capabilities: [], icon: 'payments' },
      { labelKey: 'profile', path: '/profile', capabilities: [], icon: 'profile' },
    ],
  },
];

/**
 * Drop items the organisation has not enabled, then drop sections left empty.
 *
 * Pure and exported so the gating can be tested without rendering the shell —
 * the rule matters more than the markup, and it is the part that quietly breaks
 * when a capability is renamed.
 */
export function visibleSections(
  hasCapability: (capability: string) => boolean
): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => item.capabilities.length === 0 || item.capabilities.some(hasCapability)
    ),
  })).filter((section) => section.items.length > 0);
}
