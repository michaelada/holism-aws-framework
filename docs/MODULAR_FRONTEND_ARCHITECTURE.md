# Modular Frontend Architecture Design

## Overview

This document outlines the architecture for two new capability-driven frontend applications:
1. **Organisation Admin UI** (`orgadmin`) - For organisation administrators with capability-based access
2. **Account User UI** (`accountuser`) - For regular users within an organisation

## Architecture Principles

### 1. Workspace-Based Modular Design
Each capability area is developed as a separate workspace package, enabling:
- Independent development and testing
- Lazy loading for performance
- Easy addition/removal of features
- Clear separation of concerns
- Shared component reuse

### 2. Capability-Driven UI
- Menu items and routes are dynamically generated based on user capabilities
- Each module registers its routes, menu items, and required capabilities
- Core modules (Dashboard, Settings, etc.) are always available
- Feature modules are conditionally loaded

### 3. Shared Infrastructure
- Common layout, theme, and authentication
- Shared component library
- Unified API client
- Consistent routing patterns

## Proposed Package Structure

```
packages/
├── backend/                    # Existing - add new services here
├── components/                 # Existing - shared UI components
├── admin/                      # Existing - super admin UI
├── frontend/                   # Existing - legacy/metadata UI
│
├── orgadmin-shell/            # NEW - Organisation Admin Shell
│   ├── src/
│   │   ├── App.tsx            # Main app with capability routing
│   │   ├── Layout.tsx         # Shell layout with dynamic menu
│   │   ├── context/
│   │   │   ├── CapabilityContext.tsx
│   │   │   └── OrganisationContext.tsx
│   │   ├── hooks/
│   │   │   └── useCapabilities.ts
│   │   └── types/
│   │       └── module.types.ts
│   └── package.json
│
├── orgadmin-core/             # NEW - Core modules (always available)
│   ├── src/
│   │   ├── dashboard/         # Dashboard module
│   │   ├── settings/          # Settings module
│   │   ├── payments/          # Payments module
│   │   ├── reporting/         # Reporting module
│   │   ├── forms/             # Forms builder module
│   │   └── users/             # User management module
│   └── package.json
│
├── orgadmin-events/           # NEW - Event Management (event-management)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── index.ts           # Module registration
│   └── package.json
│
├── orgadmin-memberships/      # NEW - Membership Management (memberships)
│   └── ...
│
├── orgadmin-merchandise/      # NEW - Merchandise Management (merchandise)
│   └── ...
│
├── orgadmin-calendar/         # NEW - Calendar Bookings (calendar-bookings)
│   └── ...
│
├── orgadmin-registrations/    # NEW - Registration Management (registrations)
│   └── ...
│
├── orgadmin-ticketing/        # NEW - Event Ticketing (event-ticketing)
│   └── ...
│
└── accountuser/               # NEW - Account User UI (future)
    └── ...
```

## Module Registration Pattern

Each feature module exports a registration object:

```typescript
// orgadmin-events/src/index.ts
import { ModuleRegistration } from '@orgadmin/shell';

export const eventsModule: ModuleRegistration = {
  id: 'events',
  name: 'Events',
  capability: 'event-management',
  icon: EventIcon,
  routes: [
    {
      path: '/events',
      component: lazy(() => import('./pages/EventsListPage')),
    },
    {
      path: '/events/new',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: '/events/:id',
      component: lazy(() => import('./pages/EventDetailsPage')),
    },
  ],
  menuItems: [
    {
      label: 'Events',
      path: '/events',
      icon: EventIcon,
    },
  ],
};
```

## Capability Mapping

| Capability | Module Package | Menu Label | Always Available |
|------------|---------------|------------|------------------|
| `event-management` | `orgadmin-events` | Events | No |
| `memberships` | `orgadmin-memberships` | Members | No |
| `merchandise` | `orgadmin-merchandise` | Merchandise | No |
| `calendar-bookings` | `orgadmin-calendar` | Calendar | No |
| `registrations` | `orgadmin-registrations` | Registrations | No |
| `event-ticketing` | `orgadmin-ticketing` | Tickets | No |
| - | `orgadmin-core/dashboard` | Dashboard | Yes |
| - | `orgadmin-core/forms` | Forms | Yes |
| - | `orgadmin-core/settings` | Settings | Yes |
| - | `orgadmin-core/payments` | Payments | Yes |
| - | `orgadmin-core/reporting` | Reporting | Yes |
| - | `orgadmin-core/users` | Users | Yes |

