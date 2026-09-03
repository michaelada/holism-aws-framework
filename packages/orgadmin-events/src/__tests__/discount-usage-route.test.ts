/**
 * Wherever the discounts list is mounted, so is the page its icon leads to.
 *
 * `DiscountsListPage` is shared: five modules mount it under their own section,
 * and its *View Usage* icon navigates to `‹section›/discounts/:id/stats`. No
 * module ever registered that path, so the icon led to Page Not Found in every
 * one of them — a defect nothing could catch, because the navigation lives in
 * this package and the routing lives in four others.
 *
 * So the check reads those registries from disk. A module that gains the
 * discounts list without the usage page fails here rather than in a club's
 * hands.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PACKAGES = join(__dirname, '..', '..', '..');

const registryOf = (pkg: string): string =>
  readFileSync(join(PACKAGES, pkg, 'src', 'index.ts'), 'utf-8');

/** The modules that mount the shared discounts list, and their section. */
const MOUNTS: Array<[string, string, string]> = [
  ['orgadmin-events', 'events', 'entry-discounts'],
  ['orgadmin-memberships', 'members', 'membership-discounts'],
  ['orgadmin-merchandise', 'merchandise', 'merchandise-discounts'],
  ['orgadmin-calendar', 'calendar', 'calendar-discounts'],
];

describe('the discount usage route', () => {
  it.each(MOUNTS)('is registered in %s', (pkg, section) => {
    expect(registryOf(pkg)).toContain(`path: '${section}/discounts/:id/stats'`);
  });

  it.each(MOUNTS)('is gated in %s like the list it is reached from', (pkg, section, capability) => {
    /*
     * The same capability, not a laxer one: a club without the module's
     * discounts should not reach a discount's figures by typing the URL, and
     * the route is what enforces that — the icon is only a way in.
     */
    const registry = registryOf(pkg);
    const route = registry.slice(registry.indexOf(`path: '${section}/discounts/:id/stats'`));
    expect(route.slice(0, route.indexOf('}'))).toContain(`capability: '${capability}'`);
  });

  it.each(MOUNTS)('mounts a page for it in %s', (pkg) => {
    expect(registryOf(pkg)).toMatch(
      /path: '[a-z]+\/discounts\/:id\/stats',\s*\n\s*component: lazy\(\(\) => import\('\.\/pages\/DiscountUsagePage'\)\)/
    );
  });

  it('is where the list actually navigates', () => {
    // Read from the list itself, so renaming the path in one place and not the
    // other fails here rather than in a browser.
    const list = readFileSync(
      join(PACKAGES, 'orgadmin-events', 'src', 'pages', 'DiscountsListPage.tsx'),
      'utf-8'
    );

    expect(list).toContain('${getBasePath()}/discounts/${discount.id}/stats');
  });

  it('mounts the list in every module the check claims to cover', () => {
    // A guard on the guard: a module dropped from MOUNTS would silently stop
    // being checked, which is the shape of the original defect.
    for (const [pkg, section] of MOUNTS) {
      expect(registryOf(pkg)).toContain(`path: '${section}/discounts'`);
    }
  });
});
