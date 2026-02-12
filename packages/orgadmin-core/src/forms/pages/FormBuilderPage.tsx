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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';

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
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
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
        url: `/api/orgadmin/application-forms/${id}`,
      });
      const form = response;
      
      if (form) {
        setFormName(form.name);
        setFormDescription(form.description);
        setSelectedFields(form.fields || []);
        setFieldGroups(form.fieldGroups || []);
        setWizardConfig(form.wizardConfig);
      }
    } catch (err) {
      setError('Failed to load form');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!formName.trim()) {
      setError('Form name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const formData: ApplicationForm = {
        name: formName,
        description: formDescription,
        status,
        fields: selectedFields,
        fieldGroups: fieldGroups.length > 0 ? fieldGroups : undefined,
        wizardConfig,
      };

      if (id) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/application-forms/${id}`,
          data: formData,
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/application-forms',
          data: formData,
        });
      }

      navigate('/orgadmin/forms');
    } catch (err) {
      setError('Failed to save form');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = (fieldId: string) => {
    const field = availableFields.find(f => f.id === fieldId);
    if (!field) return;

    const newField: ApplicationFormField = {
      fieldId: field.id,
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.datatype,
      order: selectedFields.length + 1,
      required: false,
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

  const handleAddGroup = (groupName: string, groupDescription: string) => {
    const newGroup: FieldGroup = {
      name: groupName,
      description: groupDescription,
      fields: [],
      order: fieldGroups.length + 1,
    };
    setFieldGroups([...fieldGroups, newGroup]);
    setAddGroupDialogOpen(false);
  };

  const handleRemoveGroup = (groupName: string) => {
    setFieldGroups(fieldGroups.filter(g => g.name !== groupName));
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

  const handleAddWizardStep = (stepName: string, stepDescription: string) => {
    const newStep: WizardStep = {
      name: stepName,
      description: stepDescription,
      fields: [],
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
          {id ? 'Edit Form' : 'Create Form'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/orgadmin/forms')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleSave('draft')}
            disabled={saving}
          >
            Save as Draft
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSave('published')}
            disabled={saving}
          >
            {saving ? 'Publishing...' : 'Publish'}
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
            Form Details
          </Typography>
          <TextField
            fullWidth
            label="Form Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            multiline
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Fields" />
          <Tab label="Field Groups" />
          <Tab label="Wizard Steps" />
        </Tabs>

        <CardContent>
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Form Fields</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddFieldDialogOpen(true)}
              >
                Add Field
              </Button>
            </Box>

            {selectedFields.length === 0 ? (
              <Alert severity="info">
                No fields added yet. Click "Add Field" to get started.
              </Alert>
            ) : (
              <List>
                {selectedFields.map((field) => (
                  <ListItem key={field.fieldId}>
                    <IconButton size="small" sx={{ mr: 1 }}>
                      <DragIcon />
                    </IconButton>
                    <ListItemText
                      primary={field.fieldLabel}
                      secondary={`${field.fieldType} • ${field.required ? 'Required' : 'Optional'}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => handleToggleRequired(field.fieldId)}
                      >
                        {field.required ? 'Make Optional' : 'Make Required'}
                      </Button>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveField(field.fieldId)}
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
              <Typography variant="h6">Field Groups</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddGroupDialogOpen(true)}
              >
                Add Group
              </Button>
            </Box>

            {fieldGroups.length === 0 ? (
              <Alert severity="info">
                No field groups defined. Groups help organize fields into sections.
              </Alert>
            ) : (
              <List>
                {fieldGroups.map((group) => (
                  <ListItem key={group.name}>
                    <ListItemText
                      primary={group.name}
                      secondary={`${group.description} • ${group.fields.length} fields`}
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
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Wizard Steps</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddWizardStepDialogOpen(true)}
              >
                Add Step
              </Button>
            </Box>

            {!wizardConfig || wizardConfig.steps.length === 0 ? (
              <Alert severity="info">
                No wizard steps defined. Wizard steps create a multi-step form experience.
              </Alert>
            ) : (
              <List>
                {wizardConfig.steps.map((step) => (
                  <ListItem key={step.name}>
                    <ListItemText
                      primary={`Step ${step.order}: ${step.name}`}
                      secondary={`${step.description} • ${step.fields.length} fields`}
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
                ))}
              </List>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <Dialog open={addFieldDialogOpen} onClose={() => setAddFieldDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Field</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Field</InputLabel>
            <Select
              label="Select Field"
              onChange={(e) => handleAddField(e.target.value as string)}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFieldDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Add Group Dialog */}
      <AddGroupDialog
        open={addGroupDialogOpen}
        onClose={() => setAddGroupDialogOpen(false)}
        onAdd={handleAddGroup}
      />

      {/* Add Wizard Step Dialog */}
      <AddWizardStepDialog
        open={addWizardStepDialogOpen}
        onClose={() => setAddWizardStepDialogOpen(false)}
        onAdd={handleAddWizardStep}
      />
    </Box>
  );
};

// Helper dialog components
const AddGroupDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string) => void;
}> = ({ open, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name, description);
      setName('');
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Field Group</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} variant="contained">Add</Button>
      </DialogActions>
    </Dialog>
  );
};

const AddWizardStepDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string) => void;
}> = ({ open, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name, description);
      setName('');
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Wizard Step</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Step Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} variant="contained">Add</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FormBuilderPage;
