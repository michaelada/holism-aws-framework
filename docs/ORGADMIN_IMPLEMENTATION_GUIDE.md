# Organisation Admin UI - Implementation Guide

## Quick Start Guide

This guide provides step-by-step instructions for implementing the modular Organisation Admin UI.

## Phase 1: Foundation (Week 1-2)

### Step 1: Create Shell Package

```bash
# Create the shell package
mkdir -p packages/orgadmin-shell/src/{components,context,hooks,types,routes}
cd packages/orgadmin-shell
npm init -y
```

**Key Files to Create:**

1. `packages/orgadmin-shell/package.json`
```json
{
  "name": "@aws-web-framework/orgadmin-shell",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@mui/material": "^5.14.0",
    "@mui/icons-material": "^5.14.0",
    "keycloak-js": "^23.0.0",
    "@aws-web-framework/components": "*"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

2. `packages/orgadmin-shell/src/types/module.types.ts`
```typescript
import { ComponentType, LazyExoticComponent } from 'react';

export interface ModuleRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
  exact?: boolean;
}

export interface MenuItem {
  label: string;
  path: string;
  icon: ComponentType;
  badge?: number;
}

export interface ModuleRegistration {
  id: string;
  name: string;
  capability?: string; // undefined = always available
  icon: ComponentType;
  routes: ModuleRoute[];
  menuItems: MenuItem[];
  order?: number; // for menu ordering
}
```

3. `packages/orgadmin-shell/src/context/CapabilityContext.tsx`
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';

interface CapabilityContextType {
  capabilities: string[];
  hasCapability: (capability: string) => boolean;
  loading: boolean;
}

const CapabilityContext = createContext<CapabilityContextType | undefined>(undefined);

export const CapabilityProvider: React.FC<{ 
  organisationId: string;
  children: React.ReactNode;
}> = ({ organisationId, children }) => {
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        // Fetch organisation capabilities from backend
        const response = await fetch(`/api/organizations/${organisationId}`);
        const org = await response.json();
        setCapabilities(org.enabledCapabilities || []);
      } catch (error) {
        console.error('Failed to load capabilities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCapabilities();
  }, [organisationId]);

  const hasCapability = (capability: string) => {
    return capabilities.includes(capability);
  };

  return (
    <CapabilityContext.Provider value={{ capabilities, hasCapability, loading }}>
      {children}
    </CapabilityContext.Provider>
  );
};

export const useCapabilities = () => {
  const context = useContext(CapabilityContext);
  if (!context) {
    throw new Error('useCapabilities must be used within CapabilityProvider');
  }
  return context;
};
```

4. `packages/orgadmin-shell/src/context/OrganisationContext.tsx`
```typescript
import React, { createContext, useContext } from 'react';

interface Organisation {
  id: string;
  name: string;
  displayName: string;
  currency: string;
  language: string;
  status: string;
}

interface OrganisationContextType {
  organisation: Organisation | null;
}

const OrganisationContext = createContext<OrganisationContextType | undefined>(undefined);

export const OrganisationProvider: React.FC<{
  organisation: Organisation | null;
  children: React.ReactNode;
}> = ({ organisation, children }) => {
  return (
    <OrganisationContext.Provider value={{ organisation }}>
      {children}
    </OrganisationContext.Provider>
  );
};

export const useOrganisation = () => {
  const context = useContext(OrganisationContext);
  if (!context) {
    throw new Error('useOrganisation must be used within OrganisationProvider');
  }
  return context;
};
```

5. `packages/orgadmin-shell/src/components/Layout.tsx`
```typescript
import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Menu as MenuIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ModuleRegistration } from '../types/module.types';
import { useOrganisation } from '../context/OrganisationContext';

const DRAWER_WIDTH = 240;

interface LayoutProps {
  modules: ModuleRegistration[];
  children: React.ReactNode;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ modules, children, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { organisation } = useOrganisation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const sortedModules = [...modules].sort((a, b) => 
    (a.order || 999) - (b.order || 999)
  );

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap>
          {organisation?.displayName || 'Organisation'}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {sortedModules.flatMap(module => 
          module.menuItems.map(item => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton onClick={() => navigate(item.path)}>
                <ListItemIcon>
                  <item.icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={onLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Organisation Admin
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};
```

