/**
 * Theme exports for ItsPlainSailing Super Admin
 * 
 * Available themes:
 * - neumorphicTheme: Original neumorphic design with teal/gray colors
 * - warmTheme: Modern warm design with orange/gold gradients
 */

// Re-export the neumorphic theme from the main frontend
export { neumorphicTheme } from '../../../frontend/src/theme/neumorphicTheme';

// Export the warm theme
export { warmTheme } from './warmTheme';

// Default theme - change this to switch between themes
// export { neumorphicTheme as defaultTheme } from '../../../frontend/src/theme/neumorphicTheme';

// To switch to the warm theme, comment out the line above and uncomment this:
export { warmTheme as defaultTheme } from './warmTheme';
