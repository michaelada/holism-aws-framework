import { ComponentType, LazyExoticComponent } from 'react';

/**
 * Represents a card displayed on the dashboard for a module
 */
export interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType;
  color?: string;
  path: string;
}

/**
 * Represents a route within a module
 */
export interface ModuleRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
}

/**
 * Represents a menu item for navigation
 */
export interface MenuItem {
  label: string;
  path: string;
  icon?: ComponentType;
}

/**
 * Complete module registration interface
 * Used by feature modules to register themselves with the shell
 */
export interface ModuleRegistration {
  id: string;
  name: string;
  title: string;                       // Used on dashboard card
  description: string;                 // Used on dashboard card
  capability?: string;                 // undefined = always available (core module)
  card: ModuleCard;
  routes: ModuleRoute[];
  menuItem?: MenuItem;                 // Optional menu item for navigation drawer
  order?: number;                      // Display order (lower = first)
}
