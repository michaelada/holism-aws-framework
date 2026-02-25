/**
 * Form Builder Page
 * 
 * Allows creating and editing application forms using the same UI patterns
 * as object definitions. Reuses MetadataForm, MetadataWizard, and FieldRenderer.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation, usePageHelp } from '@aws-web-framework/orgadmin-shell';

interface ApplicationForm {
  id?: string;
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

interface AvailableField {
  id: string;
  name: string;
  label: string;
  datatype: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`form-builder-tabpanel-${index}`}
      aria-labelledby={`form-builder-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const FormBuilderPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Register page for contextual help
  usePageHelp(id ? 'edit' : 'create');
  
  // Form data
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedFields, setSelectedFields] = useState<ApplicationFormField[]>([]);
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [wizardConfig, setWizardConfig] = useState<WizardConfiguration | undefined>();
  
  // Available fields from backend
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  
  // Dialog states
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false);
  const [addGroupDialogOpen, setAddGroupDialogOpen] = useState(false);
  const [addWizardStepDialogOpen, setAddWizardStepDialogOpen] = useState(false);

  useEffect(() => {
    loadAvailableFields();
    if (id) {
      loadForm();
    }
  }, [id]);

  const loadAvailableFields = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/application-fields',
      });
      setAvailableFields(response || []);
    } catch (err) {
      console.error('Failed to load available fields:', err);
    }
  };

  const loadForm = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/application-forms/${id}/with-fields`,
      });
      const form = response;
      
      if (form) {
        setFormName(form.name);
        setFormDescription(form.description);
        
        // Convert backend field format to frontend format
        const fields: ApplicationFormField[] = (form.fields || []).map((f: any) => ({
          fieldId: f.id,
          fieldName: f.name,
          fieldLabel: f.label,
          fieldType: f.datatype,
          order: f.order,
          required: false, // Backend doesn't store this yet
          groupName: f.groupName,
          groupOrder: f.groupOrder,
          wizardStep: f.wizardStep,
          wizardStepTitle: f.wizardStepTitle,
        }));
        
        setSelectedFields(fields);
        setFieldGroups(form.fieldGroups || []);
        setWizardConfig(form.wizardConfig);
      }
    } catch (err) {
      setError(t('forms.builder.messages.failedToLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError(t('forms.builder.validation.formNameRequired'));
      return;
    }

    if (!organisation?.id) {
      setError(t('forms.builder.validation.organisationMissing'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const formData = {
        name: formName,
        description: formDescription,
        status: 'draft' as const,
        fieldGroups: fieldGroups,
        wizardConfig: wizardConfig,
      };

      let formId = id;

      // Step 1: Create or update the form
      if (id) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/application-forms/${id}`,
          data: formData,
        });
      } else {
        const createdForm = await execute({
          method: 'POST',
          url: '/api/orgadmin/application-forms',
          data: {
            ...formData,
            organisationId: organisation.id,
          },
        });
        formId = createdForm.id;
      }

      // Step 2: Save field associations
      // For now, we'll need to delete existing associations and recreate them
      // This is a simplified approach - a better approach would be to diff and update
      if (formId && selectedFields.length > 0) {
        for (const field of selectedFields) {
          await execute({
            method: 'POST',
            url: `/api/orgadmin/application-forms/${formId}/fields`,
            data: {
              fieldId: field.fieldId,
              order: field.order,
              groupName: field.groupName,
              groupOrder: field.groupOrder,
              wizardStep: field.wizardStep,
              wizardStepTitle: field.wizardStepTitle,
            },
          });
        }
      }

      navigate('/forms');
    } catch (err) {
      setError(t('forms.builder.messages.failedToSave'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = (fieldId: string, required: boolean) => {
    const field = availableFields.find(f => f.id === fieldId);
    if (!field) return;

    const newField: ApplicationFormField = {
      fieldId: field.id,
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.datatype,
      order: selectedFields.length + 1,
      required,
    };

    setSelectedFields([...selectedFields, newField]);
    setAddFieldDialogOpen(false);
  };

  const handleRemoveField = (fieldId: string) => {
    setSelectedFields(selectedFields.filter(f => f.fieldId !== fieldId));
  };

  const handleToggleRequired = (fieldId: string) => {
    setSelectedFields(
      selectedFields.map(f =>
        f.fieldId === fieldId ? { ...f, required: !f.required } : f
      )
    );
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...selectedFields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    // Update order numbers
    newFields.forEach((field, idx) => {
      field.order = idx + 1;
    });
    setSelectedFields(newFields);
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === selectedFields.length - 1) return;
    const newFields = [...selectedFields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    // Update order numbers
    newFields.forEach((field, idx) => {
      field.order = idx + 1;
    });
    setSelectedFields(newFields);
  };

  const handleAddGroup = (groupName: string, groupDescription: string, selectedFieldIds: string[]) => {
    const newGroup: FieldGroup = {
      name: groupName,
      description: groupDescription,
      fields: selectedFieldIds,
      order: fieldGroups.length + 1,
    };
    setFieldGroups([...fieldGroups, newGroup]);
    
    // Automatically create a corresponding wizard step
    const newStep: WizardStep = {
      name: groupName,
      description: groupDescription,
      fields: selectedFieldIds,
      order: (wizardConfig?.steps.length || 0) + 1,
    };
    
    setWizardConfig({
      steps: [...(wizardConfig?.steps || []), newStep],
    });
    
    setAddGroupDialogOpen(false);
  };

  const handleRemoveGroup = (groupName: string) => {
    setFieldGroups(fieldGroups.filter(g => g.name !== groupName));
    
    // Also remove the corresponding wizard step
    if (wizardConfig) {
      setWizardConfig({
        steps: wizardConfig.steps.filter(s => s.name !== groupName),
      });
    }
  };

  // Placeholder for future implementation
  // const handleAddFieldToGroup = (_groupName: string, _fieldName: string) => {
  //   setFieldGroups(
  //     fieldGroups.map(g =>
  //       g.name === groupName
  //         ? { ...g, fields: [...g.fields, fieldName] }
  //         : g
  //     )
  //   );
  // };

  const handleAddWizardStep = (stepName: string, stepDescription: string, selectedFieldIds: string[]) => {
    const newStep: WizardStep = {
      name: stepName,
      description: stepDescription,
      fields: selectedFieldIds,
      order: (wizardConfig?.steps.length || 0) + 1,
    };
    
    setWizardConfig({
      steps: [...(wizardConfig?.steps || []), newStep],
    });
    setAddWizardStepDialogOpen(false);
  };

  const handleRemoveWizardStep = (stepName: string) => {
    if (!wizardConfig) return;
    
    setWizardConfig({
      steps: wizardConfig.steps.filter(s => s.name !== stepName),
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {id ? t('forms.builder.editForm') : t('forms.builder.createForm')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/forms')}
            disabled={saving}
          >
            {t('forms.builder.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('forms.builder.saving') : t('forms.builder.save')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('forms.builder.formDetails')}
          </Typography>
          <TextField
            fullWidth
            label={t('forms.builder.formName')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label={t('forms.builder.description')}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            multiline
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label={t('forms.builder.tabs.fields')} />
          <Tab label={t('forms.builder.tabs.fieldGroups')} />
          <Tab label={t('forms.builder.tabs.wizardSteps')} />
        </Tabs>

        <CardContent>
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{t('forms.builder.fields.title')}</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddFieldDialogOpen(true)}
              >
                {t('forms.builder.fields.addField')}
              </Button>
            </Box>

            {selectedFields.length === 0 ? (
              <Alert severity="info">
                {t('forms.builder.fields.noFields')}
              </Alert>
            ) : (
              <List>
                {selectedFields.map((field, index) => (
                  <ListItem key={field.fieldId}>
                    <IconButton size="small" sx={{ mr: 1 }} disabled>
                      <DragIcon />
                    </IconButton>
                    <ListItemText
                      primary={field.fieldLabel}
                      secondary={`${field.fieldType} • ${field.required ? t('forms.builder.fields.required') : t('forms.builder.fields.optional')}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => handleMoveFieldUp(index)}
                        disabled={index === 0}
                        title={t('forms.builder.fields.moveUp')}
                      >
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleMoveFieldDown(index)}
                        disabled={index === selectedFields.length - 1}
                        title={t('forms.builder.fields.moveDown')}
                      >
                        <ArrowDownIcon />
                      </IconButton>
                      <Button
                        size="small"
                        onClick={() => handleToggleRequired(field.fieldId)}
                        sx={{ ml: 1 }}
                      >
                        {field.required ? t('forms.builder.fields.makeOptional') : t('forms.builder.fields.makeRequired')}
                      </Button>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveField(field.fieldId)}
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{t('forms.builder.groups.title')}</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddGroupDialogOpen(true)}
              >
                {t('forms.builder.groups.addGroup')}
              </Button>
            </Box>

            {fieldGroups.length === 0 ? (
              <Alert severity="info">
                {t('forms.builder.groups.noGroups')}
              </Alert>
            ) : (
              <List>
                {fieldGroups.map((group) => {
                  const groupFieldLabels = group.fields
                    .map(fieldId => selectedFields.find(f => f.fieldId === fieldId)?.fieldLabel)
                    .filter(Boolean);
                  
                  return (
                    <ListItem key={group.name}>
                      <ListItemText
                        primary={group.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {group.description}
                            </Typography>
                            {groupFieldLabels.length > 0 && (
                              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {groupFieldLabels.map((label, idx) => (
                                  <Chip key={idx} label={label} size="small" />
                                ))}
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveGroup(group.name)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{t('forms.builder.wizard.title')}</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddWizardStepDialogOpen(true)}
              >
                {t('forms.builder.wizard.addStep')}
              </Button>
            </Box>

            {!wizardConfig || wizardConfig.steps.length === 0 ? (
              <Alert severity="info">
                {t('forms.builder.wizard.noSteps')}
              </Alert>
            ) : (
              <List>
                {wizardConfig.steps.map((step) => {
                  const stepFieldLabels = step.fields
                    .map(fieldId => selectedFields.find(f => f.fieldId === fieldId)?.fieldLabel)
                    .filter(Boolean);
                  
                  return (
                    <ListItem key={step.name}>
                      <ListItemText
                        primary={t('forms.builder.wizard.stepNumber', { number: step.order, name: step.name })}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {step.description}
                            </Typography>
                            {stepFieldLabels.length > 0 && (
                              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {stepFieldLabels.map((label, idx) => (
                                  <Chip key={idx} label={label} size="small" />
                                ))}
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveWizardStep(step.name)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <AddFieldDialog
        open={addFieldDialogOpen}
        onClose={() => setAddFieldDialogOpen(false)}
        onAdd={handleAddField}
        availableFields={availableFields}
        selectedFields={selectedFields}
      />

      {/* Add Group Dialog */}
      <AddGroupDialog
        open={addGroupDialogOpen}
        onClose={() => setAddGroupDialogOpen(false)}
        onAdd={handleAddGroup}
        availableFields={selectedFields.filter(field => 
          !fieldGroups.some(group => group.fields.includes(field.fieldId))
        )}
      />

      {/* Add Wizard Step Dialog */}
      <AddWizardStepDialog
        open={addWizardStepDialogOpen}
        onClose={() => setAddWizardStepDialogOpen(false)}
        onAdd={handleAddWizardStep}
        availableFields={selectedFields.filter(field => 
          !wizardConfig?.steps.some(step => step.fields.includes(field.fieldId))
        )}
      />
    </Box>
  );
};

