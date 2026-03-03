# Theme Switching Guide

This guide explains how to switch between the available themes in both the Super Admin and Org Admin applications.

## Available Themes

### 1. Neumorphic Theme (Default)
- Original design with teal/gray colors
- Soft neumorphic shadows and effects
- Clean, modern aesthetic

### 2. Warm Theme
- Inspired by the ItsPlainSailing marketing site
- Orange (#FF9800) to Amber (#E65100) gradient colors
- Gold accent (#FFC107)
- Sora font family
- Modern, warm aesthetic with rounded buttons and smooth transitions

## How to Switch Themes

### Super Admin Application (`packages/admin`)

1. Open `packages/admin/src/theme/index.ts`
2. Find the "Default theme" section at the bottom
3. To use the **neumorphic theme** (current default):
   ```typescript
   export { neumorphicTheme as defaultTheme } from '../../../frontend/src/theme/neumorphicTheme';
   ```

4. To use the **warm theme**:
   ```typescript
   // Comment out the neumorphic theme line
   // export { neumorphicTheme as defaultTheme } from '../../../frontend/src/theme/neumorphicTheme';
   
   // Uncomment the warm theme line
   export { warmTheme as defaultTheme } from './warmTheme';
   ```

### Org Admin Application (`packages/orgadmin-shell`)

1. Open `packages/orgadmin-shell/src/theme/index.ts`
2. Find the "Default theme" section at the bottom
3. To use the **neumorphic theme** (current default):
   ```typescript
   export { neumorphicTheme as defaultTheme } from './neumorphicTheme';
   ```

4. To use the **warm theme**:
   ```typescript
   // Comment out the neumorphic theme line
   // export { neumorphicTheme as defaultTheme } from './neumorphicTheme';
   
   // Uncomment the warm theme line
   export { warmTheme as defaultTheme } from './warmTheme';
   ```

## After Switching

After changing the theme in either application:

1. Save the file
2. The development server will automatically reload (if running)
3. Refresh your browser to see the new theme

## Font Requirements

The warm theme uses the **Sora** font family, which is loaded from Google Fonts. Both HTML files have been updated to include this font:

- `packages/admin/index.html`
- `packages/orgadmin-shell/index.html`

If you're using the neumorphic theme, the Sora font will still be loaded but won't be used.

## Theme Customization

Both themes are fully customizable. To modify a theme:

1. Locate the theme file:
   - Neumorphic: `packages/frontend/src/theme/neumorphicTheme.ts`
   - Warm (Admin): `packages/admin/src/theme/warmTheme.ts`
   - Warm (Org Admin): `packages/orgadmin-shell/src/theme/warmTheme.ts`

2. Modify the theme properties:
   - `palette`: Colors for primary, secondary, background, text, etc.
   - `typography`: Font families, sizes, weights
   - `shape`: Border radius
   - `shadows`: Shadow definitions
   - `components`: Component-specific styling overrides

3. Save the file and the changes will be reflected immediately in development mode

## Creating a New Theme

To create a new theme:

1. Create a new theme file (e.g., `myTheme.ts`) in the appropriate theme directory
2. Use the existing themes as a template
3. Export the theme from the `index.ts` file
4. Update the default export to use your new theme

Example:
```typescript
// In packages/admin/src/theme/myTheme.ts
import { createTheme } from '@mui/material/styles';

export const myTheme = createTheme({
  // Your theme configuration
});

// In packages/admin/src/theme/index.ts
export { myTheme } from './myTheme';
export { myTheme as defaultTheme } from './myTheme';
```
