# ItsPlainSailing Organisation Admin - Registrations Module

This module provides entity registration management functionality for the ItsPlainSailing Organisation Admin system.

## Overview

The Registrations module allows organisations to manage registrations for entities (non-person items) that require annual or periodic registration. Unlike Memberships which are for people, Registrations are for things like:
- Horse registration
- Boat registration
- Equipment registration
- Vehicle registration
- Any other entity requiring periodic registration and payment

## Features

### Registration Types
- Create and manage different registration types
- Configure entity names (Horse, Boat, Equipment, etc.)
- Set pricing and duration (fixed or rolling)
- Define registration forms for collecting entity information
- Configure payment methods and terms & conditions
- Automatic or manual approval workflows

### Registration Database
- Comprehensive database of all registrations
- Advanced filtering and search capabilities
- Batch operations (mark processed, add/remove labels)
- Custom filter sets for complex queries
- Excel export functionality
- Status management (Active, Pending, Elapsed)

### Key Differences from Memberships
- Registrations are for entities (things), not people
- Entity Name field identifies what is being registered
- No group registrations (each entity is registered individually)
- Simpler data model focused on entity tracking

## Capability Requirement

This module requires the `registrations` capability to be enabled for the organisation.

## Routes

- `/orgadmin/registrations` - Registration types list
- `/orgadmin/registrations/types/new` - Create registration type
- `/orgadmin/registrations/types/:id` - Registration type details
- `/orgadmin/registrations/types/:id/edit` - Edit registration type
- `/orgadmin/registrations/database` - Registrations database
- `/orgadmin/registrations/:id` - Registration details

## Components

### Pages
- `RegistrationTypesListPage` - List all registration types
- `CreateRegistrationTypePage` - Create new registration type
- `RegistrationTypeDetailsPage` - View registration type details
- `RegistrationsDatabasePage` - Manage all registrations
- `RegistrationDetailsPage` - View individual registration details

### Components
- `RegistrationTypeForm` - Reusable form for registration type creation/editing
- `CreateCustomFilterDialog` - Create custom filter sets
- `BatchOperationsDialog` - Batch operations on registrations

## Data Models

### RegistrationType
- Basic information (name, description, entity name)
- Registration form configuration
- Status (open/closed)
- Duration settings (rolling or fixed-period)
- Approval settings
- Labels and payment methods
- Terms and conditions

### Registration
- Registration type and number
- Entity name and owner information
- Form submission data
- Status and dates
- Labels and processed flag
- Payment information

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Testing

The module includes comprehensive unit tests covering:
- Registration type list rendering and filtering
- Registration type creation form validation
- Entity name field handling
- Registrations database filtering
- Batch operations
- Excel export functionality
- Status management

## Integration

This module integrates with:
- Form Builder (for registration forms)
- Payments module (for payment processing)
- File Upload service (for document uploads)
- Organisation context (for capability checks)
