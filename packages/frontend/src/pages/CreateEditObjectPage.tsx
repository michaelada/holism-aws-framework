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

export default function CreateEditObjectPage() {
  const navigate = useNavigate();
  const { objectShortName } = useParams<{ objectShortName?: string }>();
  const metadataApi = useMetadataApi();
  const isEditMode = !!objectShortName;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [formData, setFormData] = useState({
    shortName: '',
    displayName: '',
    description: '',
    fields: [] as Array<{ fieldShortName: string; mandatory: boolean; order: number; inTable?: boolean }>,
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
      
      if (isEditMode && objectShortName) {
        const objects = await metadataApi.getObjects();
        const existingObject = objects.find((o) => o.shortName === objectShortName);
        
        await metadataApi.updateObject(objectShortName, {
          ...formData,
          displayProperties: existingObject?.displayProperties || {},
        });
      } else {
        await metadataApi.createObject({
          ...formData,
          displayProperties: {},
        });
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