## Shell Application Flow

### 1. Authentication & Capability Loading

```typescript
// orgadmin-shell/src/App.tsx
const App = () => {
  const { user, organisation, capabilities } = useAuth();
  
  useEffect(() => {
    if (user && organisation) {
      // Fetch user's organisation capabilities
      loadCapabilities(organisation.id);
    }
  }, [user, organisation]);
  
  // Filter modules based on capabilities
  const availableModules = modules.filter(module => 
    !module.capability || capabilities.includes(module.capability)
  );
  
  return (
    <CapabilityProvider capabilities={capabilities}>
      <OrganisationProvider organisation={organisation}>
        <Layout modules={availableModules}>
          <Routes>
            {availableModules.map(module => 
              module.routes.map(route => (
                <Route key={route.path} {...route} />
              ))
            )}
          </Routes>
        </Layout>
      </OrganisationProvider>
    </CapabilityProvider>
  );
};
```

### 2. Dynamic Menu Generation

```typescript
// orgadmin-shell/src/Layout.tsx
const Layout = ({ modules, children }) => {
  const menuItems = modules.flatMap(module => module.menuItems);
  
  return (
    <Box>
      <AppBar>
        <Toolbar>
          <Typography variant="h6">{organisation.displayName}</Typography>
        </Toolbar>
      </AppBar>
      <Drawer>
        <List>
          {menuItems.map(item => (
            <ListItem key={item.path} button onClick={() => navigate(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main">
        {children}
      </Box>
    </Box>
  );
};
```

## Shared Components Strategy

### Components Package Enhancement

Add organisation-specific shared components to the existing `packages/components`:

```
packages/components/src/
├── components/
│   ├── FieldRenderer/         # Existing
│   ├── MetadataForm/          # Existing
│   ├── MetadataTable/         # Existing
│   │
│   ├── OrgDataTable/          # NEW - Reusable data table
│   ├── OrgFormBuilder/        # NEW - Form builder components
│   ├── OrgPaymentWidget/      # NEW - Payment display components
│   ├── OrgDatePicker/         # NEW - Date/time pickers
│   └── OrgFileUpload/         # NEW - File upload components
```

These components can be used by:
- Organisation Admin UI modules
- Account User UI (future)
- Any other organisation-facing interfaces

## Backend Services Strategy

### Add to Existing Backend Package

```
packages/backend/src/
├── services/
│   ├── organization.service.ts        # Existing
│   ├── capability.service.ts          # Existing
│   │
│   ├── event.service.ts               # NEW
│   ├── membership.service.ts          # NEW
│   ├── merchandise.service.ts         # NEW
│   ├── calendar-booking.service.ts    # NEW
│   ├── registration.service.ts        # NEW
│   ├── ticketing.service.ts           # NEW
│   ├── form-builder.service.ts        # NEW
│   ├── payment.service.ts             # NEW
│   └── reporting.service.ts           # NEW
│
├── routes/
│   ├── event.routes.ts                # NEW
│   ├── membership.routes.ts           # NEW
│   └── ...
```

## Authentication & Authorization

### User Types & Access Control

```typescript
// User roles in Keycloak
enum UserRole {
  SUPER_ADMIN = 'super-admin',           // Access to admin UI
  ORG_ADMIN = 'org-admin',               // Access to orgadmin UI
  ACCOUNT_USER = 'account-user',         // Access to accountuser UI
}

// Middleware checks
- Super Admin: Can access /admin/* routes
- Org Admin: Can access /orgadmin/* routes (filtered by capabilities)
- Account User: Can access /app/* routes
```

### Capability Check Middleware

