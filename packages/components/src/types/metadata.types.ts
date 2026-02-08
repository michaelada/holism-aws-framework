/**
 * Shared type definitions for metadata-driven components
 * These types mirror the backend metadata types
 */

export enum FieldDatatype {
  TEXT = 'text',
  TEXT_AREA = 'text_area',
  SINGLE_SELECT = 'single_select',
  MULTI_SELECT = 'multi_select',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  EMAIL = 'email',
  URL = 'url',
}

export enum ValidationType {
  REQUIRED = 'required',
  MIN_LENGTH = 'min_length',
  MAX_LENGTH = 'max_length',
  PATTERN = 'pattern',
  MIN_VALUE = 'min_value',
  MAX_VALUE = 'max_value',
  EMAIL = 'email',
  URL = 'url',
  CUSTOM = 'custom',
}

export interface ValidationRule {
  type: ValidationType;
  value?: any;
  message?: string;
  customFunction?: string;
}

export interface FieldDefinition {
  shortName: string;
  displayName: string;
  description: string;
  datatype: FieldDatatype;
  datatypeProperties: Record<string, any>;
  validationRules?: ValidationRule[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ObjectFieldReference {
  fieldShortName: string;
  mandatory: boolean;
  order: number;
  inTable?: boolean;  // Whether this field should appear as a column in table views (default: true)
}

export interface FieldGroup {
  name: string;
  description: string;
  fields: string[];
  order: number;
}

export interface WizardStep {
  name: string;
  description: string;
  fields: string[];
  order: number;
}

export interface WizardConfiguration {
  steps: WizardStep[];
}

export interface ObjectDefinition {
  shortName: string;
  displayName: string;
  description: string;
  fields: ObjectFieldReference[];
  displayProperties: {
    defaultSortField?: string;
    defaultSortOrder?: 'asc' | 'desc';
    searchableFields?: string[];
    tableColumns?: string[];
  };
  wizardConfig?: WizardConfiguration;
  fieldGroups?: FieldGroup[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FieldError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: FieldError[];
  };
}
