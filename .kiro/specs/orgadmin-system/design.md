# Organisation Admin System - Design Document

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser / Client                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                  Organisation Admin UI                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              orgadmin-shell (Shell)                    │ │
│  │  - Authentication                                      │ │
│  │  - Capability Loading                                  │ │
│  │  - Module Registration                                 │ │
│  │  - Layout & Navigation                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Core Modules│  │   Capability  │  │    Shared        │  │
│  │             │  │    Modules    │  │  Components      │  │
│  │ - Dashboard │  │ - Events      │  │ - Forms          │  │
│  │ - Forms     │  │ - Members     │  │ - Tables         │  │
│  │ - Settings  │  │ - Merchandise │  │ - Wizards        │  │
│  │ - Payments  │  │ - Calendar    │  │ - Dialogs        │  │
│  │ - Reporting │  │ - Registr.    │  │                  │  │
│  │ - Users     │  │ - Tickets     │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────────┐
│                    Backend Services                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Existing Services:                                    │ │
│  │  - Organisation Service                                │ │
│  │  - Capability Service                                  │ │
│  │  - User Service                                        │ │
│  │  - Role Service                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  New Services:                                         │ │
│  │  - Event Service                                       │ │
│  │  - Membership Service                                  │ │
│  │  - Merchandise Service                                 │ │
│  │  - Calendar Service                                    │ │
│  │  - Registration Service                                │ │
│  │  - Ticketing Service                                   │ │
│  │  - Form Builder Service                                │ │
│  │  - Payment Service                                     │ │
│  │  - Reporting Service                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│              PostgreSQL Database                             │
│  - Organisations, Users, Roles, Capabilities                 │
│  - Events, Memberships, Merchandise, etc.                    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Package Structure

```
packages/
├── backend/                          # Existing - enhanced
├── components/                       # Existing - enhanced
├── admin/                            # Existing - super admin
│
├── orgadmin-shell/                   # NEW - Shell application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── DashboardCard.tsx
│   │   │   └── ModuleLoader.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── OrganisationContext.tsx
│   │   │   └── CapabilityContext.tsx
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx
│   │   └── types/
│   │       └── module.types.ts
│   └── package.json
│
├── orgadmin-core/                    # NEW - Core modules
│   ├── src/
│   │   ├── forms/                    # Form builder
│   │   ├── settings/                 # Settings management
│   │   ├── payments/                 # Payment management
│   │   ├── reporting/                # Reporting & analytics
│   │   └── users/                    # User management
│   └── package.json
│
├── orgadmin-events/                  # NEW - Event management
├── orgadmin-memberships/             # NEW - Membership management
├── orgadmin-merchandise/             # NEW - Merchandise management
├── orgadmin-calendar/                # NEW - Calendar bookings
├── orgadmin-registrations/           # NEW - Registration management
└── orgadmin-ticketing/               # NEW - Event ticketing
```

### 1.3 URL Structure

```
/orgadmin                             # Dashboard (landing page)
/orgadmin/events/*                    # Event management
/orgadmin/members/*                   # Membership management
/orgadmin/merchandise/*               # Merchandise management
/orgadmin/calendar/*                  # Calendar bookings
/orgadmin/registrations/*             # Registration management
/orgadmin/tickets/*                   # Event ticketing
/orgadmin/forms/*                     # Form builder
/orgadmin/settings/*                  # Settings
/orgadmin/payments/*                  # Payment management
/orgadmin/reporting/*                 # Reporting
/orgadmin/users/*                     # User management
```

## 2. Module Registration System

### 2.1 Module Registration Interface

```typescript
// packages/orgadmin-shell/src/types/module.types.ts

export interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType;
  color?: string;
  path: string;
}

export interface ModuleRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
}

export interface ModuleRegistration {
  id: string;
  name: string;
  capability?: string;              // undefined = always available
  card: ModuleCard;
  routes: ModuleRoute[];
  order?: number;
}
```

### 2.2 Example Module Registration

