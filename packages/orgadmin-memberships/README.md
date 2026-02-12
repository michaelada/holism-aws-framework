# ItsPlainSailing Organisation Admin - Memberships Module

This module provides membership management functionality for the ItsPlainSailing Organisation Admin system.

## Features

- **Membership Types Management**: Create and manage single and group membership types
- **Members Database**: Comprehensive member records with advanced filtering
- **Batch Operations**: Mark processed, add/remove labels in bulk
- **Custom Filters**: Create named filter sets for member searches
- **Excel Export**: Export member data based on active filters
- **Rolling & Fixed Memberships**: Support for both rolling and fixed-period memberships
- **Group Memberships**: Configure multi-person memberships with field sharing

## Capability Requirement

This module requires the `memberships` capability to be enabled for the organisation.

## Routes

- `/orgadmin/members` - Members database (default view)
- `/orgadmin/members/types` - Membership types list
- `/orgadmin/members/types/new/single` - Create single membership type
- `/orgadmin/members/types/new/group` - Create group membership type
- `/orgadmin/members/types/:id` - Membership type details
- `/orgadmin/members/types/:id/edit` - Edit membership type
- `/orgadmin/members/:id` - Member details

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

# Generate coverage report
npm run test:coverage
```

## Testing

The module includes comprehensive unit tests for all components and pages. Tests cover:

- Membership type list rendering and filtering
- Single and group membership type creation
- Members database filtering (default and custom filters)
- Batch operations (mark processed, add/remove labels)
- Excel export functionality
- Member details view and status changes

## Architecture

This module follows the modular architecture pattern:

- **Pages**: Main views for membership types and members
- **Components**: Reusable UI components (forms, dialogs, tables)
- **Types**: TypeScript interfaces for membership data
- **Test**: Test setup and utilities

## Integration

This module integrates with:

- **Form Builder**: Links to application forms for membership applications
- **Payments Module**: Supports multiple payment methods
- **Backend API**: RESTful endpoints for membership management
