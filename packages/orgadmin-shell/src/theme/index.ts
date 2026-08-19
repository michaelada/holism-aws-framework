/**
 * Theme exports for ItsPlainSailing org admin.
 *
 * One theme, deliberately. A teal-and-grey neumorphic theme used to sit beside
 * `warmTheme` here with a commented-out line switching between the two, which
 * left the visual system looking like a runtime choice it was not: nothing
 * imported the neumorphic export, and the product has one committed look. It is
 * retired — see the brand commitments in PRODUCT.md — and was removed rather
 * than left in the tree to be revived by accident.
 *
 * `warmTheme` is the visual system; see its own file for the rules.
 */

export { warmTheme } from './warmTheme';
export { warmTheme as defaultTheme } from './warmTheme';
