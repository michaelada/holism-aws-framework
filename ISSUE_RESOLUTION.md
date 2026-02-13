# Issue Resolution: web-vitals Dependency

## Problem

When starting the orgadmin-shell with `npm run dev`, the following error occurred:

```
Error: The following dependencies are imported but could not be resolved:
web-vitals (imported by /Users/michaeladams/Work/Esker/Development/AI/Holism/packages/orgadmin-shell/src/utils/performance.ts)
Are they installed?
```

## Root Cause

The `web-vitals` package was imported in `packages/orgadmin-shell/src/utils/performance.ts` for performance monitoring, but it was not listed as a dependency in `packages/orgadmin-shell/package.json`.

## Solution

Added `web-vitals` to the dependencies in `packages/orgadmin-shell/package.json`:

```json
"dependencies": {
  ...
  "web-vitals": "^3.5.2"
}
```

## Steps Taken

1. Identified the missing dependency from the error message
2. Added `web-vitals@^3.5.2` to `packages/orgadmin-shell/package.json`
3. Ran `npm install --workspace=packages/orgadmin-shell`
4. Verified the shell starts successfully

## Verification

After the fix, the orgadmin-shell starts successfully:

```bash
npm run dev --workspace=packages/orgadmin-shell

# Output:
# VITE v5.4.21  ready in 168 ms
# ➜  Local:   http://localhost:5175/orgadmin
# ➜  Network: use --host to expose
```

## Status

✅ **RESOLVED** - The orgadmin-shell now starts without errors.

## Related Files

- `packages/orgadmin-shell/package.json` - Added web-vitals dependency
- `packages/orgadmin-shell/src/utils/performance.ts` - Uses web-vitals for performance monitoring

## Additional Notes

The `web-vitals` library is used to measure Core Web Vitals metrics:
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)

These metrics are important for monitoring the application's performance and user experience.

---

**Date:** February 13, 2026  
**Resolved by:** Kiro AI Assistant