6. `packages/orgadmin-shell/src/App.tsx`
```typescript
import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { Layout } from './components/Layout';
import { CapabilityProvider } from './context/CapabilityContext';
import { OrganisationProvider } from './context/OrganisationContext';
import { ModuleRegistration } from './types/module.types';

// Import core modules
import { dashboardModule } from '@orgadmin/core/dashboard';
import { settingsModule } from '@orgadmin/core/settings';
import { paymentsModule } from '@orgadmin/core/payments';
import { reportingModule } from '@orgadmin/core/reporting';
import { formsModule } from '@orgadmin/core/forms';
import { usersModule } from '@orgadmin/core/users';

// Import feature modules
import { eventsModule } from '@orgadmin/events';
import { membershipsModule } from '@orgadmin/memberships';
import { merchandiseModule } from '@orgadmin/merchandise';
import { calendarModule } from '@orgadmin/calendar';
import { registrationsModule } from '@orgadmin/registrations';
import { ticketingModule } from '@orgadmin/ticketing';

const ALL_MODULES: ModuleRegistration[] = [
  dashboardModule,
  eventsModule,
  membershipsModule,
  merchandiseModule,
  calendarModule,
  registrationsModule,
  ticketingModule,
  formsModule,
  settingsModule,
  paymentsModule,
  reportingModule,
  usersModule,
];

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [organisation, setOrganisation] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize Keycloak and load user data
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // TODO: Initialize Keycloak
      // const keycloak = new Keycloak({ ... });
      // await keycloak.init({ onLoad: 'login-required' });
      
      // TODO: Fetch user's organisation
      // const orgResponse = await fetch('/api/user/organisation');
      // const org = await orgResponse.json();
      
      // For now, mock data
      setUser({ id: '1', name: 'Admin User' });
      setOrganisation({ 
        id: '1', 
        name: 'test-org',
        displayName: 'Test Organisation',
        currency: 'GBP',
        language: 'en',
        status: 'active'
      });
      setCapabilities(['event-management', 'memberships']);
    } catch (error) {
      console.error('Auth initialization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // TODO: Implement Keycloak logout
    console.log('Logout');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Filter modules based on capabilities
  const availableModules = ALL_MODULES.filter(module =>
    !module.capability || capabilities.includes(module.capability)
  );

  return (
    <BrowserRouter basename="/orgadmin">
      <OrganisationProvider organisation={organisation}>
        <CapabilityProvider organisationId={organisation?.id}>
          <Layout modules={availableModules} onLogout={handleLogout}>
            <Suspense fallback={<CircularProgress />}>
              <Routes>
                {availableModules.flatMap(module =>
                  module.routes.map(route => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<route.component />}
                    />
                  ))
                )}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<div>404 - Page Not Found</div>} />
              </Routes>
            </Suspense>
          </Layout>
        </CapabilityProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};
```

### Step 2: Create Core Package

```bash
mkdir -p packages/orgadmin-core/src/{dashboard,settings,payments,reporting,forms,users}
cd packages/orgadmin-core
npm init -y
```

**Example Core Module:**

`packages/orgadmin-core/src/dashboard/index.ts`
```typescript
import { lazy } from 'react';
import { Dashboard as DashboardIcon } from '@mui/icons-material';
import { ModuleRegistration } from '@orgadmin/shell';

export const dashboardModule: ModuleRegistration = {
  id: 'dashboard',
  name: 'Dashboard',
  icon: DashboardIcon,
  order: 1,
  routes: [
    {
      path: '/dashboard',
      component: lazy(() => import('./pages/DashboardPage')),
    },
  ],
  menuItems: [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: DashboardIcon,
    },
  ],
};
```

