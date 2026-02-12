# ItsPlainSailing Organisation Admin Shell

The shell application for the ItsPlainSailing Organisation Admin system. This package provides the foundation for the modular, capability-driven organisation administration interface.

## Overview

The orgadmin-shell is responsible for:
- **Authentication**: Keycloak-based authentication with org-admin role verification
- **Organisation Loading**: Fetches and provides organisation data to all modules
- **Capability Management**: Loads organisation capabilities and filters available modules
- **Module Registration**: Dynamic module loading based on capabilities
- **Layout & Navigation**: Provides consistent layout and navigation across all modules
- **Routing**: URL-based routing with `/orgadmin` base path

## Architecture

### Core Components

- **useAuth Hook**: Handles Keycloak authentication and organisation loading
- **OrganisationContext**: Provides organisation data to all components
- **CapabilityContext**: Provides capability checking functionality
- **Module Registration System**: Allows feature modules to register themselves

### Module Registration

Feature modules register themselves with the shell using the `ModuleRegistration` interface:

```typescript
export interface ModuleRegistration {
  id: string;
  name: string;
  title: string;                       // Used on dashboard card
  description: string;                 // Used on dashboard card
  capability?: string;                 // undefined = always available
  card: ModuleCard;
  routes: ModuleRoute[];
  menuItem?: MenuItem;
  order?: number;
}
```

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- Keycloak server running (or VITE_DISABLE_AUTH=true for development)

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-web-framework
VITE_KEYCLOAK_CLIENT_ID=orgadmin-client
VITE_DISABLE_AUTH=false  # Set to true to bypass Keycloak for development
```

### Running Locally

```bash
# Install dependencies (from root)
npm install

# Run development server
npm run dev:orgadmin

# Build for production
npm run build:orgadmin

# Run tests
npm run test:orgadmin
```

The application will be available at `http://localhost:5175/orgadmin`

## Project Structure

```
packages/orgadmin-shell/
├── src/
│   ├── components/          # Shell components (Layout, DashboardCard, etc.)
│   ├── context/             # React contexts (Organisation, Capability)
│   ├── hooks/               # Custom hooks (useAuth)
│   ├── pages/               # Shell pages (DashboardPage)
│   ├── types/               # TypeScript type definitions
│   ├── test/                # Test setup
│   ├── App.tsx              # Main application component
│   └── main.tsx             # Application entry point
├── index.html               # HTML template
├── package.json             # Package configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration
└── README.md                # This file
```

## Authentication Flow

1. User navigates to `/orgadmin`
2. Keycloak redirects to login if not authenticated
3. User logs in with credentials
4. Keycloak returns JWT token
5. Shell fetches user's organisation via `/api/orgadmin/auth/me`
6. Shell verifies user has org-admin role
7. Shell loads organisation's enabled capabilities
8. Shell filters and displays available modules
9. User can navigate to any available module

## Access Control

- **Authentication**: All users must authenticate via Keycloak
- **Authorization**: Only users with org-admin role can access the interface
- **Capability-Based**: Modules are only visible if the organisation has the required capability enabled

## Next Steps

After completing the shell foundation (Task 1), the following tasks will be implemented:

- **Task 2**: Shell layout and navigation components
- **Task 3**: Main App component with routing
- **Phase 2**: Core modules (Forms, Settings, Payments, Reporting, Users)
- **Phase 3**: Capability modules (Events, Memberships, Merchandise, etc.)

## Requirements Implemented

This package implements the following requirements from the specification:

- **2.1.1**: User authenticates via Keycloak
- **2.1.2**: System identifies user as organisation administrator
- **2.1.3**: System loads user's organisation details
- **2.1.4**: System fetches organisation's enabled capabilities
- **2.1.5**: System fetches user's assigned roles and permissions
- **2.1.6**: Non-admin users are denied access to orgadmin interface
- **3.1.1**: Workspace structure with separate packages
- **3.1.2**: Module registration system
- **3.2.1**: Keycloak-based authentication

## License

Proprietary - AWS Web Application Framework
