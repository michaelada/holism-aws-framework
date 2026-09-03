/**
 * Integration tests for discount navigation in memberships module
 * 
 * Tests:
 * - Navigation from memberships to discounts list
 * - ModuleType context propagation
 * - Capability-based menu visibility
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import { membershipsModule } from '../../index';

/*
 * The capability is `membership-discounts`, not `entry-discounts`.
 *
 * There are six discount capabilities, one per area — entry, membership,
 * calendar, merchandise, registration and multi-area. These assertions named
 * the *events* one, which is what the equivalent suite in orgadmin-events
 * checks and where this file was evidently copied from.
 *
 * It is worth being exact about: gating the memberships discounts on the
 * events capability would show the menu to a club that runs events and has not
 * bought membership discounts, and hide it from one that has.
 */
describe('Feature: membership-discount-integration - Discount Navigation Integration', () => {
  describe('Navigation Configuration', () => {
    it('should include discounts submenu item in memberships module', () => {
      // Requirement 1.1: The Membership_Module SHALL include a "Discounts" submenu item
      const discountsMenuItem = membershipsModule.subMenuItems?.find(
        (item) => item.path === '/members/discounts'
      );

      expect(discountsMenuItem).toBeDefined();
      expect(discountsMenuItem?.label).toBe('modules.memberships.menu.discounts');
    });

    it('should position discounts menu item after members database and membership types', () => {
      // Requirement 1.3: The Discounts submenu item SHALL appear after existing menu items
      const menuItems = membershipsModule.subMenuItems || [];
      const membersDbIndex = menuItems.findIndex((item) => item.path === '/members');
      const membershipTypesIndex = menuItems.findIndex((item) => item.path === '/members/types');
      const discountsIndex = menuItems.findIndex((item) => item.path === '/members/discounts');

      expect(membersDbIndex).toBeGreaterThanOrEqual(0);
      expect(membershipTypesIndex).toBeGreaterThan(membersDbIndex);
      expect(discountsIndex).toBeGreaterThan(membershipTypesIndex);
    });

    it('should require entry-discounts capability for discounts menu item', () => {
      // Requirement 1.4: The Discounts submenu item SHALL only be visible if organisation has capability
      const discountsMenuItem = membershipsModule.subMenuItems?.find(
        (item) => item.path === '/members/discounts'
      );

      expect(discountsMenuItem?.capability).toBe('membership-discounts');
    });
  });

  describe('Route Configuration', () => {
    it('should define route for discounts list page', () => {
      // Requirement 2.1: The Membership_Module SHALL reuse DiscountsListPage
      const discountsListRoute = membershipsModule.routes.find(
        (route) => route.path === 'members/discounts'
      );

      expect(discountsListRoute).toBeDefined();
      expect(discountsListRoute?.capability).toBe('membership-discounts');
    });

    it('should define route for create discount page', () => {
      // Requirement 2.2: The Membership_Module SHALL reuse CreateDiscountPage
      const createDiscountRoute = membershipsModule.routes.find(
        (route) => route.path === 'members/discounts/new'
      );

      expect(createDiscountRoute).toBeDefined();
      expect(createDiscountRoute?.capability).toBe('membership-discounts');
    });

    it('should define route for edit discount page', () => {
      // Requirement 2.3: The Membership_Module SHALL reuse EditDiscountPage
      const editDiscountRoute = membershipsModule.routes.find(
        (route) => route.path === 'members/discounts/:id/edit'
      );

      expect(editDiscountRoute).toBeDefined();
      expect(editDiscountRoute?.capability).toBe('membership-discounts');
    });

    it('should require entry-discounts capability for all discount routes', () => {
      // Requirement 1.4: All discount routes should be capability-gated
      const discountRoutes = membershipsModule.routes.filter((route) =>
        route.path.includes('discounts')
      );

      expect(discountRoutes.length).toBeGreaterThan(0);
      discountRoutes.forEach((route) => {
        expect(route.capability).toBe('membership-discounts');
      });
    });
  });

  describe('Capability-Based Visibility', () => {
    it('should show discounts menu when organisation has entry-discounts capability', () => {
      // Requirement 1.4: Discounts menu visible when capability enabled
      const discountsMenuItem = membershipsModule.subMenuItems?.find(
        (item) => item.path === '/members/discounts'
      );

      // The menu item exists and has the capability requirement
      expect(discountsMenuItem).toBeDefined();
      expect(discountsMenuItem?.capability).toBe('membership-discounts');

      // In a real application, the shell would check this capability
      // and conditionally render the menu item
    });

    it('should register the usage page the list’s View Usage icon leads to', () => {
      /*
       * It navigated to `/members/discounts/:id/stats` from the day the icon
       * was added, and no module registered that path — so the icon led to Page
       * Not Found. See docs/DISCOUNT_USAGE_PAGE.md.
       */
      const usage = membershipsModule.routes.find(
        (route) => route.path === 'members/discounts/:id/stats'
      );

      expect(usage).toBeDefined();
      expect(usage?.capability).toBe('membership-discounts');
    });

    it('should gate all discount routes with entry-discounts capability', () => {
      // Requirement 1.4: All discount routes should check capability
      const discountRoutes = membershipsModule.routes.filter((route) =>
        route.path.includes('discounts')
      );

      expect(discountRoutes.length).toBe(4); // list, create, edit, usage
      discountRoutes.forEach((route) => {
        expect(route.capability).toBe('membership-discounts');
      });
    });
  });

  describe('Module Context Isolation', () => {
    it('should use /members base path for all discount routes', () => {
      // Requirement 2.5: Memberships discount routes should use /members base path
      const discountRoutes = membershipsModule.routes.filter((route) =>
        route.path.includes('discounts')
      );

      discountRoutes.forEach((route) => {
        expect(route.path).toMatch(/^members\/discounts/);
      });
    });

    it('should not interfere with events module discount routes', () => {
      // Requirement 2.5: Memberships and Events should have separate route namespaces
      const membershipDiscountRoutes = membershipsModule.routes.filter((route) =>
        route.path.includes('discounts')
      );

      // All membership discount routes should be under /members
      membershipDiscountRoutes.forEach((route) => {
        expect(route.path).not.toMatch(/^events\//);
        expect(route.path).toMatch(/^members\//);
      });
    });
  });
});
