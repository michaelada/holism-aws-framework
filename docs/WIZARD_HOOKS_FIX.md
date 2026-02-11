# MetadataWizard Hooks Error Fix

## Problem
When clicking the "Wizard" tab to create an object instance with wizard steps, the application displayed an error:

```
Error: Rendered more hooks than during the previous render.
```

This error occurred in the `MetadataWizard` component.

## Root Cause

The error was caused by a violation of **React's Rules of Hooks**. In the original code:

```tsx
// ❌ WRONG: Conditional hook call
if (!loading && objectDef && !objectDef.wizardConfig) {
  return (
    <Alert severity="error">
      Object type "{objectType}" does not have wizard configuration
    </Alert>
  );
}

const wizard = objectDef?.wizardConfig ? useWizard(objectDef.wizardConfig) : null;
```

The `useWizard` hook was being called conditionally based on whether `objectDef.wizardConfig` existed. This violates React's fundamental rule:

> **Hooks must be called in the same order on every render**

When the component re-rendered with different conditions (e.g., after loading completes), the number and order of hooks changed, causing React to throw the error.

## React's Rules of Hooks

React requires that:
1. **Hooks must be called at the top level** - not inside conditions, loops, or nested functions
2. **Hooks must be called in the same order** - every render must call the same hooks in the same sequence
3. **Hooks can only be called from React functions** - components or custom hooks

## Solution

The fix ensures hooks are always called in the same order by:

1. **Always calling `useWizard`** with a fallback configuration:
```tsx
// ✅ CORRECT: Always call the hook
const fallbackConfig = { steps: [] };
const wizardConfig = objectDef?.wizardConfig || fallbackConfig;
const wizard = useWizard(wizardConfig);
```

2. **Moving conditional checks after all hooks**:
```tsx
// Check conditions AFTER hooks are called
if (!loading && objectDef && !objectDef.wizardConfig) {
  return (
    <Alert severity="error">
      Object type "{objectType}" does not have wizard configuration
    </Alert>
  );
}
```

This ensures that:
- The hook is called on every render
- The hook is called in the same position every time
- Early returns only happen after all hooks are executed

## Why This Works

By providing a fallback configuration (`{ steps: [] }`), the `useWizard` hook can always initialize properly. Even if the wizard config doesn't exist yet (during loading) or is invalid, the hook still runs and maintains consistent state.

The conditional logic is moved to after the hooks, where it's safe to return early without affecting hook order.

## Files Modified

- `packages/components/src/components/MetadataWizard/MetadataWizard.tsx` - Fixed conditional hook call

## Testing

To verify the fix:

1. Navigate to an object type that has wizard configuration
2. Click "Create New Instance"
3. Click the "Wizard" tab
4. The wizard should now load without errors
5. You should see the stepper with wizard steps
6. Navigation between steps should work correctly

## Additional Notes

### Common Hook Violations to Avoid

```tsx
// ❌ WRONG: Hook inside condition
if (condition) {
  const [state, setState] = useState(0);
}

// ❌ WRONG: Hook inside loop
for (let i = 0; i < count; i++) {
  useEffect(() => {}, []);
}

// ❌ WRONG: Hook after early return
if (error) return <Error />;
const data = useData(); // This hook might not be called

// ✅ CORRECT: All hooks before any conditions
const [state, setState] = useState(0);
const data = useData();
if (error) return <Error />;
```

### Best Practices

1. **Always call hooks at the top of the component**
2. **Use conditional logic inside hooks, not around them**
3. **Provide fallback values for conditional data**
4. **Move early returns below all hook calls**

### Example Pattern

```tsx
function MyComponent({ config }) {
  // ✅ Always call hooks first
  const [state, setState] = useState(initialValue);
  const data = useCustomHook(config || fallbackConfig);
  
  // ✅ Then check conditions
  if (!config) {
    return <Alert>No config provided</Alert>;
  }
  
  if (loading) {
    return <Loading />;
  }
  
  // ✅ Render normally
  return <div>{data}</div>;
}
```

## Related Resources

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [ESLint Plugin: react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)
- [React Hooks FAQ](https://react.dev/reference/react/hooks#rules-of-hooks)
