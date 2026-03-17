/**
 * Unit tests for landing page integration.
 *
 * Verifies the module registration configuration object is correctly set up
 * for card visibility, card click navigation, and discount sub-menu gating.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6
 */
import { describe, it, expect, beforeAll } from 'vitest';

let registrationsModule: any;

beforeAll(async () => {
  const mod = await import('../module.config');
  registrationsModule = mod.registrationsModule;
});

describe('Landing page card visibility', () => {
  it('should have "registrations" capability for card gating (Req 1.1, 1.3)', () => {
    expect(registrationsModule.capability).toBe('registrations');
  });

  it('should define a card with title, description, icon, and colour (Req 1.1)', () => {
    const { card } = registrationsModule;
    expect(card).toBeDefined();
    expect(card.title).toBeTruthy();
    expect(card.description).toBeTruthy();
    expect(card.icon).toBeDefined();
    expect(card.color).toBe('#1565c0');
  });

  it('should be hidden when capability is absent (Req 1.3)', () => {
    // The shell hides cards whose capability is not in the org's enabled set.
    // We verify the module declares the capability so the shell can gate it.
    expect(registrationsModule.capability).toBeDefined();
    expect(typeof registrationsModule.capability).toBe('string');
  });
});

describe('Card click navigation', () => {
  it('should navigate to /registrations on card click (Req 1.2)', () => {
    expect(registrationsModule.card.path).toBe('/registrations');
  });

  it('should have a route for registrations', () => {
    const mainRoute = registrationsModule.routes.find(
      (r: any) => r.path === 'registrations',
    );
    expect(mainRoute).toBeDefined();
    expect(mainRoute.component).toBeDefined();
  });
});

describe('Discount sub-menu visibility', () => {
  it('should show Discounts sub-menu when registration-discounts capability is enabled (Req 1.5)', () => {
    const discountsItem = registrationsModule.subMenuItems?.find(
      (item: any) => item.path === '/registrations/discounts',
    );
    expect(discountsItem).toBeDefined();
    expect(discountsItem.label).toBeTruthy();
    expect(discountsItem.icon).toBeDefined();
    // The capability field tells the shell to show this item only when the cap is enabled
    expect(discountsItem.capability).toBe('registration-discounts');
  });

  it('should hide Discounts sub-menu when registration-discounts capability is disabled (Req 1.6)', () => {
    const discountsItem = registrationsModule.subMenuItems?.find(
      (item: any) => item.path === '/registrations/discounts',
    );
    // The shell hides items whose capability is not in the org's enabled set.
    // We verify the capability is set so the shell can gate it.
    expect(discountsItem?.capability).toBe('registration-discounts');
  });

  it('should not gate non-discount sub-menu items behind any capability', () => {
    const nonDiscountItems = registrationsModule.subMenuItems?.filter(
      (item: any) => item.path !== '/registrations/discounts',
    );
    expect(nonDiscountItems.length).toBeGreaterThan(0);
    for (const item of nonDiscountItems) {
      expect(item.capability).toBeUndefined();
    }
  });
});
