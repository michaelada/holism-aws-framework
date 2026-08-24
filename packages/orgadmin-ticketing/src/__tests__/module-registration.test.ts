import { describe, it, expect } from 'vitest';
import { ticketingModule } from '../index';

/**
 * The module's registration, which is its contract with the shell.
 *
 * A typo in a capability name does not fail a build or a page test — it
 * silently hides a paid-for module from every club, or shows one to a club that
 * has not enabled it. Nothing else in this package asserts any of it.
 */

describe('ticketingModule — what the shell reads', () => {
  it('is gated on the capability the backend gates the same routes on', () => {
    // `event-ticketing`, not `ticketing`: the module's id and its capability are
    // deliberately different strings and are easy to transpose.
    expect(ticketingModule.capability).toBe('event-ticketing');
    expect(ticketingModule.id).toBe('ticketing');
  });

  it('names itself through i18n keys, never literal English', () => {
    for (const value of [
      ticketingModule.name,
      ticketingModule.title,
      ticketingModule.description,
      ticketingModule.card.title,
      ticketingModule.card.description,
    ]) {
      expect(value).toMatch(/^modules\.ticketing\./);
    }
  });

  it('lands on the ticketed-events overview from the dashboard card', () => {
    expect(ticketingModule.card.path).toBe('/tickets');
    expect(ticketingModule.card.icon).toBeDefined();
  });
});

describe('ticketingModule — routes', () => {
  const paths = () => ticketingModule.routes.map((route) => route.path);

  it('mounts the overview, one event’s tickets, and that event’s settings', () => {
    expect(paths()).toEqual(['tickets', 'tickets/:eventId', 'tickets/:eventId/settings']);
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
    for (const route of ticketingModule.routes) {
      expect(route.component).toBeDefined();
      expect(typeof route.component).toBe('object');
    }
  });

  it('gates nothing further — the module capability is the whole gate here', () => {
    for (const route of ticketingModule.routes) {
      expect(route.capability).toBeUndefined();
    }
  });

  it('keys the event routes on the same parameter name the pages read', () => {
    // `:eventId`, not `:id`. A rename here silently gives every ticket page an
    // undefined event and an empty screen.
    expect(paths().filter((path) => path.includes(':'))).toEqual([
      'tickets/:eventId',
      'tickets/:eventId/settings',
    ]);
  });
});

describe('ticketingModule — the navigation rail', () => {
  it('offers a single item rather than a submenu', () => {
    expect(ticketingModule.menuItem?.path).toBe('/tickets');
    expect(ticketingModule.subMenuItems).toBeUndefined();
  });

  it('labels the item through i18n and gives it an icon', () => {
    expect(ticketingModule.menuItem?.label).toMatch(/^modules\.ticketing\./);
    expect(ticketingModule.menuItem?.icon).toBeDefined();
  });

  it('points the menu item at a route the module actually mounts', () => {
    const mounted = new Set(ticketingModule.routes.map((route) => `/${route.path}`));

    expect(mounted.has(ticketingModule.menuItem!.path)).toBe(true);
  });
});