```typescript
// Backend middleware
export const requireCapability = (capability: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const orgCapabilities = await getOrganisationCapabilities(user.organisationId);
    
    if (!orgCapabilities.includes(capability)) {
      return res.status(403).json({ error: 'Capability not enabled' });
    }
    
    next();
  };
};

// Usage in routes
router.post('/events', 
  authenticateToken(), 
  requireCapability('event-management'),
  createEvent
);
```

## Development Workflow

### 1. Initial Setup
```bash
# Create shell package
npm init -w packages/orgadmin-shell

# Create core package
npm init -w packages/orgadmin-core

# Create feature packages
npm init -w packages/orgadmin-events
npm init -w packages/orgadmin-memberships
# ... etc
```

### 2. Module Development
Each module is developed independently:
```bash
# Work on events module
cd packages/orgadmin-events
npm run dev

# Work on memberships module
cd packages/orgadmin-memberships
npm run dev
```

### 3. Integration Testing
```bash
# Run shell with all modules
cd packages/orgadmin-shell
npm run dev
```

## Lazy Loading & Code Splitting

```typescript
// Shell dynamically imports modules
const modules = [
  {
    id: 'events',
    capability: 'event-management',
    loader: () => import('@orgadmin/events'),
  },
  {
    id: 'memberships',
    capability: 'memberships',
    loader: () => import('@orgadmin/memberships'),
  },
  // ...
];

// Only load modules user has access to
const loadedModules = await Promise.all(
  modules
    .filter(m => !m.capability || capabilities.includes(m.capability))
    .map(m => m.loader())
);
```

## Deployment Strategy

### Build Process
```json
{
  "scripts": {
    "build:shell": "npm run build -w packages/orgadmin-shell",
    "build:core": "npm run build -w packages/orgadmin-core",
    "build:events": "npm run build -w packages/orgadmin-events",
    "build:orgadmin": "npm run build:shell && npm run build:core && npm run build:events && ..."
  }
}
```

### Docker Configuration
```dockerfile
# Build all orgadmin packages
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/orgadmin-shell ./packages/orgadmin-shell
COPY packages/orgadmin-core ./packages/orgadmin-core
COPY packages/orgadmin-events ./packages/orgadmin-events
# ... copy other modules
RUN npm ci
RUN npm run build:orgadmin

# Serve
FROM nginx:alpine
COPY --from=builder /app/packages/orgadmin-shell/dist /usr/share/nginx/html
```

## URL Structure

```
/admin/*              - Super Admin UI (existing)
/orgadmin/*           - Organisation Admin UI (new)
  /orgadmin/dashboard
  /orgadmin/events
  /orgadmin/members
  /orgadmin/merchandise
  /orgadmin/calendar
  /orgadmin/registrations
  /orgadmin/tickets
  /orgadmin/forms
  /orgadmin/settings
  /orgadmin/payments
  /orgadmin/reporting
  /orgadmin/users
/app/*                - Account User UI (future)
```

## Benefits of This Architecture

1. **Modularity**: Each feature is self-contained and independently testable
2. **Scalability**: Easy to add new capability-based modules
3. **Performance**: Lazy loading reduces initial bundle size
4. **Maintainability**: Clear boundaries between features
5. **Flexibility**: Modules can be enabled/disabled per organisation
6. **Reusability**: Shared components benefit all UIs
7. **Team Collaboration**: Different teams can work on different modules
8. **Progressive Enhancement**: Start with core features, add modules incrementally

## Next Steps

1. Create shell package structure
2. Implement capability context and routing
3. Build core modules (Dashboard, Settings, etc.)
4. Create first feature module (Events) as template
5. Replicate pattern for other feature modules
6. Add backend services for each capability
7. Implement comprehensive testing strategy

## Future Considerations

### Account User UI
The `accountuser` package will follow similar patterns:
- Shared components from `packages/components`
- Different capability checks (user-level vs admin-level)
- Potentially shared services with orgadmin
- Different layout/theme optimised for end users

### Mobile Apps
The modular backend services can support:
- React Native mobile apps
- Progressive Web Apps (PWA)
- Native iOS/Android apps

### API Gateway
Consider adding an API gateway layer for:
- Rate limiting per organisation
- Capability-based API access control
- Analytics and monitoring
- Caching strategies
