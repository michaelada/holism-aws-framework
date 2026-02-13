/**
 * Form Preview Page
 * 
 * Shows how the application form will appear to end users
 * Uses existing FieldRenderer component to display fields
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Paper,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';

interface ApplicationForm {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  fields: ApplicationFormField[];
  fieldGroups?: FieldGroup[];
  wizardConfig?: WizardConfiguration;
}

interface ApplicationFormField {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  order: number;
  required: boolean;
  groupName?: string;
  groupOrder?: number;
  wizardStep?: number;
  wizardStepTitle?: string;
  options?: string[];
  validation?: any;
}

interface FieldGroup {
  name: string;
  description: string;
  fields: string[];
  order: number;
}

interface WizardStep {
  name: string;
  description: string;
  fields: string[];
  order: number;
}

interface WizardConfiguration {
  steps: WizardStep[];
}

const FormPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ApplicationForm | null>(null);

  useEffect(() => {
    if (id) {
      loadForm();
    }
  }, [id]);

  const loadForm = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/application-forms/${id}`,
      });
      setForm(response);
    } catch (err) {
      setError('Failed to load form');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: ApplicationFormField) => {
    // Simple field renderer for preview
    // In a real implementation, this would use the actual FieldRenderer component
    
    return (
      <Box key={field.fieldId} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {field.fieldLabel}
          {field.required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Type: {field.fieldType}
        </Typography>
        
        {/* Simplified field display for preview */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            backgroundColor: '#f5f5f5',
            minHeight: field.fieldType === 'text_area' ? 100 : 40,
          }}
        >
          {field.fieldType === 'document_upload' ? (
            <Typography variant="body2" color="text.secondary">
              [File upload field - users can upload documents here]
            </Typography>
          ) : field.fieldType === 'single_select' || field.fieldType === 'multi_select' ? (
            <Typography variant="body2" color="text.secondary">
              [Dropdown/Select field{field.options ? ` with ${field.options.length} options` : ''}]
            </Typography>
          ) : field.fieldType === 'boolean' ? (
            <Typography variant="body2" color="text.secondary">
              [Checkbox field]
            </Typography>
          ) : field.fieldType === 'date' ? (
            <Typography variant="body2" color="text.secondary">
              [Date picker field]
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              [Text input field]
            </Typography>
          )}
        </Paper>
      </Box>
    );
  };

  const renderFieldGroup = (group: FieldGroup, groupFields: ApplicationFormField[]) => {
    if (groupFields.length === 0) return null;
    
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
          <Divider sx={{ mb: 2 }} />
          {groupFields.map(renderField)}
        </CardContent>
      </Card>
    );
  };

  const renderWizardStep = (step: WizardStep, stepFields: ApplicationFormField[]) => {
    if (stepFields.length === 0) return null;
    
    return (
      <Card key={step.name} sx={{ mb: 3 }} variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Step {step.order}: {step.name}
          </Typography>
          {step.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {step.description}
            </Typography>
          )}
          <Divider sx={{ mb: 2 }} />
          {stepFields.map(renderField)}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !form) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Form not found'}</Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/forms')}
          sx={{ mt: 2 }}
        >
          Back to Forms
        </Button>
      </Box>
    );
  }

  // Organize fields
  const sortedFields = [...form.fields].sort((a, b) => a.order - b.order);
  
  // Check if form uses groups or wizard
  const hasGroups = form.fieldGroups && form.fieldGroups.length > 0;
  const hasWizard = form.wizardConfig && form.wizardConfig.steps.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Form Preview</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/forms')}
          >
            Back to Forms
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate(`/orgadmin/forms/${id}/edit`)}
          >
            Edit Form
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        This is a preview of how your form will appear to end users. The actual form will include
        interactive fields and validation.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {form.name}
          </Typography>
          {form.description && (
            <Typography variant="body1" color="text.secondary" paragraph>
              {form.description}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Status: {form.status === 'published' ? 'Published' : 'Draft'}
          </Typography>
        </CardContent>
      </Card>

      {hasWizard ? (
        // Render as wizard steps
        <Box>
          <Typography variant="h6" gutterBottom>
            Multi-Step Form (Wizard)
          </Typography>
          {form.wizardConfig!.steps
            .sort((a, b) => a.order - b.order)
            .map((step) => {
              const stepFields = sortedFields.filter((f) =>
                step.fields.includes(f.fieldName)
              );
              return renderWizardStep(step, stepFields);
            })}
        </Box>
      ) : hasGroups ? (
        // Render with field groups
        <Box>
          {form.fieldGroups!
            .sort((a, b) => a.order - b.order)
            .map((group) => {
              const groupFields = sortedFields.filter((f) =>
                group.fields.includes(f.fieldName)
              );
              return renderFieldGroup(group, groupFields);
            })}
          
          {/* Render ungrouped fields */}
          {(() => {
            const groupedFieldNames = new Set(
              form.fieldGroups!.flatMap((g) => g.fields)
            );
            const ungroupedFields = sortedFields.filter(
              (f) => !groupedFieldNames.has(f.fieldName)
            );
            
            if (ungroupedFields.length > 0) {
              return (
                <Card sx={{ mb: 3 }} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Additional Information
                    </Typography>
                    {ungroupedFields.map(renderField)}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}
        </Box>
      ) : (
        // Render as simple list
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Form Fields
            </Typography>
            {sortedFields.map(renderField)}
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button variant="contained" disabled>
          Submit (Preview Only)
        </Button>
        <Button variant="outlined" disabled>
          Cancel (Preview Only)
        </Button>
      </Box>
    </Box>
  );
};

export default FormPreviewPage;