`packages/orgadmin-core/src/dashboard/pages/DashboardPage.tsx`
```typescript
import React from 'react';
import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import { useOrganisation } from '@orgadmin/shell';

export const DashboardPage: React.FC = () => {
  const { organisation } = useOrganisation();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Welcome to {organisation?.displayName}
      </Typography>

      <Grid container spacing={3} mt={2}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Active Events</Typography>
              <Typography variant="h3">12</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Members</Typography>
              <Typography variant="h3">245</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Revenue (MTD)</Typography>
              <Typography variant="h3">£4,250</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Pending Payments</Typography>
              <Typography variant="h3">8</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
```

### Step 3: Create First Feature Module (Events)

```bash
mkdir -p packages/orgadmin-events/src/{pages,components,services}
cd packages/orgadmin-events
npm init -y
```

`packages/orgadmin-events/src/index.ts`
```typescript
import { lazy } from 'react';
import { Event as EventIcon } from '@mui/icons-material';
import { ModuleRegistration } from '@orgadmin/shell';

export const eventsModule: ModuleRegistration = {
  id: 'events',
  name: 'Events',
  capability: 'event-management',
  icon: EventIcon,
  order: 2,
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

## Phase 2: Backend Services (Week 3-4)

### Add Event Management Service

`packages/backend/src/services/event.service.ts`
```typescript
import { pool } from '../database';
import { logger } from '../config/logger';

export interface Event {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  capacity: number;
  status: 'draft' | 'published' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export class EventService {
  async getEventsByOrganisation(organisationId: string): Promise<Event[]> {
    const result = await pool.query(
      'SELECT * FROM events WHERE organisation_id = $1 ORDER BY start_date DESC',
      [organisationId]
    );
    return result.rows;
  }

  async createEvent(organisationId: string, eventData: Partial<Event>): Promise<Event> {
    const result = await pool.query(
      `INSERT INTO events (organisation_id, name, description, start_date, end_date, location, capacity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        organisationId,
        eventData.name,
        eventData.description,
        eventData.startDate,
        eventData.endDate,
        eventData.location,
        eventData.capacity,
        eventData.status || 'draft',
      ]
    );
    return result.rows[0];
  }

  // Add more methods...
}

export const eventService = new EventService();
```

### Add Routes

`packages/backend/src/routes/event.routes.ts`
```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { eventService } from '../services/event.service';

const router = Router();

// All routes require authentication and org-admin role
router.use(authenticateToken());

// Get events for user's organisation
router.get('/', async (req, res, next) => {
  try {
    const organisationId = req.user.organisationId;
    const events = await eventService.getEventsByOrganisation(organisationId);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// Create event
router.post('/', async (req, res, next) => {
  try {
    const organisationId = req.user.organisationId;
    const event = await eventService.createEvent(organisationId, req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

export default router;
```

## Phase 3: Testing Strategy

### Module Testing
```typescript
// packages/orgadmin-events/src/__tests__/EventsListPage.test.tsx
import { render, screen } from '@testing-library/react';
import { EventsListPage } from '../pages/EventsListPage';

describe('EventsListPage', () => {
  it('should render events list', () => {
    render(<EventsListPage />);
    expect(screen.getByText('Events')).toBeInTheDocument();
  });
});
```

### Integration Testing
```typescript
// Test capability-based routing
describe('App with capabilities', () => {
  it('should show events menu when capability enabled', () => {
    const capabilities = ['event-management'];
    render(<App capabilities={capabilities} />);
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('should hide events menu when capability disabled', () => {
    const capabilities = [];
    render(<App capabilities={capabilities} />);
    expect(screen.queryByText('Events')).not.toBeInTheDocument();
  });
});
```

## Summary

This modular architecture provides:
- ✅ Capability-driven UI
- ✅ Independent module development
- ✅ Lazy loading for performance
- ✅ Shared component reuse
- ✅ Clear separation of concerns
- ✅ Easy to extend with new modules

Start with the shell and core modules, then add feature modules incrementally!
