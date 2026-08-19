/**
 * Theme exports for the Its Plain Sailing metadata repository.
 *
 * One theme, deliberately. This app rendered the retired teal-and-grey
 * neumorphic theme — the last place in the repository that still did — which
 * made it the only surface that did not look like the product. `warmTheme` is
 * the visual system; see its own file for the rules.
 *
 * The file is a copy rather than an import, matching `packages/admin` and
 * `packages/orgadmin-shell`, which each carry their own. Three near-identical
 * copies is the standing cost of that pattern and the argument for moving the
 * theme into `packages/components` — a consolidation this change deliberately
 * did not attempt.
 */

export { warmTheme } from './warmTheme';
export { warmTheme as defaultTheme } from './warmTheme';
