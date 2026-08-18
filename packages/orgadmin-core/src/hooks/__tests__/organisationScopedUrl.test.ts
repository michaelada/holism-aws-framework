import { describe, it, expect } from 'vitest';
import { organisationScopedUrl } from '../useApi';

/**
 * Putting the organisation in the URL rather than only in a header.
 *
 * The org-admin data routers are mounted at
 * `/api/orgadmin/organisations/:organisationId/...` as well as bare, and this
 * function is what makes the app use the scoped form — so a request is legible
 * in a log without cross-referencing a header against a session.
 *
 * Done here rather than at the ~240 call sites because half of those live in
 * components with no organisation in scope. One rule, applied once, beats forty
 * files of new plumbing to change what appears on the wire.
 */
describe('organisationScopedUrl', () => {
  const ORG = 'org-123';

  it('puts the organisation into an org-admin path', () => {
    expect(organisationScopedUrl('/api/orgadmin/events/e-1', ORG)).toBe(
      '/api/orgadmin/organisations/org-123/events/e-1'
    );
  });

  it('leaves a path that already names one exactly as it is', () => {
    // The caller has been specific. The server refuses any disagreement between
    // the path and the resource anyway, so second-guessing here could only
    // break a deliberate choice.
    const url = '/api/orgadmin/organisations/org-999/discounts';
    expect(organisationScopedUrl(url, ORG)).toBe(url);
  });

  it('leaves the auth paths alone', () => {
    /*
     * `/auth/me` is how an administrator finds out which organisations they
     * have. Requiring one in order to ask would be circular.
     */
    expect(organisationScopedUrl('/api/orgadmin/auth/me', ORG)).toBe('/api/orgadmin/auth/me');
    expect(organisationScopedUrl('/api/orgadmin/auth/capabilities', ORG)).toBe(
      '/api/orgadmin/auth/capabilities'
    );
  });

  it('leaves anything outside /api/orgadmin alone', () => {
    expect(organisationScopedUrl('/api/admin/organizations', ORG)).toBe('/api/admin/organizations');
    expect(organisationScopedUrl('/api/user-preferences/onboarding', ORG)).toBe(
      '/api/user-preferences/onboarding'
    );
  });

  it('changes nothing before an organisation is known', () => {
    // During start-up the shell has a token before it has an organisation, and
    // those requests must still go somewhere valid.
    expect(organisationScopedUrl('/api/orgadmin/events/e-1', null)).toBe('/api/orgadmin/events/e-1');
  });

  it('keeps the query string', () => {
    expect(organisationScopedUrl('/api/orgadmin/members?page=2', ORG)).toBe(
      '/api/orgadmin/organisations/org-123/members?page=2'
    );
  });

  it('rewrites only the first occurrence', () => {
    // A path that mentions the prefix again in a parameter must not be mangled.
    expect(organisationScopedUrl('/api/orgadmin/files/api%2Forgadmin%2Fx', ORG)).toBe(
      '/api/orgadmin/organisations/org-123/files/api%2Forgadmin%2Fx'
    );
  });
});
