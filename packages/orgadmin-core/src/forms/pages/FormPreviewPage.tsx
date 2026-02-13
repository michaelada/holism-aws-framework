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
  TextField,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { ArrowBack as BackIcon, ViewList as ViewListIcon, ViewModule as ViewModuleIcon } from '@mui/icons-material';
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
  id: string;
  name: string;
  label: string;
  datatype: string;
  order: number;
  groupName?: string;
  groupOrder?: number;
  wizardStep?: number;
  wizardStepTitle?: string;
  options?: any;
  validation?: any;
  description?: string;
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
  const [previewMode, setPreviewMode] = useState<'grouped' | 'wizard'>('grouped');
  const [currentWizardStep, setCurrentWizardStep] = useState(0);

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
        url: `/api/orgadmin/application-forms/${id}/with-fields`,
      });
      console.log('Form data received:', response);
      console.log('Fields:', response.fields);
      setForm(response);
    } catch (err) {
      setError('Failed to load form');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: ApplicationFormField) => {
    // Render actual form controls based on field type
    const renderControl = () => {
      switch (field.datatype) {
        case 'text':
          return (
            <TextField
              fullWidth
              label={field.label}
              helperText={field.description}
              disabled
              placeholder="Text input"
            />
          );
        
        case 'text_area':
          return (
            <TextField
              fullWidth
              label={field.label}
              helperText={field.description}
              multiline
              rows={4}
              disabled
              placeholder="Multi-line text input"
            />
          );
        
        case 'number':
          return (
            <TextField
              fullWidth
              label={field.label}
              helperText={field.description}
              type="number"
              disabled
              placeholder="Number input"
            />
          );
        
        case 'date':
          return (
            <TextField
              fullWidth
              label={field.label}
              helperText={field.description}
              type="date"
              disabled
              InputLabelProps={{ shrink: true }}
            />
          );
        
        case 'single_select':
          return (
            <FormControl fullWidth disabled>
              <InputLabel>{field.label}</InputLabel>
              <Select label={field.label} value="">
                {field.options && Array.isArray(field.options) ? (
                  field.options.map((option: string, idx: number) => (
                    <MenuItem key={idx} value={option}>
                      {option}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value="">No options available</MenuItem>
                )}
              </Select>
              {field.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  {field.description}
                </Typography>
              )}
            </FormControl>
          );
        
        case 'multi_select':
          return (
            <FormControl fullWidth disabled>
              <InputLabel>{field.label}</InputLabel>
              <Select label={field.label} multiple value={[]}>
                {field.options && Array.isArray(field.options) ? (
                  field.options.map((option: string, idx: number) => (
                    <MenuItem key={idx} value={option}>
                      {option}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value="">No options available</MenuItem>
                )}
              </Select>
              {field.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  {field.description}
                </Typography>
              )}
            </FormControl>
          );
        
        case 'boolean':
          return (
            <Box>
              <FormControlLabel
                control={<Checkbox disabled />}
                label={field.label}
              />
              {field.description && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                  {field.description}
                </Typography>
              )}
            </Box>
          );
        
        case 'document_upload':
          return (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {field.label}
              </Typography>
              {field.description && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {field.description}
                </Typography>
              )}
              <Button variant="outlined" disabled component="span">
                Choose File
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                No file selected
              </Typography>
            </Box>
          );
        
        default:
          return (
            <TextField
              fullWidth
              label={field.label}
              helperText={field.description}
              disabled
              placeholder="Text input"
            />
          );
      }
    };
    
    return (
      <Box key={field.id} sx={{ mb: 3 }}>
        {renderControl()}
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
  const sortedFields = form.fields && form.fields.length > 0 
    ? [...form.fields].sort((a, b) => a.order - b.order)
    : [];
  
  console.log('Sorted fields:', sortedFields);
  
  // Check if form uses groups or wizard
  const hasGroups = form.fieldGroups && form.fieldGroups.length > 0;
  const hasWizard = form.wizardConfig && form.wizardConfig.steps.length > 0;

  // Wizard navigation handlers
  const handleNextStep = () => {
    if (form?.wizardConfig && currentWizardStep < form.wizardConfig.steps.length - 1) {
      setCurrentWizardStep(currentWizardStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentWizardStep > 0) {
      setCurrentWizardStep(currentWizardStep - 1);
    }
  };

  const isFirstStep = currentWizardStep === 0;
  const isLastStep = form?.wizardConfig ? currentWizardStep === form.wizardConfig.steps.length - 1 : false;

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
            onClick={() => navigate(`/forms/${id}/edit`)}
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

      {/* Preview mode toggle - only show if wizard steps exist */}
      {hasWizard && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
          <ToggleButtonGroup
            value={previewMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode !== null) {
                setPreviewMode(newMode);
                setCurrentWizardStep(0); // Reset to first step when switching modes
              }
            }}
            aria-label="preview mode"
          >
            <ToggleButton value="grouped" aria-label="grouped view">
              <ViewListIcon sx={{ mr: 1 }} />
              Grouped View
            </ToggleButton>
            <ToggleButton value="wizard" aria-label="wizard view">
              <ViewModuleIcon sx={{ mr: 1 }} />
              Step-by-Step Wizard
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* Render based on preview mode */}
      {previewMode === 'wizard' && hasWizard ? (
        // Wizard step-by-step view
        <Box>
          {/* Stepper showing all steps */}
          <Stepper activeStep={currentWizardStep} sx={{ mb: 4 }}>
            {form.wizardConfig!.steps
              .sort((a, b) => a.order - b.order)
              .map((step, index) => (
                <Step key={index}>
                  <StepLabel>{step.name}</StepLabel>
                </Step>
              ))}
          </Stepper>

          {/* Current step content */}
          {(() => {
            const sortedSteps = [...form.wizardConfig!.steps].sort((a, b) => a.order - b.order);
            const currentStep = sortedSteps[currentWizardStep];
            const stepFields = sortedFields.filter((f) =>
              currentStep.fields.includes(f.name)
            );

            return (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {currentStep.name}
                  </Typography>
                  
                  {currentStep.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {currentStep.description}
                    </Typography>
                  )}

                  <Divider sx={{ mb: 3 }} />

                  {stepFields.map(renderField)}

                  {/* Wizard navigation buttons */}
                  <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
                    <Button
                      variant="outlined"
                      onClick={handlePreviousStep}
                      disabled={isFirstStep}
                    >
                      {isFirstStep ? 'Cancel (Preview Only)' : 'Back'}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleNextStep}
                      disabled={isLastStep}
                    >
                      {isLastStep ? 'Submit (Preview Only)' : 'Next'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            );
          })()}
        </Box>
      ) : hasGroups ? (
        // Grouped view
        <Box>
          {form.fieldGroups!
            .sort((a, b) => a.order - b.order)
            .map((group) => {
              const groupFields = sortedFields.filter((f) =>
                group.fields.includes(f.name)
              );
              return renderFieldGroup(group, groupFields);
            })}
          
          {/* Render ungrouped fields */}
          {(() => {
            const groupedFieldNames = new Set(
              form.fieldGroups!.flatMap((g) => g.fields)
            );
            const ungroupedFields = sortedFields.filter(
              (f) => !groupedFieldNames.has(f.name)
            );
            
            if (ungroupedFields.length > 0) {
              return (
                <Card sx={{ mb: 3 }} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Additional Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {ungroupedFields.map(renderField)}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {/* Submit buttons for grouped view */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="contained" disabled>
              Submit (Preview Only)
            </Button>
            <Button variant="outlined" disabled>
              Cancel (Preview Only)
            </Button>
          </Box>
        </Box>
      ) : (
        // Simple list view (no groups)
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Form Fields
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {sortedFields.map(renderField)}
            </CardContent>
          </Card>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="contained" disabled>
              Submit (Preview Only)
            </Button>
            <Button variant="outlined" disabled>
              Cancel (Preview Only)
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default FormPreviewPage;
