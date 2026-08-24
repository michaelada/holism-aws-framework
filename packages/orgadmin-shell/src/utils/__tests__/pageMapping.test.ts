import { describe, it, expect } from 'vitest';
import {
  pageMappings,
  resolvePageInfo,
  getModuleFromPath,
  getPageIdFromPath,
} from '../pageMapping';

/**
 * Turning the route someone is on into "which help page is this".
 *
 * The table is ordered, and the resolver walks it in order after trying an
 * exact match — so a literal route listed *after* a pattern that also matches
 * it is unreachable. `/events/discounts` and `/events/:id` are exactly that
 * pair: without the exact-match pass, opening the discounts list would show the
 * help for a single event.
 *
 * A wrong answer here is not fatal, but it is silent: the operator gets help
 * for a screen they are not on, and nothing indicates why.
 */

describe('resolvePageInfo — exact routes', () => {
  it('finds the dashboard', () => {
    expect(resolvePageInfo('/dashboard')).toMatchObject({
      pageId: 'overview',
      moduleId: 'dashboard',
    });
  });

  it('treats the root as the dashboard', () => {
    expect(resolvePageInfo('/')).toMatchObject({ moduleId: 'dashboard' });
  });

  it('finds a list page', () => {
    expect(resolvePageInfo('/users')).toMatchObject({ pageId: 'list', moduleId: 'users' });
  });
});

describe('resolvePageInfo — routes with an id in them', () => {
  it('matches a detail route whatever the id is', () => {
    expect(resolvePageInfo('/users/42')).toMatchObject({ pageId: 'detail', moduleId: 'users' });
    expect(resolvePageInfo('/users/a-uuid-like-this')).toMatchObject({ pageId: 'detail' });
  });

  it('matches an edit route under an id', () => {
    expect(resolvePageInfo('/users/42/edit')).toMatchObject({ pageId: 'edit', moduleId: 'users' });
  });

  it('keeps a deeper route distinct from the detail route above it', () => {
    expect(resolvePageInfo('/forms/7/submissions')).toMatchObject({ pageId: 'submissions' });
    expect(resolvePageInfo('/forms/7')).toMatchObject({ pageId: 'detail' });
  });

  /*
   * `/users/create` is also a match for `/users/:id`. It is listed first, and
   * the exact pass runs before the pattern pass — both have to hold, or the
   * create screen offers help for viewing a user who does not exist.
   */
  it('prefers a literal segment over a parameter that would also match it', () => {
    expect(resolvePageInfo('/users/create')).toMatchObject({ pageId: 'create' });
    expect(resolvePageInfo('/users/invite')).toMatchObject({ pageId: 'invite' });
  });

  it('resolves the events discounts list, not a single event', () => {
    expect(resolvePageInfo('/events/discounts')).toMatchObject({
      pageId: 'discounts',
      moduleId: 'events',
    });
  });

  it('resolves editing a discount under events', () => {
    expect(resolvePageInfo('/events/discounts/9/edit')).toMatchObject({
      pageId: 'discounts',
      moduleId: 'events',
    });
  });

  it('resolves membership types rather than a membership with the id "types"', () => {
    expect(resolvePageInfo('/memberships/types')).toMatchObject({ pageId: 'types' });
  });
});

describe('resolvePageInfo — routes it does not know', () => {
  it('answers with nothing rather than guessing', () => {
    expect(resolvePageInfo('/nothing/like/this')).toBeUndefined();
  });

  it('does not let a parameter swallow extra path segments', () => {
    // `[^/]+` must not match across a slash, or every deeper route resolves to
    // the detail page of whatever sits above it.
    expect(resolvePageInfo('/users/42/edit/extra')).toBeUndefined();
  });

  it('does not match a prefix of a known route', () => {
    expect(resolvePageInfo('/user')).toBeUndefined();
  });

  it('answers with nothing for an empty path', () => {
    expect(resolvePageInfo('')).toBeUndefined();
  });
});

describe('the convenience readers', () => {
  it('gives the module for a path', () => {
    expect(getModuleFromPath('/events/7/edit')).toBe('events');
  });

  it('gives the page id for a path', () => {
    expect(getPageIdFromPath('/events/7/edit')).toBe('edit');
  });

  it('gives nothing for a route with no mapping', () => {
    expect(getModuleFromPath('/nothing')).toBeUndefined();
    expect(getPageIdFromPath('/nothing')).toBeUndefined();
  });
});

describe('the mapping table itself', () => {
  it('gives every route a page and a module', () => {
    pageMappings.forEach((mapping) => {
      expect(mapping.route.startsWith('/')).toBe(true);
      expect(mapping.pageId).toBeTruthy();
      expect(mapping.moduleId).toBeTruthy();
    });
  });

  it('lists no route twice', () => {
    const routes = pageMappings.map((m) => m.route);
    // A duplicate is dead weight: the second is unreachable behind the first.
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('resolves every route it lists', () => {
    // A literal route hidden behind an earlier pattern would resolve to the
    // wrong help page, and nothing on screen would say so.
    pageMappings.forEach((mapping) => {
      if (mapping.route.includes(':')) return;
      expect(resolvePageInfo(mapping.route)).toMatchObject({
        pageId: mapping.pageId,
        moduleId: mapping.moduleId,
      });
    });
  });
});
