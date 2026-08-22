import { vi } from 'vitest';

/**
 * The two `orgadmin-core` hooks a page cannot run without, stubbed.
 *
 * ## Overrides, not a replacement
 *
 * Unlike the shell mock, this deliberately does **not** stand in for the whole
 * module. `orgadmin-core` re-exports its hooks, components, utilities and six
 * feature areas; listing all of that would be a second copy of the package,
 * wrong within a week. Suites spread these over the real module instead:
 *
 * ```ts
 * vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => {
 *   const actual = await importOriginal<Record<string, unknown>>();
 *   const { coreMock } = await import('../../test/core-mock');
 *   return { ...actual, ...coreMock() };
 * });
 * ```
 *
 * Everything else keeps working, and nothing goes stale when core grows.
 *
 * ## Why they need stubbing at all
 *
 * `useOrganisation` throws *"must be used within an OrganisationProvider"* when
 * there is no provider above it, so any suite rendering a page without one dies
 * on the first render — not because the page is broken, but because the harness
 * is incomplete. Providing the organisation is more honest than wrapping every
 * test in a provider it does not otherwise care about.
 *
 * Pass data in for a suite that needs specific responses:
 *
 * ```ts
 * coreMock({ responses: { '/membership-types': [{ id: 't1', name: 'Junior' }] } })
 * ```
 */
export interface CoreMockOptions {
  /** Matched as a substring of the request URL; first match wins. */
  responses?: Record<string, unknown>;
  organisation?: { id: string; name: string; [key: string]: unknown } | null;
}

export function coreMock(options: CoreMockOptions = {}) {
  const responses = options.responses ?? {};

  const execute = vi.fn(async ({ url }: { url: string }) => {
    for (const [fragment, value] of Object.entries(responses)) {
      if (url.includes(fragment)) return value;
    }

    /*
     * An empty list, not undefined. Pages do `Array.isArray(x) ? x : []` on
     * some calls and `x.roles` on others; undefined turns a missing fixture
     * into a TypeError inside a render, which reads as a bug in the page.
     */
    return [];
  });

  return {
    useApi: () => ({ data: null, error: null, loading: false, execute, reset: vi.fn() }),

    useOrganisation: () => ({
      organisation:
        options.organisation === undefined
          ? { id: 'test-org-id', name: 'Test Organisation', shortName: 'TEST' }
          : options.organisation,
    }),
  };
}