```typescript
// packages/orgadmin-events/src/index.ts

import { lazy } from 'react';
import { Event as EventIcon } from '@mui/icons-material';
import { ModuleRegistration } from '@orgadmin/shell';

export const eventsModule: ModuleRegistration = {
  id: 'events',
  name: 'Events',
  capability: 'event-management',
  order: 1,
  card: {
    title: 'Events',
    description: 'Manage events and activities for your organisation',
    icon: EventIcon,
    color: '#1976d2',
    path: '/orgadmin/events',
  },
  routes: [
    {
      path: '/orgadmin/events',
      component: lazy(() => import('./pages/EventsListPage')),
    },
    {
      path: '/orgadmin/events/new',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: '/orgadmin/events/:id',
      component: lazy(() => import('./pages/EventDetailsPage')),
    },
    {
      path: '/orgadmin/events/:id/edit',
      component: lazy(() => import('./pages/EditEventPage')),
    },
  ],
};
```

## 3. Component Design

### 3.1 Shell Application

#### 3.1.1 App Component

```typescript
// packages/orgadmin-shell/src/App.tsx

const App: React.FC = () => {
  const { user, organisation, capabilities, loading } = useAuth();
  
  // Filter modules based on capabilities
  const availableModules = ALL_MODULES.filter(module =>
    !module.capability || capabilities.includes(module.capability)
  );

  if (loading) return <LoadingScreen />;
  if (!user || !organisation) return <Navigate to="/login" />;

  return (
    <BrowserRouter basename="/orgadmin">
      <OrganisationProvider organisation={organisation}>
        <CapabilityProvider capabilities={capabilities}>
          <Routes>
            <Route path="/" element={<DashboardPage modules={availableModules} />} />
            {availableModules.flatMap(module =>
              module.routes.map(route => (
                <Route
                  key={route.path}
                  path={route.path.replace('/orgadmin', '')}
                  element={<Suspense fallback={<LoadingScreen />}>
                    <route.component />
                  </Suspense>}
                />
              ))
            )}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </CapabilityProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};
```

#### 3.1.2 Dashboard Page (Landing Page)

```typescript
// packages/orgadmin-shell/src/pages/DashboardPage.tsx

export const DashboardPage: React.FC<{ modules: ModuleRegistration[] }> = ({ modules }) => {
  const { organisation } = useOrganisation();
  const sortedModules = [...modules].sort((a, b) => (a.order || 999) - (b.order || 999));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome to {organisation.displayName}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Select an area below to get started
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {sortedModules.map(module => (
          <Grid item xs={12} sm={6} md={4} key={module.id}>
            <DashboardCard module={module} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
```

#### 3.1.3 Dashboard Card Component

```typescript
// packages/orgadmin-shell/src/components/DashboardCard.tsx

export const DashboardCard: React.FC<{ module: ModuleRegistration }> = ({ module }) => {
  const navigate = useNavigate();
  const { card } = module;

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
      onClick={() => navigate(card.path)}
    >
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar
            sx={{
              bgcolor: card.color || 'primary.main',
              width: 56,
              height: 56,
            }}
          >
            <card.icon fontSize="large" />
          </Avatar>
        </Box>
        <Typography variant="h6" gutterBottom>
          {card.title}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {card.description}
        </Typography>
      </CardContent>
    </Card>
  );
};
```

### 3.2 Shared Components (Enhanced)

#### 3.2.1 Enhanced Components Package

```
packages/components/src/
├── components/
│   ├── FieldRenderer/              # Existing
│   ├── MetadataForm/               # Existing
│   ├── MetadataTable/              # Existing
│   ├── MetadataWizard/             # Existing
│   │
│   ├── OrgDataTable/               # NEW - Enhanced data table
│   │   ├── OrgDataTable.tsx
│   │   ├── useTableState.ts
│   │   └── TableFilters.tsx
│   │
│   ├── OrgFormBuilder/             # NEW - Form builder
│   │   ├── FormBuilder.tsx
│   │   ├── FieldEditor.tsx
│   │   └── FormPreview.tsx
│   │
│   ├── OrgPaymentWidget/           # NEW - Payment components
│   │   ├── PaymentList.tsx
│   │   ├── PaymentDetails.tsx
│   │   └── RefundDialog.tsx
│   │
│   ├── OrgDatePicker/              # NEW - Date/time pickers
│   │   ├── DateRangePicker.tsx
│   │   └── TimeSlotPicker.tsx
│   │
│   └── OrgFileUpload/              # NEW - File upload
│       ├── FileUpload.tsx
│       └── ImageUpload.tsx
```

