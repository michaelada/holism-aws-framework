import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  Grid,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMetadataApi } from '../context';
import { ApiError, NetworkError } from '../api';

const DATATYPES = [
  'text',
  'text_area',
  'single_select',
  'multi_select',
  'date',
  'time',
  'datetime',
  'number',
  'boolean',
  'email',
  'url',
];

export default function CreateEditFieldPage() {
  const navigate = useNavigate();
  const { fieldShortName } = useParams<{ fieldShortName?: string }>();
  const metadataApi = useMetadataApi();
  const isEditMode = !!fieldShortName;

  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    shortName: '',
    displayName: '',
    description: '',
    datatype: 'text',
    options: [] as Array<{ value: string; label: string }>,
  });

  useEffect(() => {
    if (isEditMode && fieldShortName) {
      loadField(fieldShortName);
    }
  }, [fieldShortName]);

  const loadField = async (shortName: string) => {
    try {
      setLoading(true);
      setError(null);
      const fields = await metadataApi.getFields();
      const field = fields.find((f) => f.shortName === shortName);
      
      if (!field) {
        setError('Field not found');
        return;
      }

      setFormData({
        shortName: field.shortName,
        displayName: field.displayName,
        description: field.description || '',
        datatype: field.datatype,
        options: field.datatypeProperties?.options || [],
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to load field definition');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      // Build datatypeProperties based on field type
      const datatypeProperties: Record<string, any> = {};
      if (formData.datatype === 'single_select' || formData.datatype === 'multi_select') {
        datatypeProperties.options = formData.options;
      }
      
      const fieldData = {
        shortName: formData.shortName,
        displayName: formData.displayName,
        description: formData.description,
        datatype: formData.datatype as any,
        datatypeProperties,
        validationRules: [],
      };
      
      if (isEditMode && fieldShortName) {
        await metadataApi.updateField(fieldShortName, fieldData);
      } else {
        await metadataApi.createField(fieldData);
      }
      
      navigate('/fields');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to save field definition');
      }
    }
  };

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { value: '', label: '' }],
    });
  };

  const handleRemoveOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const handleUpdateOption = (index: number, field: 'value' | 'label', newValue: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: newValue };
    setFormData({
      ...formData,
      options: newOptions,
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
        <IconButton onClick={() => navigate('/fields')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEditMode ? 'Edit Field Definition' : 'Create Field Definition'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
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
              helperText="Internal identifier (e.g., user_email)"
            />
            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
              helperText="User-facing label (e.g., Email Address)"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              helperText="Help text for users"
            />
            <TextField
              select
              label="Datatype"
              value={formData.datatype}
              onChange={(e) => setFormData({ ...formData, datatype: e.target.value })}
              required
            >
              {DATATYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            {(formData.datatype === 'single_select' || formData.datatype === 'multi_select') && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Options</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddOption}
                    type="button"
                  >
                    Add Option
                  </Button>
                </Box>

                {formData.options.length === 0 ? (
                  <Alert severity="info">
                    No options added yet. Click "Add Option" to add selectable values.
                  </Alert>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      {formData.options.map((option, index) => (
                        <ListItem key={index} divider>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={5}>
                              <TextField
                                size="small"
                                label="Value"
                                value={option.value}
                                onChange={(e) => handleUpdateOption(index, 'value', e.target.value)}
                                fullWidth
                                required
                                helperText="Internal value"
                              />
                            </Grid>
                            <Grid item xs={5}>
                              <TextField
                                size="small"
                                label="Label"
                                value={option.label}
                                onChange={(e) => handleUpdateOption(index, 'label', e.target.value)}
                                fullWidth
                                required
                                helperText="Display text"
                              />
                            </Grid>
                            <Grid item xs={2}>
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveOption(index)}
                                color="error"
                                type="button"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button onClick={() => navigate('/fields')} type="button">
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
