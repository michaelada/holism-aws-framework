import { describe, it, expect } from 'vitest';
import { merchandiseModule } from '../index';

/**
 * The module's registration, which is its contract with the shell.
 *
 * A typo in a capability name does not fail a build or a page test — it
 * silently hides a paid-for module from every club, or shows one to a club that
 * has not enabled it. Nothing else in this package asserts any of it.
 */

describe('merchandiseModule — what the shell reads', () => {
  it('is gated on the capability the backend gates the same routes on', () => {
    expect(merchandiseModule.capability).toBe('merchandise');
  });

  it('names itself through i18n keys, never literal English', () => {
    for (const value of [
      merchandiseModule.name,
      merchandiseModule.title,
      merchandiseModule.description,
      merchandiseModule.card.title,
      merchandiseModule.card.description,
    ]) {
      expect(value).toMatch(/^modules\.merchandise\./);
    }
  });

  it('lands on the merchandise list from the dashboard card', () => {
    expect(merchandiseModule.card.path).toBe('/merchandise');
    expect(merchandiseModule.card.icon).toBeDefined();
  });
});

describe('merchandiseModule — routes', () => {
  const paths = () => merchandiseModule.routes.map((route) => route.path);

  it('mounts the shop, its items and its orders', () => {
    expect(paths()).toEqual(
      expect.arrayContaining([
        'merchandise',
        'merchandise/new',
        'merchandise/:id',
        'merchandise/:id/edit',
        'merchandise/orders',
        'merchandise/orders/:id',
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
    for (const route of merchandiseModule.routes) {
      expect(route.component).toBeDefined();
      expect(typeof route.component).toBe('object');
    }
  });

  it('gates the discount screens separately from the shop itself', () => {
    const discountRoutes = merchandiseModule.routes.filter((route) =>
      route.path.startsWith('merchandise/discounts')
    );

    expect(discountRoutes.length).toBeGreaterThan(0);
    for (const route of discountRoutes) {
      expect(route.capability).toBe('merchandise-discounts');
    }
  });

  it('leaves the order screens ungated behind anything but the module', () => {
    for (const route of merchandiseModule.routes.filter((r) =>
      r.path.startsWith('merchandise/orders')
    )) {
      expect(route.capability).toBeUndefined();
    }
  });
});

describe('merchandiseModule — the navigation rail', () => {
  it('offers the items, the discounts and the orders', () => {
    expect(merchandiseModule.subMenuItems?.map((item) => item.path)).toEqual([
      '/merchandise',
      '/merchandise/discounts',
      '/merchandise/orders',
    ]);
  });

  it('labels every item through i18n and gives each an icon', () => {
    for (const item of merchandiseModule.subMenuItems ?? []) {
      expect(item.label).toMatch(/^modules\.merchandise\.menu\./);
      expect(item.icon).toBeDefined();
    }
  });

  it('hides the discounts item unless the club has that capability too', () => {
    const discounts = merchandiseModule.subMenuItems?.find(
      (item) => item.path === '/merchandise/discounts'
    );

    expect(discounts?.capability).toBe('merchandise-discounts');
  });

  it('points every menu item at a route the module actually mounts', () => {
    const mounted = new Set(merchandiseModule.routes.map((route) => `/${route.path}`));

    for (const item of merchandiseModule.subMenuItems ?? []) {
      expect(mounted.has(item.path)).toBe(true);
    }
  });
});
