# Event Types and Venues Capability-Based Visibility Fix

## Issue
The Event Types and Venues submenu items in the Events section of the Org Admin UI were always visible, regardless of whether the organization had the required capabilities enabled.

## Root Cause
The Events module configuration (`packages/orgadmin-events/src/index.ts`) was missing capability checks for:
- Event Types submenu item and route
- Venues submenu item and route

While the Discounts submenu already had the `entry-discounts` capability check, Event Types and Venues did not have similar checks.

## Solution
Added capability requirements to both the submenu items and routes:

### Submenu Items
```typescript
subMenuItems: [
  {
    label: 'modules.events.menu.events',
    path: '/events',
    icon: EventIcon,
  },
  {
    label: 'modules.events.menu.eventTypes',
    path: '/events/types',
    icon: CategoryIcon,
    capability: 'event-types', // ✅ Added
  },
  {
    label: 'modules.events.menu.venues',
    path: '/events/venues',
    icon: LocationIcon,
    capability: 'venues', // ✅ Added
  },
  {
    label: 'modules.events.menu.discounts',
    path: '/events/discounts',
    icon: DiscountIcon,
    capability: 'entry-discounts',
  },
],
```

### Routes
```typescript
routes: [
  // ... other routes
  {
    path: 'events/types',
    component: lazy(() => import('./pages/EventTypesListPage')),
    capability: 'event-types', // ✅ Added
  },
  {
    path: 'events/venues',
    component: lazy(() => import('./pages/VenuesListPage')),
    capability: 'venues', // ✅ Added
  },
  // ... other routes
]
```

## How It Works

### Submenu Filtering
The `Layout.tsx` component in `packages/orgadmin-shell` automatically filters submenu items based on capabilities:

```typescript
module.subMenuItems
  .filter((subItem) => {
    // If subItem has a capability requirement, check if org has it
    if (subItem.capability) {
      return organisation?.enabledCapabilities?.includes(subItem.capability);
    }
    // If no capability requirement, always show
    return true;
  })
```

### Route Filtering
The `App.tsx` component in `packages/orgadmin-shell` automatically filters routes based on capabilities:

```typescript
module.routes
  .filter(route => {
    // If route has a capability requirement, check if org has it
    if (route.capability) {
      return organisation?.enabledCapabilities?.includes(route.capability);
    }
    // If no capability requirement, always allow
    return true;
  })
```

## Capabilities
The following capabilities control visibility:

| Capability | Display Name | Controls |
|------------|--------------|----------|
| `event-types` | Event Types | Event Types submenu and route |
| `venues` | Venues | Venues submenu and route |
| `entry-discounts` | Entry Discounts | Discounts submenu and routes |
| `event-management` | Event Management | Entire Events module |

## Testing
To verify the fix:

1. **Organization WITH event-types capability:**
   - Event Types submenu should be visible
   - `/events/types` route should be accessible

2. **Organization WITHOUT event-types capability:**
   - Event Types submenu should be hidden
   - `/events/types` route should redirect to 404

3. **Organization WITH venues capability:**
   - Venues submenu should be visible
   - `/events/venues` route should be accessible

4. **Organization WITHOUT venues capability:**
   - Venues submenu should be hidden
   - `/events/venues` route should redirect to 404

## Database Verification
Check which organizations have these capabilities:

```sql
-- Organizations with event-types capability
SELECT id, name 
FROM organizations 
WHERE enabled_capabilities::jsonb ? 'event-types';

-- Organizations with venues capability
SELECT id, name 
FROM organizations 
WHERE enabled_capabilities::jsonb ? 'venues';
```

## Files Modified
- `packages/orgadmin-events/src/index.ts` - Added capability checks to submenu items and routes

## Related
- Similar pattern used for Discounts submenu with `entry-discounts` capability
- Capability filtering implemented in:
  - `packages/orgadmin-shell/src/components/Layout.tsx` (submenu filtering)
  - `packages/orgadmin-shell/src/App.tsx` (route filtering)