## 4. Data Models

### 4.1 Event Management

```typescript
interface Event {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  capacity: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  formId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EventActivity {
  id: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  ageMin?: number;
  ageMax?: number;
}
```

### 4.2 Membership Management

```typescript
interface MembershipType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  price: number;
  duration: number;                    // months
  renewalType: 'manual' | 'automatic';
  formId?: string;
  status: 'active' | 'inactive';
}

interface Member {
  id: string;
  organisationId: string;
  membershipTypeId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'cancelled';
}
```

### 4.3 Merchandise Management

```typescript
interface MerchandiseItem {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  price: number;
  inventory: number;
  images: string[];
  variants?: MerchandiseVariant[];
  status: 'active' | 'inactive';
}

interface MerchandiseVariant {
  id: string;
  itemId: string;
  name: string;                        // e.g., "Size: Large"
  price: number;
  inventory: number;
}
```

### 4.4 Calendar Bookings

```typescript
interface Calendar {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  bookingDuration: number;             // minutes
  advanceBookingDays: number;
  status: 'active' | 'inactive';
}

interface Booking {
  id: string;
  calendarId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: 'confirmed' | 'cancelled';
}
```

### 4.5 Form Builder

```typescript
interface Form {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  fields: FormField[];
  status: 'draft' | 'published';
}

interface FormField {
  id: string;
  formId: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'date';
  label: string;
  required: boolean;
  validation?: Record<string, any>;
  options?: string[];                  // for select/checkbox
  order: number;
}
```

## 5. API Design

### 5.1 Authentication Endpoints

```
POST   /api/orgadmin/auth/login
POST   /api/orgadmin/auth/logout
GET    /api/orgadmin/auth/me
GET    /api/orgadmin/auth/capabilities
```

### 5.2 Event Management Endpoints

```
GET    /api/orgadmin/events
POST   /api/orgadmin/events
GET    /api/orgadmin/events/:id
PUT    /api/orgadmin/events/:id
DELETE /api/orgadmin/events/:id
GET    /api/orgadmin/events/:id/activities
POST   /api/orgadmin/events/:id/activities
```

### 5.3 Membership Management Endpoints

```
GET    /api/orgadmin/membership-types
POST   /api/orgadmin/membership-types
GET    /api/orgadmin/membership-types/:id
PUT    /api/orgadmin/membership-types/:id
DELETE /api/orgadmin/membership-types/:id
GET    /api/orgadmin/members
```

### 5.4 Form Builder Endpoints

```
GET    /api/orgadmin/forms
POST   /api/orgadmin/forms
GET    /api/orgadmin/forms/:id
PUT    /api/orgadmin/forms/:id
DELETE /api/orgadmin/forms/:id
```

### 5.5 Payment Endpoints

```
GET    /api/orgadmin/payments
GET    /api/orgadmin/payments/:id
POST   /api/orgadmin/payments/:id/refund
GET    /api/orgadmin/payments/export
```

### 5.6 Reporting Endpoints

```
GET    /api/orgadmin/reports/dashboard
GET    /api/orgadmin/reports/events
GET    /api/orgadmin/reports/members
GET    /api/orgadmin/reports/revenue
POST   /api/orgadmin/reports/export
```

## 6. Security Design

### 6.1 Authentication Flow

```
1. User navigates to /orgadmin
2. Keycloak redirects to login if not authenticated
3. User logs in with credentials
4. Keycloak returns JWT token
5. Frontend stores token in secure cookie
6. Frontend fetches user's organisation and capabilities
7. Frontend loads appropriate modules
```

