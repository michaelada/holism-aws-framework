# Discount Capability Menu Filtering Fix

## Issue

The "Discounts" menu item was visible in the Events module even when the organization did not have the `entry-discounts` capability enabled.

## Root Cause

The menu items (subMenuItems) were being rendered without checking for capability requirements. While the capability was specified in the module registration, the Layout component was not filtering menu items based on these capabilities.

## Solution

### 1. Updated Type Definitions

Added `capability` property to both `ModuleRoute` and `MenuItem` interfaces:

**Files Modified:**
- `packages/orgadmin-shell/src/types/module.types.ts`
- `packages/orgadmin-events/src/types/module.types.ts`

```typescript
export interface ModuleRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
  capability?: string;  // Optional capability required to access this route
}

export interface MenuItem {
  label: string;
  path: string;
  icon?: ComponentType;
  capability?: string;  // Optional capability required to see this menu item
}
```

### 2. Updated Layout Component

Added capability filtering for subMenuItems in the navigation drawer:

**File Modified:** `packages/orgadmin-shell/src/components/Layout.tsx`

```typescript
{module.subMenuItems
  .filter((subItem) => {
    // If subItem has a capability requirement, check if org has it
    if (subItem.capability) {
      return organisation?.enabledCapabilities?.includes(subItem.capability);
    }
    // If no capability requirement, always show
    return true;
  })
  .map((subItem) => {
    // ... render menu item
  })}
```

### 3. Updated Route Registration

Added capability filtering for routes to prevent direct URL access:

**File Modified:** `packages/orgadmin-shell/src/App.tsx`

```typescript
{availableModules.flatMap(module =>
  module.routes
    .filter(route => {
      // If route has a capability requirement, check if org has it
      if (route.capability) {
        return organisation?.enabledCapabilities?.includes(route.capability);
      }
      // If no capability requirement, always allow
      return true;
    })
    .map(route => (
      <Route
        key={route.path}
        path={route.path}
        element={<route.component />}
      />
    ))
)}
```

## How It Works

1. **Menu Item Filtering**: When rendering the navigation drawer, the Layout component now checks each subMenuItem for a `capability` property. If present, it verifies that the organization's `enabledCapabilities` array includes that capability.

2. **Route Protection**: Similarly, when registering routes, the App component filters routes based on capability requirements, preventing users from accessing pages via direct URL even if they don't have the capability.

3. **Organization Capabilities**: The organization's enabled capabilities are stored in `organisation.enabledCapabilities` array, which is populated from the backend based on the organization's configuration.

## Testing

To verify the fix:

1. **Without Capability**: Log in to an organization that does NOT have the `entry-discounts` capability
   - The "Discounts" menu item should NOT appear in the Events module submenu
   - Attempting to navigate to `/events/discounts` should show 404

2. **With Capability**: Log in to an organization that HAS the `entry-discounts` capability
   - The "Discounts" menu item SHOULD appear in the Events module submenu
   - Navigating to `/events/discounts` should show the Discounts List Page

## Database Setup

To enable the discount capability for an organization, the super admin must:

1. Ensure the `entry-discounts` capability exists in the `capabilities` table
2. Assign the capability to the organization through the Super Admin interface

The capability should have been created by the discount system migration:
```sql
INSERT INTO capabilities (name, display_name, description, category, is_active)
VALUES ('entry-discounts', 'Entry Discounts', 'Manage discounts for event entries', 'additional-feature', true);
```

## Related Files

- `packages/orgadmin-shell/src/types/module.types.ts` - Type definitions
- `packages/orgadmin-shell/src/components/Layout.tsx` - Menu rendering
- `packages/orgadmin-shell/src/App.tsx` - Route registration
- `packages/orgadmin-events/src/types/module.types.ts` - Events module types
- `packages/orgadmin-events/src/index.ts` - Events module registration with capability

## Pattern for Other Modules

This same pattern can be applied to other capability-gated features:

```typescript
subMenuItems: [
  {
    label: 'modules.example.menu.feature',
    path: '/example/feature',
    icon: FeatureIcon,
    capability: 'example-feature', // Only show if org has this capability
  },
]
```

The filtering will automatically apply to both menu visibility and route access.
