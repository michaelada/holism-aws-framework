import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import type { ObjectDefinition, FieldDefinition, FieldGroup } from '../../types';
import { useMetadata } from '../../hooks';

export interface MetadataReadOnlyViewProps {
  objectType: string;
  data: Record<string, any>;
}

/**
 * MetadataReadOnlyView component that displays object data in read-only mode
 * - Renders all fields based on Object Definition
 * - Supports field grouping for organized display
 * - Uses appropriate visual styling for read-only groups
 * 
 * @example
 * ```tsx
 * <MetadataReadOnlyView
 *   objectType="customer"
 *   data={customerData}
 * />
 * ```
 */
export function MetadataReadOnlyView({
  objectType,
  data,
}: MetadataReadOnlyViewProps): JSX.Element {
  const { objectDef, fields, loading, error } = useMetadata(objectType);

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

  const renderFieldValue = (field: FieldDefinition, value: any) => {
    // Format value based on datatype
    if (value === null || value === undefined) {
      return <Typography color="text.secondary">—</Typography>;
    }

    switch (field.datatype) {
      case 'boolean':
        return <Typography>{value ? 'Yes' : 'No'}</Typography>;
      case 'date':
      case 'datetime':
      case 'time':
        return <Typography>{new Date(value).toLocaleString()}</Typography>;
      case 'multi_select':
        return <Typography>{Array.isArray(value) ? value.join(', ') : value}</Typography>;
      default:
        return <Typography>{String(value)}</Typography>;
    }
  };

  const renderField = (field: FieldDefinition) => {
    const value = data[field.shortName];

    return (
      <Box key={field.shortName} sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {field.displayName}
        </Typography>
        {renderFieldValue(field, value)}
      </Box>
    );
  };

  const renderFieldGroup = (group: FieldGroup, groupFields: FieldDefinition[]) => {
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
          {groupFields.map(renderField)}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load metadata: {error.message}
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

  const { grouped, ungrouped } = organizeFields(objectDef, fields);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {objectDef.displayName}
      </Typography>
      
      {objectDef.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {objectDef.description}
        </Typography>
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
    </Box>
  );
}
