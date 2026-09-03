import { useEffect, useRef } from 'react';
import type { FieldDefinition } from '../../types';
import { useFieldValidation } from '../../hooks';
import { defaultValidationService } from '../../validation';
import { TextRenderer } from './renderers/TextRenderer';
import { DateRenderer } from './renderers/DateRenderer';
import { SelectRenderer } from './renderers/SelectRenderer';
import { MultiSelectRenderer } from './renderers/MultiSelectRenderer';
import { NumberRenderer } from './renderers/NumberRenderer';
import { BooleanRenderer } from './renderers/BooleanRenderer';
import { DocumentUploadRenderer } from './renderers/DocumentUploadRenderer';

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
  const { error: validationError, validate, clearError } = useFieldValidation(fieldDefinition);

  // Use external error if provided, otherwise use validation error
  const displayError = externalError || validationError;

  /*
   * The value as it is *now*, for the blur handler.
   *
   * A date picker closes its popover by blurring the input, and the blur runs
   * before the chosen date has come back down as a prop — so `validate(value)`
   * was validating the value the field held **before** the member picked, and
   * reported the empty field they had just filled in.
   */
  const latest = useRef(value);
  latest.current = value;

  const handleChange = (newValue: any) => {
    onChange(newValue);
  };

  const handleBlur = async () => {
    await validate(latest.current);
    onBlur?.();
  };

  /*
   * An error that has been corrected goes away on its own.
   *
   * Without this it survives until the next blur, so a field showing "Must be a
   * valid date" stayed red under a date that is perfectly valid — and on a
   * picker there may be no second blur to clear it. Only ever *clears*: an
   * error is still raised on blur, so a half-typed answer is not marked wrong
   * while it is being typed.
   */
  useEffect(() => {
    if (!validationError) return;

    let cancelled = false;
    void (async () => {
      const { valid } = defaultValidationService.validateFieldSync(fieldDefinition, value);
      if (valid && !cancelled) clearError();
    })();

    return () => {
      cancelled = true;
    };
  }, [value, validationError, fieldDefinition, clearError]);

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
    case 'phone':
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

    case 'document_upload':
      return <DocumentUploadRenderer {...commonProps} />;

    default:
      return <TextRenderer {...commonProps} />;
  }
}