// Helper dialog components
const AddFieldDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (fieldId: string, required: boolean) => void;
  availableFields: AvailableField[];
  selectedFields: ApplicationFormField[];
}> = ({ open, onClose, onAdd, availableFields, selectedFields }) => {
  const { t } = useTranslation();
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [required, setRequired] = useState(false);

  const handleAdd = () => {
    if (selectedFieldId) {
      onAdd(selectedFieldId, required);
      setSelectedFieldId('');
      setRequired(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('forms.builder.fields.addFieldDialog')}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
          <InputLabel>{t('forms.builder.fields.selectField')}</InputLabel>
          <Select
            label={t('forms.builder.fields.selectField')}
            value={selectedFieldId}
            onChange={(e) => setSelectedFieldId(e.target.value as string)}
          >
            {availableFields
              .filter(f => !selectedFields.some(sf => sf.fieldId === f.id))
              .map((field) => (
                <MenuItem key={field.id} value={field.id}>
                  {field.label} ({field.datatype})
                </MenuItem>
              ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
          }
          label={t('forms.builder.fields.mandatoryField')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('forms.builder.cancel')}</Button>
        <Button onClick={handleAdd} variant="contained" disabled={!selectedFieldId}>
          {t('common.actions.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AddGroupDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string, selectedFieldIds: string[]) => void;
  availableFields: ApplicationFormField[];
}> = ({ open, onClose, onAdd, availableFields }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name, description, selectedFieldIds);
      setName('');
      setDescription('');
      setSelectedFieldIds([]);
    }
  };

  const handleToggleField = (fieldId: string) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...selectedFieldIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    setSelectedFieldIds(newIds);
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === selectedFieldIds.length - 1) return;
    const newIds = [...selectedFieldIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    setSelectedFieldIds(newIds);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('forms.builder.groups.addGroupDialog')}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label={t('forms.builder.groups.groupName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <TextField
          fullWidth
          label={t('forms.builder.groups.groupDescription')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
          sx={{ mb: 2 }}
        />
        <Typography variant="subtitle2" gutterBottom>
          {t('forms.builder.groups.selectFields')}
        </Typography>
        {availableFields.length === 0 ? (
          <Alert severity="info">
            {t('forms.builder.groups.noFieldsAvailable')}
          </Alert>
        ) : (
          <Box>
            <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              {availableFields.map((field) => (
                <FormControlLabel
                  key={field.fieldId}
                  control={
                    <Checkbox
                      checked={selectedFieldIds.includes(field.fieldId)}
                      onChange={() => handleToggleField(field.fieldId)}
                    />
                  }
                  label={field.fieldLabel}
                />
              ))}
            </Box>
            {selectedFieldIds.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('forms.builder.groups.fieldOrder')}
                </Typography>
                <List dense>
                  {selectedFieldIds.map((fieldId, index) => {
                    const field = availableFields.find(f => f.fieldId === fieldId);
                    return (
                      <ListItem key={fieldId}>
                        <ListItemText primary={field?.fieldLabel} />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveFieldUp(index)}
                            disabled={index === 0}
                            title={t('forms.builder.fields.moveUp')}
                          >
                            <ArrowUpIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveFieldDown(index)}
                            disabled={index === selectedFieldIds.length - 1}
                            title={t('forms.builder.fields.moveDown')}
                          >
                            <ArrowDownIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('forms.builder.cancel')}</Button>
        <Button onClick={handleAdd} variant="contained" disabled={!name.trim()}>
          {t('common.actions.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AddWizardStepDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string, selectedFieldIds: string[]) => void;
  availableFields: ApplicationFormField[];
}> = ({ open, onClose, onAdd, availableFields }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name, description, selectedFieldIds);
      setName('');
      setDescription('');
      setSelectedFieldIds([]);
    }
  };

  const handleToggleField = (fieldId: string) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...selectedFieldIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    setSelectedFieldIds(newIds);
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === selectedFieldIds.length - 1) return;
    const newIds = [...selectedFieldIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    setSelectedFieldIds(newIds);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('forms.builder.wizard.addStepDialog')}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label={t('forms.builder.wizard.stepName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <TextField
          fullWidth
          label={t('forms.builder.wizard.stepDescription')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
          sx={{ mb: 2 }}
        />
        <Typography variant="subtitle2" gutterBottom>
          {t('forms.builder.wizard.selectFields')}
        </Typography>
        {availableFields.length === 0 ? (
          <Alert severity="info">
            {t('forms.builder.groups.noFieldsAvailable')}
          </Alert>
        ) : (
          <Box>
            <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              {availableFields.map((field) => (
                <FormControlLabel
                  key={field.fieldId}
                  control={
                    <Checkbox
                      checked={selectedFieldIds.includes(field.fieldId)}
                      onChange={() => handleToggleField(field.fieldId)}
                    />
                  }
                  label={field.fieldLabel}
                />
              ))}
            </Box>
            {selectedFieldIds.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('forms.builder.wizard.fieldOrder')}
                </Typography>
                <List dense>
                  {selectedFieldIds.map((fieldId, index) => {
                    const field = availableFields.find(f => f.fieldId === fieldId);
                    return (
                      <ListItem key={fieldId}>
                        <ListItemText primary={field?.fieldLabel} />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveFieldUp(index)}
                            disabled={index === 0}
                            title={t('forms.builder.fields.moveUp')}
                          >
                            <ArrowUpIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveFieldDown(index)}
                            disabled={index === selectedFieldIds.length - 1}
                            title={t('forms.builder.fields.moveDown')}
                          >
                            <ArrowDownIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('forms.builder.cancel')}</Button>
        <Button onClick={handleAdd} variant="contained" disabled={!name.trim()}>
          {t('common.actions.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FormBuilderPage;
