/**
 * What `GET /api/orgadmin/auth/me` really answers.
 *
 * Two pages in this module read it and read *different* parts:
 *
 * - `MembersDatabasePage` takes `roles`, to decide whether to offer Add Member.
 * - `CreateMemberPage` takes `user.id`, and throws *"Failed to get current
 *   user"* without it.
 *
 * A fixture that returned only `{ roles }` therefore satisfied one page and
 * broke the other, which is how the end-to-end suite came to fail at the last
 * step of a flow that had otherwise worked. Keeping the shape in one place
 * means neither page can be served a half-answer.
 *
 * Mirrors `orgadmin-auth.routes.ts`.
 */
export interface AuthMeOptions {
  roles?: Array<{ id: string; name: string; displayName: string }>;
  organisationId?: string;
}

const ADMIN = { id: 'role-admin', name: 'admin', displayName: 'Administrator' };

export function authMeResponse(options: AuthMeOptions = {}) {
  const organisationId = options.organisationId ?? 'test-org-id';

  return {
    user: {
      id: 'org-user-1',
      email: 'admin@test.example',
      firstName: 'Test',
      lastName: 'Administrator',
      userName: 'admin@test.example',
      status: 'active',
      lastLogin: new Date().toISOString(),
    },
    organisation: {
      id: organisationId,
      name: 'Test Organisation',
      displayName: 'Test Organisation',
      urlCode: 'test',
      status: 'active',
      currency: 'EUR',
      language: 'en-GB',
      enabledCapabilities: ['memberships'],
      settings: {},
    },
    organisations: [
      { id: organisationId, displayName: 'Test Organisation', urlCode: 'test', isCurrent: true },
    ],
    capabilities: ['memberships'],
    // Administrator by default: the suites that care about the role gate pass
    // their own, and the rest should not trip over it.
    roles: options.roles ?? [ADMIN],
  };
}
