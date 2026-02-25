/**
 * Merchandise Module (Merchandise Management)
 * 
 * Capability module that provides merchandise management functionality.
 * Only visible if organisation has 'merchandise' capability enabled.
 * 
 * Features:
 * - Merchandise type management with flexible configuration
 * - Multiple option types (Size, Color, Pack, etc.) with individual pricing
 * - Optional stock management with low stock alerts
 * - Flexible delivery models (free, fixed, quantity-based)
 * - Order quantity rules (min, max, increments)
 * - Application form integration for additional customer information
 * - Payment method configuration
 * - Terms and conditions support
 * - Order management with status tracking
 * - Excel export for orders
 * - Image gallery with drag-and-drop reordering
 */

import { lazy } from 'react';
import { Store as MerchandiseIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const merchandiseModule: ModuleRegistration = {
  id: 'merchandise',
  name: 'modules.merchandise.name',
  title: 'modules.merchandise.title',
  description: 'modules.merchandise.description',
  capability: 'merchandise', // Requires merchandise capability
  order: 12, // After memberships module
  card: {
    title: 'modules.merchandise.title',
    description: 'modules.merchandise.description',
    icon: MerchandiseIcon,
    color: '#ed6c02',
    path: '/merchandise',
  },
  routes: [
    {
      path: '/merchandise',
      component: lazy(() => import('./pages/MerchandiseTypesListPage')),
    },
    {
      path: '/merchandise/new',
      component: lazy(() => import('./pages/CreateMerchandiseTypePage')),
    },
    {
      path: '/merchandise/:id',
      component: lazy(() => import('./pages/MerchandiseTypeDetailsPage')),
    },
    {
      path: '/merchandise/:id/edit',
      component: lazy(() => import('./pages/CreateMerchandiseTypePage')),
    },
    {
      path: '/merchandise/orders',
      component: lazy(() => import('./pages/MerchandiseOrdersListPage')),
    },
    {
      path: '/merchandise/orders/:id',
      component: lazy(() => import('./pages/MerchandiseOrderDetailsPage')),
    },
  ],
  menuItem: {
    label: 'modules.merchandise.name',
    path: '/merchandise',
    icon: MerchandiseIcon,
  },
};

// Export pages for direct use if needed
export { default as MerchandiseTypesListPage } from './pages/MerchandiseTypesListPage';
export { default as CreateMerchandiseTypePage } from './pages/CreateMerchandiseTypePage';
export { default as MerchandiseTypeDetailsPage } from './pages/MerchandiseTypeDetailsPage';
export { default as MerchandiseOrdersListPage } from './pages/MerchandiseOrdersListPage';
export { default as MerchandiseOrderDetailsPage } from './pages/MerchandiseOrderDetailsPage';

// Export components
export { default as MerchandiseTypeForm } from './components/MerchandiseTypeForm';
export { default as OptionsConfigurationSection } from './components/OptionsConfigurationSection';
export { default as StockManagementSection } from './components/StockManagementSection';
export { default as DeliveryConfigurationSection } from './components/DeliveryConfigurationSection';
export { default as OrderQuantityRulesSection } from './components/OrderQuantityRulesSection';
export { default as ImageGalleryUpload } from './components/ImageGalleryUpload';
export { default as OrderStatusUpdateDialog } from './components/OrderStatusUpdateDialog';
export { default as BatchOrderOperationsDialog } from './components/BatchOrderOperationsDialog';

// Export utilities
export * from './utils/priceCalculator';

// Export types
export * from './types/merchandise.types';
export * from './types/module.types';

export const ORGADMIN_MERCHANDISE_VERSION = '1.0.0';
