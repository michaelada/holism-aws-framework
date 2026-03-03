# Form Preview Production Build Issue

## Problem

When serving the production build of orgadmin-shell, the application shows a blank screen with the following error:

```
hoist-non-react-statics.cjs.js:47 Uncaught TypeError: Cannot read properties of undefined (reading 'ForwardRef')
```

## Root Cause

The error indicates that React is `undefined` when `hoist-non-react-statics` (used by MUI and other libraries) tries to access `React.ForwardRef`. This suggests React module duplication in the production build.

### Why This Happens

1. **Vite's dedupe configuration** works in development mode but may not fully apply to production builds
2. **Manual chunk splitting** in the build configuration may be creating separate React instances
3. **Source aliases** pointing to unbundled source code may cause different parts of the build to resolve React differently

## Investigation Steps Taken

### 1. Fixed MIME Type Issue

**Problem**: Initial production build had a modulepreload link with wrong MIME type:
```html
<link rel="modulepreload" href="data:application/octet-stream;base64,..." />
```

**Solution**: Removed the problematic `<link rel="modulepreload" href="/src/main.tsx" />` from source `index.html`. Vite automatically generates correct modulepreload links during build.

**File Changed**: `packages/orgadmin-shell/index.html`

### 2. Current Issue: React Module Duplication

**Symptoms**:
- Blank screen in production build
- Error: `Cannot read properties of undefined (reading 'ForwardRef')`
- Error occurs in `hoist-non-react-statics.cjs.js:47`

**Likely Causes**:
1. The `resolve.dedupe` configuration in `vite.config.ts` may not apply to production builds
2. The manual chunk splitting logic may be creating multiple React instances
3. Some packages may be bundling their own copy of React

## Potential Solutions

### Solution 1: Verify External Dependencies

Check if React is properly externalized in the build. The current configuration has manual chunks but doesn't explicitly externalize React for production.

### Solution 2: Simplify Manual Chunks

The current `manualChunks` configuration is complex and may be causing issues. Consider simplifying it or removing it to let Vite handle chunking automatically.

### Solution 3: Add Rollup Dedupe Plugin

For production builds, we may need to use Rollup's dedupe plugin explicitly:

```typescript
import { defineConfig } from 'vite';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [
        nodeResolve({
          dedupe: ['react', 'react-dom', '@mui/material', '@mui/x-date-pickers']
        })
      ]
    }
  }
});
```

### Solution 4: Check for CJS/ESM Mixing

The error occurs in `hoist-non-react-statics.cjs.js` (CommonJS). There may be an issue with mixing CommonJS and ESM modules. Check if all dependencies are using the same module format.

### Solution 5: Analyze Bundle

Use the bundle analyzer to check if React is duplicated:

```bash
npm run build:analyze
```

Then open `dist/stats.html` to visualize the bundle and look for duplicate React instances.

## Workaround

For now, date picker testing in production mode is blocked. Testing can be done in development mode where the dedupe configuration works correctly.

## Next Steps

1. Analyze the production bundle to confirm React duplication
2. Try simplifying the manual chunks configuration
3. Consider adding explicit Rollup dedupe plugin for production builds
4. Test if removing source aliases for production build helps
5. Check if any dependencies are bundling React incorrectly

## Related Files

- `packages/orgadmin-shell/vite.config.ts` - Build configuration
- `packages/orgadmin-shell/index.html` - HTML template (fixed)
- `packages/orgadmin-shell/dist/index.html` - Built HTML (now correct)
- `.kiro/specs/date-picker-localization-fix/design.md` - Original spec

## Status

- ✅ MIME type issue fixed
- ❌ React duplication issue in production build (blocking)
- ✅ Development mode works correctly
- ❌ Production build testing blocked

## Date

2024-01-XX (Task 9.3 - Test production build)