### 6.2 Authorization Checks

```typescript
// Backend middleware
export const requireCapability = (capability: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const org = await getOrganisation(user.organisationId);
    
    if (!org.enabledCapabilities.includes(capability)) {
      return res.status(403).json({ error: 'Capability not enabled' });
    }
    
    next();
  };
};

// Usage
router.post('/events',
  authenticateToken(),
  requireCapability('event-management'),
  createEvent
);
```

### 6.3 Role-Based Permissions

```typescript
// Check user's role permissions
export const requirePermission = (capability: string, level: 'read' | 'write' | 'admin') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const roles = await getUserRoles(user.id, user.organisationId);
    
    const hasPermission = roles.some(role =>
      role.capabilityPermissions[capability] &&
      checkPermissionLevel(role.capabilityPermissions[capability], level)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// Example: Module registration test
describe('Module Registration', () => {
  it('should filter modules based on capabilities', () => {
    const capabilities = ['event-management', 'memberships'];
    const filtered = filterModules(ALL_MODULES, capabilities);
    
    expect(filtered).toContainEqual(eventsModule);
    expect(filtered).toContainEqual(membershipsModule);
    expect(filtered).not.toContainEqual(merchandiseModule);
  });
});

// Example: Component test
describe('DashboardCard', () => {
  it('should navigate when clicked', () => {
    const navigate = jest.fn();
    render(<DashboardCard module={eventsModule} />);
    
    fireEvent.click(screen.getByText('Events'));
    expect(navigate).toHaveBeenCalledWith('/orgadmin/events');
  });
});
```

### 7.2 Integration Tests

```typescript
// Example: API integration test
describe('Event API', () => {
  it('should create event with valid data', async () => {
    const response = await request(app)
      .post('/api/orgadmin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Event',
        startDate: '2024-06-01',
        endDate: '2024-06-02',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

## 8. Performance Optimizations

### 8.1 Code Splitting

- Shell bundle: ~200KB
- Each module lazy-loaded on demand
- Shared components in separate chunk

### 8.2 Caching Strategy

- Organisation data cached for session
- Capabilities cached for session
- API responses cached with appropriate TTL

### 8.3 Database Optimization

- Indexes on frequently queried fields
- Pagination for large datasets
- Efficient joins and queries

## 9. Deployment Strategy

### 9.1 Build Process

```bash
# Build all packages
npm run build:shell
npm run build:core
npm run build:events
npm run build:memberships
# ... etc

# Or build all at once
npm run build:orgadmin
```

### 9.2 Docker Configuration

```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/orgadmin-shell ./packages/orgadmin-shell
COPY packages/orgadmin-core ./packages/orgadmin-core
# ... copy other packages
RUN npm ci
RUN npm run build:orgadmin

FROM nginx:alpine
COPY --from=builder /app/packages/orgadmin-shell/dist /usr/share/nginx/html/orgadmin
COPY nginx.conf /etc/nginx/nginx.conf
```

## 10. Migration Strategy

### 10.1 Phase 1: Foundation
- Create shell package
- Implement authentication
- Create dashboard with cards
- Deploy to staging

### 10.2 Phase 2: Core Modules
- Implement Forms module
- Implement Settings module
- Implement Users module
- Deploy to staging

### 10.3 Phase 3: Capability Modules (Incremental)
- Implement one capability module at a time
- Test thoroughly
- Deploy to production incrementally

### 10.4 Phase 4: Remaining Modules
- Complete all capability modules
- Implement Payments module
- Implement Reporting module
- Full production deployment

## 11. Monitoring & Logging

### 11.1 Frontend Monitoring
- Error tracking (Sentry)
- Performance monitoring
- User analytics

### 11.2 Backend Monitoring
- API response times
- Error rates
- Database query performance

### 11.3 Logging
- Structured logging
- Log levels (debug, info, warn, error)
- Centralized log aggregation
