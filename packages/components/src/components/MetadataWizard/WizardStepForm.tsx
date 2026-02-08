import React, { useState } from 'react';
import { Box, Button, Alert } from '@mui/material';
import type { FieldDefinition, ObjectDefinition } from '../../types';
import { FieldRenderer } from '../FieldRenderer';
import { defaultValidationService } from '../../validation';

export interface WizardStepFormProps {
  fields: FieldDefinition[];
  objectDef: ObjectDefinition;
  initialValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

/**
 * WizardStepForm component that renders fields for a single wizard step
 * - Renders fields for current step
 * - Handles step-level validation
 * - Provides Next/Back/Complete buttons
 * 
 * @example
 * ```tsx
 * <WizardStepForm
 *   fields={currentStepFields}
 *   objectDef={objectDef}
 *   initialValues={stepData}
 *   onSubmit={handleStepSubmit}
 *   onCancel={handleBack}
 *   submitLabel="Next"
 *   cancelLabel="Back"
 * />
 * ```
 */
export function WizardStepForm({
  fields,
  objectDef,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Next',
  cancelLabel = 'Back',
}: WizardStepFormProps): JSX.Element {
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (fieldShortName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldShortName]: value,
    }));

    // Clear error for this field when user changes it
    if (errors[fieldShortName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldShortName];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setErrors({});

    try {
      // Validate only the fields in this step
      const stepFieldShortNames = fields.map((f) => f.shortName);
      const stepData: Record<string, any> = {};
      
      // Extract only step fields from form data
      stepFieldShortNames.forEach((shortName) => {
        if (formData[shortName] !== undefined) {
          stepData[shortName] = formData[shortName];
        }
      });

      // Validate step fields
      const validationResult = await defaultValidationService.validateInstance(
        objectDef,
        fields,
        stepData
      );

      if (!validationResult.valid) {
        // Convert validation errors to field error map
        const fieldErrors: Record<string, string> = {};
        validationResult.errors.forEach((err) => {
          fieldErrors[err.field] = err.message;
        });
        setErrors(fieldErrors);
        setSubmitting(false);
        return;
      }

      // Submit step data
      await onSubmit(stepData);
    } catch (err) {
      console.error('Step submission error:', err);
      setErrors({ _form: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {errors._form && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors._form}
        </Alert>
      )}

      {fields.map((field) => {
        const fieldRef = objectDef.fields.find((f) => f.fieldShortName === field.shortName);
        const isMandatory = fieldRef?.mandatory ?? false;

        return (
          <Box key={field.shortName} sx={{ mb: 2 }}>
            <FieldRenderer
              fieldDefinition={field}
              value={formData[field.shortName]}
              onChange={(value) => handleFieldChange(field.shortName, value)}
              error={errors[field.shortName]}
              disabled={submitting}
              required={isMandatory}
            />
          </Box>
        );
      })}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Processing...' : submitLabel}
        </Button>
        <Button variant="outlined" onClick={onCancel} disabled={submitting}>
          {cancelLabel}
        </Button>
      </Box>
    </Box>
  );
}
