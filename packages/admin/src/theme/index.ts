/**
 * Theme exports for the Its Plain Sailing platform admin.
 *
 * One theme, deliberately. The neumorphic theme that used to be re-exported
 * here lived in `packages/frontend` and was reached across a package boundary
 * for a look this app never rendered — it only added weight to the bundle
 * graph. `warmTheme` is the visual system; see its own file for the rules.
 */

export { warmTheme } from './warmTheme';
export { warmTheme as defaultTheme } from './warmTheme';
