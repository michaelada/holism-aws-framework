# ItsPlainSailing Organisation Admin - Events Module

Event Management module for ItsPlainSailing Organisation Admin system.

## Features

- Event creation and management with comprehensive attributes
- Event activities with detailed configuration
- Entry management with tabular view and filtering
- Excel export for event entries
- Payment integration (card, cheque/offline)
- Application form integration
- Terms and conditions support
- Email notifications

## Capability Requirement

This module requires the `event-management` capability to be enabled for the organisation.

## Routes

- `/orgadmin/events` - Events list
- `/orgadmin/events/new` - Create new event
- `/orgadmin/events/:id` - Event details
- `/orgadmin/events/:id/edit` - Edit event
- `/orgadmin/events/:id/entries` - Event entries

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

This module includes comprehensive unit tests for:
- Event list rendering and filtering
- Event creation form validation
- Activity form validation
- Entries table filtering
- Excel export functionality
