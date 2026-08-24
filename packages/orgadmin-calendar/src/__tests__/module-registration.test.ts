import { describe, it, expect } from 'vitest';
import { calendarModule } from '../index';

/**
 * The module's own registration, which is the contract with the shell.
 *
 * Every field here is load-bearing and none of it is exercised by a test of a
 * page: the shell reads `capability` to decide whether this module exists for a
 * club at all, `routes` to mount it, and `subMenuItems` to draw the rail. A typo
 * in a capability name does not fail a build or a page test — it silently hides
 * a paid-for module from every organisation, or shows a module to a club that
 * has not enabled it.
 */

describe('calendarModule — what the shell reads', () => {
  it('is gated on the capability the backend gates the same routes on', () => {
    // Not `calendar`, not `calendars`. This exact string is checked against
    // `organisations.enabled_capabilities` and by `requireOrgAdminCapability`.
    expect(calendarModule.capability).toBe('calendar-bookings');
  });

  it('names itself through i18n keys, never literal English', () => {
    for (const value of [
      calendarModule.name,
      calendarModule.title,
      calendarModule.description,
      calendarModule.card.title,
      calendarModule.card.description,
    ]) {
      expect(value).toMatch(/^modules\.calendar\./);
    }
  });

  it('lands on the calendars list from the dashboard card', () => {
    expect(calendarModule.card.path).toBe('/calendar');
    expect(calendarModule.card.icon).toBeDefined();
  });
});

describe('calendarModule — routes', () => {
  const paths = () => calendarModule.routes.map((route) => route.path);

  it('mounts every screen the menu and the card can reach', () => {
    expect(paths()).toEqual(
      expect.arrayContaining([
        'calendar',
        'calendar/new',
        'calendar/:id',
        'calendar/:id/edit',
        'calendar/bookings',
        'calendar/bookings/:id',
      ])
    );
  });

  it('declares no route twice, so the router cannot resolve one arbitrarily', () => {
    expect(new Set(paths()).size).toBe(paths().length);
  });

  it('never starts a path with a slash — the shell mounts these relatively', () => {
    for (const path of paths()) {
      expect(path.startsWith('/')).toBe(false);
    }
  });

  it('lazily loads every screen, so a club without the capability downloads none of it', () => {
    for (const route of calendarModule.routes) {
      expect(route.component).toBeDefined();
      // A `lazy()` component is an object with a `$$typeof`, not a function.
      expect(typeof route.component).toBe('object');
    }
  });

  it('gates the discount screens separately from the module itself', () => {
    const discountRoutes = calendarModule.routes.filter((route) =>
      route.path.startsWith('calendar/discounts')
    );

    expect(discountRoutes.length).toBeGreaterThan(0);
    for (const route of discountRoutes) {
      expect(route.capability).toBe('calendar-discounts');
    }
  });

  it('leaves the booking screens ungated behind anything but the module', () => {
    const bookingRoutes = calendarModule.routes.filter((route) =>
      route.path.startsWith('calendar/bookings')
    );

    for (const route of bookingRoutes) {
      expect(route.capability).toBeUndefined();
    }
  });
});

describe('calendarModule — the navigation rail', () => {
  it('offers calendars, bookings and discounts', () => {
    expect(calendarModule.subMenuItems?.map((item) => item.path)).toEqual([
      '/calendar',
      '/calendar/bookings',
      '/calendar/discounts',
    ]);
  });

  it('labels every item through i18n and gives each an icon', () => {
    for (const item of calendarModule.subMenuItems ?? []) {
      expect(item.label).toMatch(/^modules\.calendar\.menu\./);
      expect(item.icon).toBeDefined();
    }
  });

  it('hides the discounts item unless the club has that capability too', () => {
    const discounts = calendarModule.subMenuItems?.find(
      (item) => item.path === '/calendar/discounts'
    );

    expect(discounts?.capability).toBe('calendar-discounts');
  });

  it('points every menu item at a route the module actually mounts', () => {
    const mounted = new Set(calendarModule.routes.map((route) => `/${route.path}`));

    for (const item of calendarModule.subMenuItems ?? []) {
      expect(mounted.has(item.path)).toBe(true);
    }
  });
});
