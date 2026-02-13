/**
 * Module Registration Types
 * 
 * These types define the structure for registering modules in the
 * ItsPlainSailing Organisation Admin system.
 */

import { ComponentType, LazyExoticComponent } from 'react';

export interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType;
  color?: string;
  path: string;
}

export interface ModuleRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
}

export interface MenuItem {
  label: string;
  path: string;
  icon: ComponentType;
}

export interface ModuleRegistration {
  id: string;
  name: string;
  title: string;
  description: string;
  capability?: string;
  card: ModuleCard;
  routes: ModuleRoute[];
  menuItem?: MenuItem;
  subMenuItems?: MenuItem[];
  order?: number;
}
