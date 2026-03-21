/**
 * Test: Events Module Configuration Validation
 * 
 * Validates that the Events module configuration has the correct
 * capability requirements for Event Types and Venues features.
 * 
 * This test reads the index.ts file directly to avoid import issues.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Events Module Configuration', () => {
  const indexPath = join(__dirname, '..', 'index.ts');
  const indexContent = readFileSync(indexPath, 'utf-8');

  describe('Submenu Items Capability Configuration', () => {
    it('should have event-types capability for Event Types submenu', () => {
      // Find the Event Types submenu item configuration
      const eventTypesSubmenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.eventTypes['"],[\s\S]*?path:\s*['"]\/events\/types['"],[\s\S]*?icon:\s*CategoryIcon,[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(eventTypesSubmenuMatch).toBeTruthy();
      expect(eventTypesSubmenuMatch?.[1]).toBe('event-types');
    });

    it('should have venues capability for Venues submenu', () => {
      // Find the Venues submenu item configuration
      const venuesSubmenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.venues['"],[\s\S]*?path:\s*['"]\/events\/venues['"],[\s\S]*?icon:\s*LocationIcon,[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(venuesSubmenuMatch).toBeTruthy();
      expect(venuesSubmenuMatch?.[1]).toBe('venues');
    });

    it('should have entry-discounts capability for Discounts submenu', () => {
      // Find the Discounts submenu item configuration
      const discountsSubmenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.discounts['"],[\s\S]*?path:\s*['"]\/events\/discounts['"],[\s\S]*?icon:\s*DiscountIcon,[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(discountsSubmenuMatch).toBeTruthy();
      expect(discountsSubmenuMatch?.[1]).toBe('entry-discounts');
    });

    it('should NOT have capability requirement for main Events submenu', () => {
      // Find the main Events submenu item - it should not have a capability line
      const eventsSubmenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.events['"],[\s\S]*?path:\s*['"]\/events['"],[\s\S]*?icon:\s*EventIcon,[\s\S]*?}/
      );
      
      expect(eventsSubmenuMatch).toBeTruthy();
      
      // Check that there's no capability property in this block
      const hasCapability = eventsSubmenuMatch?.[0].includes('capability:');
      expect(hasCapability).toBe(false);
    });
  });

  describe('Routes Capability Configuration', () => {
    it('should have event-types capability for Event Types route', () => {
      // Find the Event Types route configuration
      const eventTypesRouteMatch = indexContent.match(
        /path:\s*['"]events\/types['"],[\s\S]*?component:[\s\S]*?EventTypesListPage[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(eventTypesRouteMatch).toBeTruthy();
      expect(eventTypesRouteMatch?.[1]).toBe('event-types');
    });

    it('should have venues capability for Venues route', () => {
      // Find the Venues route configuration
      const venuesRouteMatch = indexContent.match(
        /path:\s*['"]events\/venues['"],[\s\S]*?component:[\s\S]*?VenuesListPage[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(venuesRouteMatch).toBeTruthy();
      expect(venuesRouteMatch?.[1]).toBe('venues');
    });

    it('should have entry-discounts capability for Discounts routes', () => {
      // Find all Discounts route configurations
      const discountsRoutes = [
        /path:\s*['"]events\/discounts['"],[\s\S]*?component:[\s\S]*?DiscountsListPage[\s\S]*?capability:\s*['"]([^'"]+)['"]/,
        /path:\s*['"]events\/discounts\/new['"],[\s\S]*?component:[\s\S]*?CreateDiscountPage[\s\S]*?capability:\s*['"]([^'"]+)['"]/,
        /path:\s*['"]events\/discounts\/:id\/edit['"],[\s\S]*?component:[\s\S]*?CreateDiscountPage[\s\S]*?capability:\s*['"]([^'"]+)['"]/,
      ];

      discountsRoutes.forEach((regex, index) => {
        const match = indexContent.match(regex);
        expect(match, `Discounts route ${index + 1} should have capability`).toBeTruthy();
        expect(match?.[1], `Discounts route ${index + 1} should have entry-discounts capability`).toBe('entry-discounts');
      });
    });

    it('should NOT have capability requirement for main Events routes', () => {
      // Check main events routes don't have capability requirements
      const mainRoutes = [
        { path: 'events', component: 'EventsListPage' },
        { path: 'events/new', component: 'CreateEventPage' },
        { path: 'events/:id', component: 'EventDetailsPage' },
        { path: 'events/:id/edit', component: 'EditEventPage' },
        { path: 'events/:id/entries', component: 'EventEntriesPage' },
      ];

      mainRoutes.forEach(({ path, component }) => {
        // Create a regex to find the route block
        const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const routeBlockRegex = new RegExp(
          `path:\\s*['"]${escapedPath}['"],[\\s\\S]*?component:[\\s\\S]*?${component}[\\s\\S]*?},`,
          'm'
        );
        
        const match = indexContent.match(routeBlockRegex);
        expect(match, `Route ${path} should exist`).toBeTruthy();
        
        // Check that there's no capability property in this route block
        const hasCapability = match?.[0].includes('capability:');
        expect(hasCapability, `Route ${path} should not have capability requirement`).toBe(false);
      });
    });
  });

  describe('Module-Level Configuration', () => {
    it('should require event-management capability for the entire module', () => {
      const moduleCapabilityMatch = indexContent.match(
        /capability:\s*['"]event-management['"]/
      );
      
      expect(moduleCapabilityMatch).toBeTruthy();
    });

    it('should have all expected submenu items defined', () => {
      const submenuItems = [
        'modules.events.menu.events',
        'modules.events.menu.eventTypes',
        'modules.events.menu.venues',
        'modules.events.menu.discounts',
      ];

      submenuItems.forEach(label => {
        const hasSubmenu = indexContent.includes(label);
        expect(hasSubmenu, `Should have submenu item: ${label}`).toBe(true);
      });
    });
  });

  describe('Consistency Checks', () => {
    it('should have matching capability requirements for Event Types submenu and route', () => {
      const submenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.eventTypes['"],[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      const routeMatch = indexContent.match(
        /path:\s*['"]events\/types['"],[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(submenuMatch?.[1]).toBe(routeMatch?.[1]);
      expect(submenuMatch?.[1]).toBe('event-types');
    });

    it('should have matching capability requirements for Venues submenu and route', () => {
      const submenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.venues['"],[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      const routeMatch = indexContent.match(
        /path:\s*['"]events\/venues['"],[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      expect(submenuMatch?.[1]).toBe(routeMatch?.[1]);
      expect(submenuMatch?.[1]).toBe('venues');
    });

    it('should have matching capability requirements for Discounts submenu and routes', () => {
      const submenuMatch = indexContent.match(
        /label:\s*['"]modules\.events\.menu\.discounts['"],[\s\S]*?capability:\s*['"]([^'"]+)['"]/
      );
      
      // All discount routes should have the same capability
      const discountRouteMatches = [
        ...indexContent.matchAll(/path:\s*['"]events\/discounts[^'"]*['"],[\s\S]*?capability:\s*['"]([^'"]+)['"]/g)
      ];
      
      discountRouteMatches.forEach(match => {
        expect(match[1]).toBe(submenuMatch?.[1]);
        expect(match[1]).toBe('entry-discounts');
      });
    });
  });
});
