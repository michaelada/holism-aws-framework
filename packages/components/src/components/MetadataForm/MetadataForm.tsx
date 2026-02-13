import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import type { ObjectDefinition, FieldDefinition, FieldGroup } from '../../types';
import { useMetadata, useObjectInstances } from '../../hooks';
import { FieldRenderer } from '../FieldRenderer';
import { defaultValidationService } from '../../validation';

export interface MetadataFormProps {
  objectType: string;
  instanceId?: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  initialValues?: Record<string, any>;
}

/**
 * MetadataForm component that renders a form based on Object Definition
 * - Renders all fields using FieldRenderer
 * - Marks mandatory fields visually
 * - Implements form submission with validation
 * - Handles create and edit modes
 * - Supports field grouping for organized UI
 * 
 * @example
 * ```tsx
 * <MetadataForm
 *   objectType="customer"
 *   onSubmit={async (data) => {
 *     await createInstance(data);
 *   }}
 *   onCancel={() => navigate('/customers')}
 * />
 * ```
 */
export function MetadataForm({
  objectType,
  instanceId,
  onSubmit,
  onCancel,
  initialValues = {},
}: MetadataFormProps): JSX.Element {
  const { objectDef, fields, loading: metadataLoading, error: metadataError } = useMetadata(objectType);
  const { getInstance } = useObjectInstances(objectType);
  
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingInstance, setLoadingInstance] = useState(false);

  // Load existing instance for edit mode
  useEffect(() => {
    if (instanceId) {
      setLoadingInstance(true);
      getInstance(instanceId)
        .then((instance) => {
          setFormData(instance);
        })
        .catch((err) => {
          console.error('Failed to load instance:', err);
        })
        .finally(() => {
          setLoadingInstance(false);
        });
    }
  }, [instanceId, getInstance]);

  // Set initial values if provided
  useEffect(() => {
    if (initialValues && Object.

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
    
    if (!objectDef || !fields) return;

    setSubmitting(true);
    setErrors({});

    try {
      // Validate form data
      const validationResult = await defaultValidationService.validateInstance(
        objectDef,
        fields,
        formData
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

      // Submit form
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
      setErrors({ _form: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // Organize fields by groups
  const organizeFields = (
    objectDef: ObjectDefinition,
    fields: FieldDefinition[]
  ): { grouped: Map<FieldGroup, FieldDefinition[]>; ungrouped: FieldDefinition[] } => {
    const grouped = new Map<FieldGroup, FieldDefinition[]>();
    const ungrouped: FieldDefinition[] = [];

    if (!objectDef.fieldGroups || objectDef.fieldGroups.length === 0) {
      // No groups, all fields are ungrouped
      return { grouped, ungrouped: fields };
    }

    // Sort groups by order
    const sortedGroups = [...objectDef.fieldGroups].sort((a, b) => a.order - b.order);

    // Track which fields are in groups
    const groupedFieldNames = new Set<string>();
    
    sortedGroups.forEach((group) => {
      const groupFields: FieldDefinition[] = [];
      group.fields.forEach((fieldShortName) => {
        const field = fields.find((f) => f.shortName === fieldShortName);
        if (field) {
          groupFields.push(field);
          groupedFieldNames.add(fieldShortName);
        }
      });
      grouped.set(group, groupFields);
    });

    // Find ungrouped fields
    fields.forEach((field) => {
      if (!groupedFieldNames.has(field.shortName)) {
        ungrouped.push(field);
      }
    });

    return { grouped, ungrouped };
  };

  const renderField = (field: FieldDefinition) => {
    if (!field) {
      return null;
    }
    
    const fieldRef = objectDef?.fields.find((f) => f.fieldShortName === field.shortName);
    const isMandatory = fieldRef?.mandatory ?? false;

    return (
      <Box key={field.shortName} sx={{ mb: 2 }}>
        <FieldRenderer
          fieldDefinition={field}
          value={formData?.[field.shortName]}
          onChange={(value) => handleFieldChange(field.shortName, value)}
          error={errors?.[field.shortName]}
          disabled={submitting}
          required={isMandatory}
        />
      </Box>
    );
  };

  const renderFieldGroup = (group: FieldGroup, groupFields: FieldDefinition[]) => {
    // Filter out null fields
    const validFields = groupFields.filter(f => f !== null);
    if (validFields.length === 0) return null;
    
    return (
      <Card key={group.name} sx={{ mb: 3 }} variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {group.name}
          </Typography>
          {group.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {group.description}
            </Typography>
          )}
          {validFields.map(renderField)}
        </CardContent>
      </Card>
    );
  };

  if (metadataLoading || loadingInstance) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (metadataError) {
    return (
      <Alert severity="error">
        Failed to load metadata: {metadataError.message}
      </Alert>
    );
  }

  if (!objectDef || !fields) {
    return (
      <Alert severity="error">
        Object definition not found
      </Alert>
    );
  }

  // Check if there are missing field definitions
  const missingFields = objectDef.fields
    .filter(ref => !fields.some(f => f.shortName === ref.fieldShortName))
    .map(ref => ref.fieldShortName);

  const { grouped, ungrouped } = organizeFields(objectDef, fields);

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Typography variant="h5" gutterBottom>
        {instanceId ? `Edit ${objectDef.displayName}` : `Create ${objectDef.displayName}`}
      </Typography>
      
      {objectDef.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {objectDef.description}
        </Typography>
      )}

      {errors._form && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors._form}
        </Alert>
      )}

      {missingFields.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some field definitions are missing: {missingFields.join(', ')}. 
          Please create these field definitions first.
        </Alert>
      )}

      {/* Render grouped fields */}
      {Array.from(grouped.entries()).map(([group, groupFields]) =>
        renderFieldGroup(group, groupFields)
      )}

      {/* Render ungrouped fields */}
      {ungrouped.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {grouped.size > 0 && (
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
          )}
          {ungrouped.map(renderField)}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : instanceId ? 'Update' : 'Create'}
        </Button>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
