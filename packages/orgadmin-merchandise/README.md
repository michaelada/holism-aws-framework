# ItsPlainSailing Organisation Admin - Merchandise Module

This module provides merchandise management functionality for the ItsPlainSailing Organisation Admin system.

## Features

- **Merchandise Types Management**: Create and manage merchandise items with flexible configuration
- **Options Configuration**: Support for multiple option types (Size, Color, Pack, etc.) with individual pricing
- **Stock Management**: Optional inventory tracking with low stock alerts
- **Delivery Configuration**: Flexible delivery models (free, fixed, quantity-based)
- **Order Management**: View and manage merchandise orders with status tracking
- **Order Quantity Rules**: Set minimum, maximum, and increment requirements
- **Application Forms**: Optional forms for collecting additional customer information
- **Payment Integration**: Support for multiple payment methods
- **Excel Export**: Export orders to formatted Excel files

## Capability Requirement

This module requires the `merchandise` capability to be enabled for the organisation.

## Routes

- `/orgadmin/merchandise` - Merchandise types list
- `/orgadmin/merchandise/new` - Create new merchandise type
- `/orgadmin/merchandise/:id` - Merchandise type details
- `/orgadmin/merchandise/:id/edit` - Edit merchandise type
- `/orgadmin/merchandise/orders` - Orders list
- `/orgadmin/merchandise/orders/:id` - Order details

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

# Run tests with coverage
npm run test:coverage
```

## Module Registration

This module exports a `merchandiseModule` registration that includes:
- Module metadata (id, name, title, description)
- Capability requirement
- Route definitions
- Dashboard card configuration
