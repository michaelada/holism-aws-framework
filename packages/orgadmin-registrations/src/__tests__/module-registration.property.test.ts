/**
 * Property-based tests for module registration capability gating.
 *
 * Tests the registrationsModule configuration object directly to verify
 * that capability fields are correctly set for card visibility, discount
 * routes, and discount sub-menu items.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

let registrationsModule: any;

beforeAll(async () => {
  const mod = await import('../module.config');
  registrationsModule = mod.registrationsModule;
});

describe('Feature: registrations-module, Property 1: Capability-gated card visibility', () => {
  /**
   * **Validates: Requirements 1.1, 1.3**
   *
   * For any organisation, the Registrations card on the Landing Page should
   * be visible if and only if the organisation's enabled capabilities include
   * "registrations".
   *
   * We verify this by checking that the module's capability field is
   * "registrations" — the shell uses this field to gate card visibility.
   */
  it('card is visible iff "registrations" capability is enabled', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 1, maxLength: 20 }),
          { minLength: 0, maxLength: 10 },
        ),
        (enabledCapabilities: string[]) => {
          const hasRegistrations = enabledCapabilities.includes('registrations');

          // The module declares capability: 'registrations'
          // The shell shows the card iff the org's capabilities include the module's capability
          const moduleCapability = registrationsModule.capability;
          expect(moduleCapability).toBe('registrations');

          const cardWouldBeVisible = enabledCapabilities.includes(moduleCapability);
          expect(cardWouldBeVisible).toBe(hasRegistrations);

          // Also verify the card has required fields
          expect(registrationsModule.card).toBeDefined();
          expect(registrationsModule.card.title).toBeTruthy();
          expect(registrationsModule.card.description).toBeTruthy();
          expect(registrationsModule.card.icon).toBeDefined();
          expect(registrationsModule.card.path).toBe('/registrations');
        },
      ),
      { numRuns: 20 },
    );
  });
});


describe('Feature: registrations-module, Property 21: Discount route capability gating', () => {
  /**
   * **Validates: Requirements 10.1, 10.9**
   *
   * For any organisation, the discount routes (/registrations/discounts,
   * /registrations/discounts/new, /registrations/discounts/:id/edit) should
   * be accessible if and only if the organisation has the
   * "registration-discounts" capability enabled.
   *
   * We verify this by checking that every discount route in the module
   * registration has capability: 'registration-discounts'.
   */
  it('discount routes are accessible iff "registration-discounts" capability is enabled', () => {
    const discountPaths = [
      'registrations/discounts',
      'registrations/discounts/new',
      'registrations/discounts/:id/edit',
    ];

    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 1, maxLength: 25 }),
          { minLength: 0, maxLength: 10 },
        ),
        (enabledCapabilities: string[]) => {
          const hasDiscountCap = enabledCapabilities.includes('registration-discounts');

          for (const discountPath of discountPaths) {
            const route = registrationsModule.routes.find(
              (r: any) => r.path === discountPath,
            );
            expect(route).toBeDefined();
            expect(route.capability).toBe('registration-discounts');

            // The shell grants access iff the org's capabilities include the route's capability
            const routeAccessible = enabledCapabilities.includes(route.capability);
            expect(routeAccessible).toBe(hasDiscountCap);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe('Feature: registrations-module, Property 22: Discounts sub-menu capability gating', () => {
  /**
   * **Validates: Requirements 1.5, 1.6**
   *
   * For any organisation, the "Discounts" sub-menu item in the Registrations
   * module navigation should be visible if and only if the organisation has
   * the "registration-discounts" capability enabled.
   *
   * We verify this by checking that the Discounts sub-menu item has
   * capability: 'registration-discounts' and that non-discount items have
   * no capability gating.
   */
  it('Discounts sub-menu is visible iff "registration-discounts" capability is enabled', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 1, maxLength: 25 }),
          { minLength: 0, maxLength: 10 },
        ),
        (enabledCapabilities: string[]) => {
          const hasDiscountCap = enabledCapabilities.includes('registration-discounts');
          const subMenuItems = registrationsModule.subMenuItems!;

          const discountsItem = subMenuItems.find(
            (item: any) => item.path === '/registrations/discounts',
          );
          expect(discountsItem).toBeDefined();
          expect(discountsItem.capability).toBe('registration-discounts');

          // The shell shows the sub-menu item iff the org's capabilities include the item's capability
          const discountsVisible = enabledCapabilities.includes(discountsItem.capability);
          expect(discountsVisible).toBe(hasDiscountCap);

          // Non-discount sub-menu items should always be visible (no capability gating)
          const nonDiscountItems = subMenuItems.filter(
            (item: any) => item.path !== '/registrations/discounts',
          );
          for (const item of nonDiscountItems) {
            expect(item.capability).toBeUndefined();
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
