# Neumorphic Theme Implementation

## Overview
The application now uses a custom neumorphic (soft UI) theme that provides a modern, elegant look with soft shadows and smooth animations.

## Design Principles

### Neumorphism
Neumorphism (or "soft UI") is a design trend that creates a soft, extruded plastic look using:
- Subtle shadows (both light and dark)
- Minimal color contrast
- Soft, rounded corners
- Inset and outset effects

### Color Palette
- **Primary Color**: `#009087` (Teal) - Used for accents and hover states
- **Background**: `#e8e8e8` (Light gray) - Main background color
- **Text**: `#090909` (Near black) - Primary text color
- **Shadows**: 
  - Light shadow: `#ffffff`
  - Dark shadow: `#c5c5c5`

## Key Features

### 1. Neumorphic Buttons
All Material-UI buttons now feature:
- **Soft shadows**: Creates a raised, 3D effect
- **Smooth hover animation**: Teal color fills from bottom to top
- **Active state**: Inset shadow when clicked
- **Pseudo-elements**: Uses `::before` and `::after` for the fill animation

### 2. Cards and Papers
- Consistent neumorphic shadow effect
- Rounded corners (1em border radius)
- Elevated appearance

### 3. Form Inputs
- **TextField and Select**: Inset shadows for a pressed-in effect
- **Focus state**: Teal border on focus
- **Hover state**: Teal border on hover

### 4. App Bar
- Neumorphic shadow effect
- Light background matching the overall theme

### 5. Tables
- Subtle borders
- Bold headers
- Consistent with the neumorphic aesthetic

## Button Variants

### Contained (Default)
```tsx
<Button variant="contained">Click Me</Button>
```
- Neumorphic raised effect
- Teal fill animation on hover
- White text on hover

### Outlined
```tsx
<Button variant="outlined">Click Me</Button>
```
- Teal border
- Neumorphic shadow
- Teal fill animation on hover

### Text
```tsx
<Button variant="text">Click Me</Button>
```
- No shadow
- Subtle teal background on hover

## Animation Details

### Hover Effect
The button hover effect uses two pseudo-elements (`::before` and `::after`) that:
1. Start positioned below the button (top: 100% and 180%)
2. Are circular shapes (border-radius: 50%)
3. Animate upward on hover (top: -35% and -45%)
4. Scale and transform for a smooth fill effect
5. Use cubic-bezier easing for natural motion

### Timing
- Transition duration: 0.5s
- Delay: 0.1s
- Easing: `cubic-bezier(0.55, 0, 0.1, 1)` - Creates a smooth, natural animation

## Usage

The theme is automatically applied to all Material-UI components throughout the application. No additional configuration needed.

### Custom Components
If you create custom components, you can access the theme:

```tsx
import { useTheme } from '@mui/material/styles';

function MyComponent() {
  const theme = useTheme();
  
  return (
    <div style={{
      backgroundColor: theme.palette.background.default,
      color: theme.palette.text.primary,
      boxShadow: '6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff',
    }}>
      Content
    </div>
  );
}
```

### Override Theme
To temporarily use a different theme or customize further:

```tsx
import { ThemeProvider, createTheme } from '@mui/material';
import { neumorphicTheme } from './theme/neumorphicTheme';

const customTheme = createTheme({
  ...neumorphicTheme,
  palette: {
    ...neumorphicTheme.palette,
    primary: {
      main: '#ff5722', // Override primary color
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={customTheme}>
      {/* Your app */}
    </ThemeProvider>
  );
}
```

## Browser Compatibility

The theme uses modern CSS features:
- `::before` and `::after` pseudo-elements (all browsers)
- `transform` and `transition` (all modern browsers)
- `cubic-bezier` easing (all modern browsers)
- Multiple box-shadows (all modern browsers)

Fully compatible with:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

The theme is optimized for performance:
- CSS transitions are GPU-accelerated (transform, opacity)
- Pseudo-elements reduce DOM nodes
- Shadows are static (not animated)
- Minimal repaints and reflows

## Accessibility

The theme maintains good accessibility:
- High contrast text (near-black on light gray)
- Clear focus states (teal border)
- Visible hover states
- Proper color contrast ratios (WCAG AA compliant)

## Files Modified

- `packages/frontend/src/theme/neumorphicTheme.ts` - New theme definition
- `packages/frontend/src/App.tsx` - Updated to use neumorphic theme

## Credits

Button animation inspired by design from Uiverse.io by shah1345.

## Future Enhancements

Potential improvements:
1. Dark mode variant
2. Additional color schemes
3. Customizable shadow intensity
4. Animation speed controls
5. Accessibility mode (reduced motion)
