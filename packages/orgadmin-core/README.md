# ItsPlainSailing Organisation Admin Core Modules

This package contains the core modules that are always available to all organisation administrators in the ItsPlainSailing system.

## Modules

### Dashboard
High-level metrics and navigation hub for the organisation admin interface.

### Forms (Form Builder)
Create and manage custom application forms that can be linked to events, memberships, registrations, calendar bookings, and merchandise.

### Settings
Manage organisation settings including:
- Organisation details
- Payment settings
- Email templates
- Branding (logo, colors)

### Payments
View and manage payments including:
- Payment history
- Lodgements
- Refund requests
- Payment exports

### Reporting
Generate reports and view analytics:
- Dashboard metrics
- Event reports
- Member reports
- Revenue reports

### Users
Manage users for the organisation:
- **Org Admin Users**: Administrators who access the orgadmin UI
- **Account Users**: Organisation members who access the accountuser UI

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## Architecture

Each module follows a consistent structure:
- `pages/` - React page components
- `components/` - Module-specific components
- `hooks/` - Custom React hooks
- `services/` - API service functions
- `types/` - TypeScript type definitions
- `index.ts` - Module registration and exports

## Module Registration

Each module exports a `ModuleRegistration` object that includes:
- Module metadata (id, name, title, description)
- Capability requirements (if any)
- Routes and navigation items
- Dashboard card configuration

## Dependencies

This package depends on:
- `@aws-web-framework/orgadmin-shell` - Shell types and utilities
- `@aws-web-framework/components` - Shared UI components
- React, React Router, Material-UI

## License

Proprietary
