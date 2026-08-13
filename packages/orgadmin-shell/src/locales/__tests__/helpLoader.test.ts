/**
 * Help content loader.
 *
 * Contextual help is a set of markdown files under `locales/<locale>/help`,
 * named `<moduleId>-<pageId>.md`. This is where the fallback chain lives — the
 * drawer only renders what comes back — so it is tested here against the real
 * bundled content rather than a fixture, which also means a module whose help
 * file is deleted shows up as a failure.
 *
 * Only en-GB has been written so far; the other five locales fall back to it,
 * which is the behaviour that keeps a French reader from seeing an empty drawer.
 */

import { describe, it, expect } from 'vitest';
import { getHelpContent, helpContent } from '../helpLoader';

describe('getHelpContent', () => {
  it('returns the page-specific content when it exists', () => {
    const content = getHelpContent('en-GB', 'users', 'list');

    expect(content).toBeTruthy();
    // users-list.md, not users-overview.md.
    expect(content).toBe(helpContent['en-GB'].users.list);
    expect(content).not.toBe(helpContent['en-GB'].users.overview);
  });

  /** Most pages have no help file of their own; the module's overview is the answer. */
  it('falls back to the module overview for a page with no file of its own', () => {
    expect(getHelpContent('en-GB', 'users', 'a-page-nobody-wrote-help-for')).toBe(
      helpContent['en-GB'].users.overview
    );
  });

  /**
   * The reason a French reader sees help at all: nothing has been translated
   * yet, so every locale but en-GB resolves through this branch.
   */
  it('falls back to en-GB when the locale has no content of its own', () => {
    expect(getHelpContent('fr-FR', 'dashboard', 'overview')).toBe(
      helpContent['en-GB'].dashboard.overview
    );
    expect(getHelpContent('de-DE', 'users', 'list')).toBe(helpContent['en-GB'].users.list);
  });

  it('falls back to the en-GB module overview when even the page is missing there', () => {
    expect(getHelpContent('it-IT', 'events', 'no-such-page')).toBe(
      helpContent['en-GB'].events.overview
    );
  });

  /** The drawer needs a null to know to show "not yet available" instead of a blank. */
  it('returns null when no help exists for the module at all', () => {
    expect(getHelpContent('en-GB', 'a-module-with-no-help', 'overview')).toBeNull();
    expect(getHelpContent('pt-PT', 'a-module-with-no-help', 'overview')).toBeNull();
  });

  it('returns null for an unknown locale with an unknown module', () => {
    expect(getHelpContent('zz-ZZ', 'a-module-with-no-help', 'overview')).toBeNull();
  });

  /** An unknown locale is still a reader who needs help — en-GB carries it. */
  it('still resolves a known module for an unknown locale', () => {
    expect(getHelpContent('zz-ZZ', 'dashboard', 'overview')).toBe(
      helpContent['en-GB'].dashboard.overview
    );
  });
});

describe('bundled help content', () => {
  it('gives every gated module an overview, so no module opens an empty drawer', () => {
    const modules = [
      'dashboard',
      'events',
      'memberships',
      'merchandise',
      'calendar',
      'registrations',
      'ticketing',
      'forms',
      'settings',
      'payments',
      'users',
    ];

    for (const moduleId of modules) {
      expect(getHelpContent('en-GB', moduleId, 'overview')).toBeTruthy();
    }
  });

  it('parses `<moduleId>-<pageId>.md` into module and page', () => {
    // users-create.md, users-list.md and users-overview.md are one module.
    expect(Object.keys(helpContent['en-GB'].users).sort()).toEqual([
      'create',
      'list',
      'overview',
    ]);
  });

  it('has an entry for all six locales, even the ones with nothing written yet', () => {
    expect(Object.keys(helpContent).sort()).toEqual([
      'de-DE',
      'en-GB',
      'es-ES',
      'fr-FR',
      'it-IT',
      'pt-PT',
    ]);
  });
});
