import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  Chip,
  InputLabel,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMetadataApi } from '../context';
import { FieldDefinition } from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function CreateEditObjectPage() {
  const navigate = useNavigate();
  const { objectShortName } = useParams<{ objectShortName?: string }>();
  const metadataApi = useMetadataApi();
  const isEditMode = !!objectShortName;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    shortName: '',
    displayName: '',
    description: '',
    fields: [] as Array<{ fieldShortName: string; mandatory: boolean; order: number; inTable?: boolean }>,
    fieldGroups: [] as Array<{ name: string; description: string; fields: string[]; order: number }>,
    wizardConfig: undefined as { steps: Array<{ name: string; description: string; fields: string[] }> } | undefined,
  });

  useEffect(() => {
    loadData();
  }, [objectShortName]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fieldsData = await metadataApi.getFields();
      setFields(fieldsData);

      if (isEditMode && objectShortName) {
        const objects = await metadataApi.getObjects();
        const object = objects.find((o) => o.shortName === objectShortName);
        
        if (!object) {
          setError('Object not found');
          return;
        }

        setFormData({
          shortName: object.shortName,
          displayName: object.displayName,
          description: object.description || '',
          fields: object.fields || [],
          fieldGroups: object.fieldGroups || [],
          wizardConfig: object.wizardConfig,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      const objectData = {
        ...formData,
        displayProperties: {},
        fieldGroups: formData.fieldGroups.length > 0 ? formData.fieldGroups : undefined,
        wizardConfig: formData.wizardConfig && formData.wizardConfig.steps.length > 0 ? formData.wizardConfig : undefined,
      };
      
      if (isEditMode && objectShortName) {
        const objects = await metadataApi.getObjects();
        const existingObject = objects.find((o) => o.shortName === objectShortName);
        
        await metadataApi.updateObject(objectShortName, {
          ...objectData,
          displayProperties: existingObject?.displayProperties || {},
        });
      } else {
        await metadataApi.createObject(objectData);
      }
      
      navigate('/objects');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to save object definition');
      }
    }
  };

  const handleAddField = () => {
    const availableFields = fields.filter(
      (f) => !formData.fields.some((ff) => ff.fieldShortName === f.shortName)
    );
    if (availableFields.length === 0) {
      setError('No more fields available to add');
      return;
    }
    const newField = {
      fieldShortName: availableFields[0].shortName,
      mandatory: false,
      order: formData.fields.length + 1,
      inTable: true,
    };
    setFormData({
      ...formData,
      fields: [...formData.fields, newField],
    });
  };

  const handleRemoveField = (index: number) => {
    const newFields = formData.fields.filter((_, i) => i !== index);
    const reorderedFields = newFields.map((f, i) => ({ ...f, order: i + 1 }));
    setFormData({
      ...formData,
      fields: reorderedFields,
    });
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...formData.fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    const reorderedFields = newFields.map((f, i) => ({ ...f, order: i + 1 }));
    setFormData({
      ...formData,
      fields: reorderedFields,
    });
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === formData.fields.length - 1) return;
    const newFields = [...formData.fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    const reorderedFields = newFields.map((f, i) => ({ ...f, order: i + 1 }));
    setFormData({
      ...formData,
      fields: reorderedFields,
    });
  };

  const handleUpdateField = (index: number, updates: Partial<typeof formData.fields[0]>) => {
    const newFields = [...formData.fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFormData({
      ...formData,
      fields: newFields,
    });
  };

  // Field Group handlers
  const handleAddFieldGroup = () => {
    const newGroup = {
      name: '',
      description: '',
      fields: [],
      order: formData.fieldGroups.length + 1,
    };
    setFormData({
      ...formData,
      fieldGroups: [...formData.fieldGroups, newGroup],
    });
  };

  const handleRemoveFieldGroup = (index: number) => {
    const newGroups = formData.fieldGroups.filter((_, i) => i !== index);
    const reorderedGroups = newGroups.map((g, i) => ({ ...g, order: i + 1 }));
    setFormData({
      ...formData,
      fieldGroups: reorderedGroups,
    });
  };

  const handleUpdateFieldGroup = (index: number, updates: Partial<typeof formData.fieldGroups[0]>) => {
    const newGroups = [...formData.fieldGroups];
    newGroups[index] = { ...newGroups[index], ...updates };
    setFormData({
      ...formData,
      fieldGroups: newGroups,
    });
  };

  const handleMoveFieldGroupUp = (index: number) => {
    if (index === 0) return;
    const newGroups = [...formData.fieldGroups];
    [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
    const reorderedGroups = newGroups.map((g, i) => ({ ...g, order: i + 1 }));
    setFormData({
      ...formData,
      fieldGroups: reorderedGroups,
    });
  };

  const handleMoveFieldGroupDown = (index: number) => {
    if (index === formData.fieldGroups.length - 1) return;
    const newGroups = [...formData.fieldGroups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    const reorderedGroups = newGroups.map((g, i) => ({ ...g, order: i + 1 }));
    setFormData({
      ...formData,
      fieldGroups: reorderedGroups,
    });
  };

  // Wizard handlers
  const handleAddWizardStep = () => {
    const newStep = {
      name: '',
      description: '',
      fields: [],
    };
    const currentSteps = formData.wizardConfig?.steps || [];
    setFormData({
      ...formData,
      wizardConfig: {
        steps: [...currentSteps, newStep],
      },
    });
  };

  const handleRemoveWizardStep = (index: number) => {
    if (!formData.wizardConfig) return;
    const newSteps = formData.wizardConfig.steps.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      wizardConfig: newSteps.length > 0 ? { steps: newSteps } : undefined,
    });
  };

  const handleUpdateWizardStep = (index: number, updates: Partial<typeof formData.wizardConfig.steps[0]>) => {
    if (!formData.wizardConfig) return;
    const newSteps = [...formData.wizardConfig.steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setFormData({
      ...formData,
      wizardConfig: { steps: newSteps },
    });
  };

  const handleMoveWizardStepUp = (index: number) => {
    if (index === 0 || !formData.wizardConfig) return;
    const newSteps = [...formData.wizardConfig.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setFormData({
      ...formData,
      wizardConfig: { steps: newSteps },
    });
  };

  const handleMoveWizardStepDown = (index: number) => {
    if (!formData.wizardConfig || index === formData.wizardConfig.steps.length - 1) return;
    const newSteps = [...formData.wizardConfig.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setFormData({
      ...formData,
      wizardConfig: { steps: newSteps },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/objects')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEditMode ? 'Edit Object Definition' : 'Create Object Definition'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {fields.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You need to create field definitions before creating object definitions.{' '}
          <Button size="small" onClick={() => navigate('/fields')}>
            Go to Fields
          </Button>
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Short Name"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              disabled={isEditMode}
              required
              helperText="Internal identifier (e.g., customer)"
            />
            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
              helperText="User-facing label (e.g., Customer)"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              helperText="Description of this entity"
            />

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                <Tab label="Fields" />
                <Tab label="Field Groups" />
                <Tab label="Wizard Configuration" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Fields</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddField}
                    disabled={fields.length === 0 || formData.fields.length === fields.length}
                    type="button"
                  >
                    Add Field
                  </Button>
                </Box>

                {formData.fields.length === 0 ? (
                  <Alert severity="info">
                    No fields added yet. Click "Add Field" to add fields to this object.
                  </Alert>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      {formData.fields.map((field, index) => {
                        return (
                          <ListItem key={index} divider>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveFieldUp(index)}
                                  disabled={index === 0}
                                  type="button"
                                >
                                  <ArrowUpIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveFieldDown(index)}
                                  disabled={index === formData.fields.length - 1}
                                  type="button"
                                >
                                  <ArrowDownIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              <FormControl size="small" sx={{ minWidth: 200 }}>
                                <Select
                                  value={field.fieldShortName}
                                  onChange={(e) =>
                                    handleUpdateField(index, { fieldShortName: e.target.value })
                                  }
                                >
                                  {fields.map((f) => (
                                    <MenuItem
                                      key={f.shortName}
                                      value={f.shortName}
                                      disabled={
                                        formData.fields.some(
                                          (ff, i) => i !== index && ff.fieldShortName === f.shortName
                                        )
                                      }
                                    >
                                      {f.displayName} ({f.shortName})
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={field.mandatory}
                                    onChange={(e) =>
                                      handleUpdateField(index, { mandatory: e.target.checked })
                                    }
                                    size="small"
                                  />
                                }
                                label="Mandatory"
                              />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={field.inTable !== false}
                                    onChange={(e) =>
                                      handleUpdateField(index, { inTable: e.target.checked })
                                    }
                                    size="small"
                                  />
                                }
                                label="In Table"
                              />
                              <Box sx={{ flexGrow: 1 }} />
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveField(index)}
                                color="error"
                                type="button"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                )}
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Field Groups</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddFieldGroup}
                    type="button"
                  >
                    Add Group
                  </Button>
                </Box>

                {formData.fieldGroups.length === 0 ? (
                  <Alert severity="info">
                    No field groups defined. Field groups help organize fields in the form view.
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {formData.fieldGroups.map((group, index) => (
                      <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveFieldGroupUp(index)}
                              disabled={index === 0}
                              type="button"
                            >
                              <ArrowUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveFieldGroupDown(index)}
                              disabled={index === formData.fieldGroups.length - 1}
                              type="button"
                            >
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                              label="Group Name"
                              value={group.name}
                              onChange={(e) => handleUpdateFieldGroup(index, { name: e.target.value })}
                              size="small"
                              required
                              fullWidth
                            />
                            <TextField
                              label="Description"
                              value={group.description}
                              onChange={(e) => handleUpdateFieldGroup(index, { description: e.target.value })}
                              size="small"
                              required
                              fullWidth
                            />
                            <FormControl size="small" fullWidth>
                              <InputLabel>Fields in Group</InputLabel>
                              <Select
                                multiple
                                value={group.fields}
                                onChange={(e: SelectChangeEvent<string[]>) => {
                                  const value = e.target.value;
                                  handleUpdateFieldGroup(index, { 
                                    fields: typeof value === 'string' ? value.split(',') : value 
                                  });
                                }}
                                input={<OutlinedInput label="Fields in Group" />}
                                renderValue={(selected) => (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                      <Chip key={value} label={value} size="small" />
                                    ))}
                                  </Box>
                                )}
                              >
                                {formData.fields.map((field) => (
                                  <MenuItem key={field.fieldShortName} value={field.fieldShortName}>
                                    {fields.find(f => f.shortName === field.fieldShortName)?.displayName || field.fieldShortName}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFieldGroup(index)}
                            color="error"
                            type="button"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Wizard Steps</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddWizardStep}
                    type="button"
                  >
                    Add Step
                  </Button>
                </Box>

                {!formData.wizardConfig || formData.wizardConfig.steps.length === 0 ? (
                  <Alert severity="info">
                    No wizard steps defined. Wizard steps create a multi-step form for creating instances.
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {formData.wizardConfig.steps.map((step, index) => (
                      <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveWizardStepUp(index)}
                              disabled={index === 0}
                              type="button"
                            >
                              <ArrowUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveWizardStepDown(index)}
                              disabled={index === formData.wizardConfig!.steps.length - 1}
                              type="button"
                            >
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Step {index + 1}
                            </Typography>
                            <TextField
                              label="Step Name"
                              value={step.name}
                              onChange={(e) => handleUpdateWizardStep(index, { name: e.target.value })}
                              size="small"
                              required
                              fullWidth
                            />
                            <TextField
                              label="Description"
                              value={step.description}
                              onChange={(e) => handleUpdateWizardStep(index, { description: e.target.value })}
                              size="small"
                              required
                              fullWidth
                            />
                            <FormControl size="small" fullWidth>
                              <InputLabel>Fields in Step</InputLabel>
                              <Select
                                multiple
                                value={step.fields}
                                onChange={(e: SelectChangeEvent<string[]>) => {
                                  const value = e.target.value;
                                  handleUpdateWizardStep(index, { 
                                    fields: typeof value === 'string' ? value.split(',') : value 
                                  });
                                }}
                                input={<OutlinedInput label="Fields in Step" />}
                                renderValue={(selected) => (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                      <Chip key={value} label={value} size="small" />
                                    ))}
                                  </Box>
                                )}
                              >
                                {formData.fields.map((field) => (
                                  <MenuItem key={field.fieldShortName} value={field.fieldShortName}>
                                    {fields.find(f => f.shortName === field.fieldShortName)?.displayName || field.fieldShortName}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveWizardStep(index)}
                            color="error"
                            type="button"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            </TabPanel>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button onClick={() => navigate('/objects')} type="button">
                Cancel
              </Button>
              <Button type="submit" variant="contained">
                {isEditMode ? 'Update' : 'Create'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
