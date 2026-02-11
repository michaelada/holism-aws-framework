# Wizard Navigation Fix

## Problem
When using the wizard to create an object instance, filling out step 1 fields and clicking "Next" did not advance to step 2. The button appeared to do nothing, with no errors in the console.

## Root Cause

The issue was in the `useWizard` hook. When we fixed the hooks violation earlier, we introduced a fallback configuration:

```tsx
const fallbackConfig = { steps: [] };
const wizardConfig = objectDef?.wizardConfig || fallbackConfig;
const wizard = useWizard(wizardConfig);
```

This fallback had **empty steps** (`steps: []`), which meant:
- `totalSteps` was initialized to `0` (from `wizardConfig.steps.length`)
- The `nextStep` function checks: `if (prev.currentStep < prev.totalSteps - 1)`
- With `totalSteps = 0`, this becomes: `if (0 < -1)` which is **always false**
- Therefore, the step never advanced

Even after the real wizard config loaded with actual steps, the `totalSteps` in the hook's state remained `0` because it was only set during initial state creation and never updated.

## Solution

Made the `useWizard` hook reactive to configuration changes by:

1. **Extracting totalSteps as a variable**:
```tsx
const totalSteps = wizardConfig.steps.length;
```

2. **Adding a useEffect to update state when config changes**:
```tsx
useEffect(() => {
  setState((prev) => ({
    ...prev,
    totalSteps: totalSteps,
  }));
}, [totalSteps]);
```

This ensures that when the wizard configuration loads and changes from the fallback to the real config, the `totalSteps` in the state updates accordingly, allowing navigation to work.

## How It Works Now

1. **Initial render**: 
   - Fallback config with `steps: []` is used
   - `totalSteps` is `0`
   - Hook initializes with this value

2. **After metadata loads**:
   - Real wizard config with actual steps is passed
   - `totalSteps` changes from `0` to the actual number of steps (e.g., `3`)
   - `useEffect` detects the change and updates the state
   - Navigation now works because `0 < 2` is true (for 3 steps)

3. **Clicking "Next"**:
   - `nextStep()` checks: `currentStep (0) < totalSteps - 1 (2)` ✓
   - Advances to step 1
   - Process repeats for subsequent steps

## Files Modified

- `packages/components/src/hooks/useWizard.ts` - Added useEffect to update totalSteps reactively

## Key Lesson

When using fallback values for hooks to satisfy the Rules of Hooks, ensure that:
1. The fallback values are reasonable (not empty/zero when that breaks logic)
2. The hook state updates when the real values load
3. Use `useEffect` to react to prop/config changes that affect state

## Testing

To verify the fix:

1. Navigate to an object type with wizard configuration
2. Click "Create New Instance"
3. Switch to the "Wizard" tab
4. Fill out the fields in step 1
5. Click "Next"
6. ✓ The wizard should advance to step 2
7. Continue through all steps
8. ✓ The "Complete" button should appear on the last step

## Related Issues

This fix complements the earlier hooks violation fix. Together they ensure:
- Hooks are called consistently (Rules of Hooks)
- The wizard state updates properly when config loads
- Navigation works correctly through all steps
