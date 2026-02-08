import React from 'react';
import type { FieldDefinition } from '../../types';
import { useFieldValidation } from '../../hooks';
import { TextRenderer } from './renderers/TextRenderer';
import { DateRenderer } from './renderers/DateRenderer';
import { SelectRenderer } from './renderers/SelectRenderer';
import { MultiSelectRenderer } from './renderers/MultiSelectRenderer';
import { NumberRenderer } from './renderers/NumberRenderer';
import { BooleanRenderer } from './renderers/BooleanRenderer';

export interface FieldRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onBlur?: () => void;
}

/**
 * FieldRenderer component that renders fields based on their datatype
 * Integrates with useFieldValidation hook for client-side validation
 * Displays validation errors inline
 * 
 * @example
 * ```tsx
 * <FieldRenderer
 *   fieldDefinition={fieldDef}
 *   value={formData[fieldDef.shortName]}
 *   onChange={(value) => setFormData({ ...formData, [fieldDef.shortName]: value })}
 * />
 * ```
 */
export function FieldRenderer({
  fieldDefinition,
  value,
  onChange,
  error: externalError,
  disabled = false,
  required = false,
  onBlur,
}: FieldRendererProps): JSX.Element {
  const { error: validationError, validate } = useFieldValidation(fieldDefinition);
  
  // Use external error if provided, otherwise use validation error
  const displayError = externalError || validationError;

  const handleChange = (newValue: any) => {
    onChange(newValue);
  };

  const handleBlur = async () => {
    await validate(value);
    onBlur?.();
  };

  const commonProps = {
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    error: displayError,
    disabled,
    required,
    fieldDefinition,
  };

  // Render appropriate component based on datatype
  switch (fieldDefinition.datatype) {
    case 'text':
    case 'text_area':
    case 'email':
    case 'url':
      return <TextRenderer {...commonProps} />;

    case 'date':
    case 'time':
    case 'datetime':
      return <DateRenderer {...commonProps} />;

    case 'single_select':
      return <SelectRenderer {...commonProps} />;

    case 'multi_select':
      return <MultiSelectRenderer {...commonProps} />;

    case 'number':
      return <NumberRenderer {...commonProps} />;

    case 'boolean':
      return <BooleanRenderer {...commonProps} />;

    default:
      return <TextRenderer {...commonProps} />;
  }
}
