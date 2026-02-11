# Admin Frontend

Admin portal for managing tenants, users, and roles in the AWS Web Application Framework.

## Overview

This is a separate React application that provides administrative functionality for the system. It uses the same Keycloak realm as the main frontend but requires users to have the `admin` realm role to access.

## Features

- **Tenant Management**: Create, update, and delete organizations
- **User Management**: Manage users, assign roles, reset passwords
- **Role Management**: Create and manage roles
- **Audit Logging**: Track all administrative actions
- **Keycloak Integration**: Secure authentication with admin role checking

## Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Material-UI** with neumorphic theme
- **React Router** for navigation
- **Keycloak** for authentication
- **Vitest** for testing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Keycloak server running (see infrastructure/keycloak/README.md)
- Backend service running (see packages/backend/README.md)

### Installation

```bash
cd packages/admin
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000

# Keycloak Configuration
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-admin

# Development Mode - Set to 'true' to disable authentication
VITE_DISABLE_AUTH=false
```

### Development

Start the development server:

```bash
npm run dev
```

The admin portal will be available at http://localhost:5174

### Building

Build for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Project Structure

```
packages/admin/
├── src/
│   ├── components/       # Reusable UI components
│   ├── context/          # React context providers
│   ├── pages/            # Page components (to be implemented)
│   ├── routes/           # Route configuration
│   ├── services/         # API services (to be implemented)
│   ├── theme/            # Theme configuration
│   ├── test/             # Test setup
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Authentication

The admin portal uses Keycloak for authentication with the following requirements:

1. Users must be authenticated with Keycloak
2. Users must have the `admin` realm role
3. Users without the admin role will see an "Access Denied" message

### Admin Role Setup

To grant admin access to a user in Keycloak:

1. Log in to Keycloak Admin Console
2. Navigate to your realm (aws-framework)
3. Go to Users → Select user
4. Go to Role Mappings tab
5. Assign the `admin` realm role

## Theme

The admin portal uses the same neumorphic theme as the main frontend for consistent styling. The theme is imported from `packages/frontend/src/theme/neumorphicTheme.ts`.

## Components Library

The admin portal can reuse components from the shared components library (`@aws-web-framework/components`) for consistent UI elements like tables, forms, and dialogs.

## API Integration

API calls to the backend are made through service modules that will be implemented in later tasks. All API calls include the Keycloak access token for authentication.

## Development Tips

### Disable Authentication

For local development without Keycloak, set `VITE_DISABLE_AUTH=true` in your `.env` file. This will bypass authentication and grant admin access automatically.

### Hot Module Replacement

Vite provides fast HMR (Hot Module Replacement) for a smooth development experience. Changes to your code will be reflected immediately in the browser.

### TypeScript

The project uses strict TypeScript configuration. Run `npm run build` to check for type errors.

## Deployment

The admin portal is deployed alongside the main frontend:

- **Development**: Runs on port 5174
- **Production**: Served through Nginx at `/admin` path

See `DEPLOYMENT.md` in the root directory for deployment instructions.

## License

Proprietary - AWS Web Application Framework
