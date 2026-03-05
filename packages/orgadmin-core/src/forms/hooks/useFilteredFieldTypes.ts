/**
 * useFilteredFieldTypes Hook
 * 
 * Filters field types based on organization capabilities.
 * File and image upload field types require the 'document-management' capability.
 */

import { useCapabilities } from '@aws-web-framework/orgadmin-shell';

/**
 * Returns an array of field types available to the current organization.
 * Filters out 'file' and 'image' types if the organization doesn't have
 * the 'document-management' capability.
 * 
 * @returns Array of available field type strings
 */
export function useFilteredFieldTypes(): string[] {
  const { hasCapability } = useCapabilities();
  
  const allFieldTypes = [
    'text',
    'textarea',
    'number',
    'email',
    'phone',
    'date',
    'time',
    'datetime',
    'boolean',
    'select',
    'multiselect',
    'radio',
    'checkbox',
    'file',
    'image',
  ];
  
  return allFieldTypes.filter(type => {
    // Filter out file and image types if capability not present
    if (type === 'file' || type === 'image') {
      return hasCapability('document-management');
    }
    return true;
  });
}
