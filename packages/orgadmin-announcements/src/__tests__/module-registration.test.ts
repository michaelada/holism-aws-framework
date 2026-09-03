import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { announcementsModule } from '../index';

/**
 * The module's registration, which is its contract with the shell.
 *
 * A typo in a capability name fails no build and no page test: it silently
 * hides a paid-for module from every club, or shows one to a club that has not
 * enabled it. And a module the shell never adds to `ALL_MODULES` is a menu
 * item nobody ever sees, however complete the pages behind it are.
 */

describe('announcementsModule — what the shell reads', () => {
  it('is gated on the capability the backend gates the same routes on', () => {
    // `org-announcements`, not `announcements`: the module id and the
    // capability are deliberately different strings, and easy to transpose.
    expect(announcementsModule.capability).toBe('org-announcements');
    expect(announcementsModule.id).toBe('announcements');
  });

  it('names itself through i18n keys, never literal English', () => {
    for (const value of [
      announcementsModule.name,
      announcementsModule.title,
      announcementsModule.description,
      announcementsModule.card.title,
      announcementsModule.card.description,
      announcementsModule.menuItem?.label,
    ]) {
      expect(value).toMatch(/^modules\.announcements\./);
    }
  });

  it('offers the club a menu entry, which is the whole ask', () => {
    // "the Org Admin UI would have a new Menu option called Announcements".
    expect(announcementsModule.menuItem?.path).toBe('/announcements');
    expect(announcementsModule.card.path).toBe('/announcements');
  });
});

describe('announcementsModule — routes', () => {
  const paths = announcementsModule.routes.map((route) => route.path);

  it('covers the list and both ways into the editor', () => {
    expect(paths).toEqual(['announcements', 'announcements/new', 'announcements/:id/edit']);
  });

  it('registers paths relative to the shell, without a leading slash', () => {
    // The shell composes these under its own basename; a leading slash there
    // would mount the route at the site root instead.
    for (const path of paths) expect(path.startsWith('/')).toBe(false);
  });

  it('lazy-loads every page', () => {
    // The module is registered for clubs that have the capability, but its
    // pages should not be in the bundle every other club downloads.
    for (const route of announcementsModule.routes) {
      expect(typeof route.component).toBe('object');
    }
  });
});

describe('the shell', () => {
  const app = readFileSync(
    join(__dirname, '..', '..', '..', 'orgadmin-shell', 'src', 'App.tsx'),
    'utf-8'
  );

  it('actually registers this module', () => {
    /*
     * The one thing this package cannot check about itself, and the one that
     * makes everything else here pointless if it is missing: a module absent
     * from `ALL_MODULES` has no routes, no menu item and no way in.
     */
    expect(app).toContain("from '@itsplainsailing/orgadmin-announcements'");
    expect(app).toMatch(/ALL_MODULES[\s\S]*announcementsModule/);
  });
});
