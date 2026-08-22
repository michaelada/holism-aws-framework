import type { Mock } from 'vitest';

/**
 * Did the page navigate to this path?
 *
 * ## Why not `toHaveBeenCalledWith`
 *
 * The pages navigate with router state as well as a path:
 *
 * ```ts
 * navigate('/members/create', { state: { filterState } })
 * ```
 *
 * `expect(navigate).toHaveBeenCalledWith('/members/create')` matches arguments
 * *exactly*, so it fails against that two-argument call. The positive
 * assertions written that way failed loudly, which is fine.
 *
 * The negative ones did not. `expect(navigate).not.toHaveBeenCalledWith(path)`
 * passed **whatever the page did** — the two-argument call could never match, so
 * the assertion was true by construction. "Should not navigate to the plain
 * create URL when a single type exists" was guaranteed to pass even if the page
 * navigated there on every render.
 *
 * Comparing the path alone is what those tests meant, and it makes the negative
 * form mean something again. The state is a separate concern with its own suite
 * — CreateMemberPage.filter-state-preservation.property.test.tsx.
 */
export const navigatedTo = (navigate: Mock, path: string): boolean =>
  navigate.mock.calls.some(([to]) => to === path);

/** Every path the page navigated to, in order — for a readable failure message. */
export const navigationPaths = (navigate: Mock): unknown[] =>
  navigate.mock.calls.map(([to]) => to);

/**
 * Did the page navigate to a path containing this fragment?
 *
 * The same trap as `navigatedTo`, in the shape it takes when a test wants a
 * partial match: `toHaveBeenCalledWith(expect.stringContaining(x))` compares
 * the *whole argument list*, so it never matched `navigate(path, { state })`.
 *
 * Inside a `waitFor`, a matcher that can never succeed does not fail fast — it
 * burns the full timeout on every property iteration, and the test dies of a
 * timeout rather than telling you what was wrong.
 */
export const navigatedToMatching = (navigate: Mock, fragment: string): boolean =>
  navigate.mock.calls.some(([to]) => typeof to === 'string' && to.includes(fragment));
