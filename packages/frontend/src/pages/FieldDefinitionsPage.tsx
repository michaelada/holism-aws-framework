import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  List,
  ListItem,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useMetadataApi } from '../context';
import { FieldDefinition } from '@aws-web-framework/components';
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

export default function FieldDefinitionsPage() {
  const metadataApi = useMetadataApi();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [formData, setFormData] = useState({
    shortName: '',
    displayName: '',
    description: '',
    datatype: 'text',
    mandatory: false,
    options: [] as Array<{ value: string; label: string }>,
  });

  const loadFields = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await metadataApi.getFields();
      setFields(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to load field definitions');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const handleOpenDialog = (field?: FieldDefinition) => {
    if (field) {
      setEditingField(field);
      setFormData({
        shortName: field.shortName,
        displayName: field.displayName,
        description: field.description || '',
        datatype: field.datatype,
        mandatory: field.mandatory,
        options: field.datatypeProperties?.options || [],
      });
    } else {
      setEditingField(null);
      setFormData({
        shortName: '',
        displayName: '',
        description: '',
        datatype: 'text',
        mandatory: false,
        options: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingField(null);
  };

  const handleSubmit = async () => {
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
        datatype: formData.datatype,
        mandatory: formData.mandatory,
        datatypeProperties,
        validationRules: [],
      };
      
      if (editingField) {
        await metadataApi.updateField(editingField.shortName, fieldData);
      } else {
        await metadataApi.createField(fieldData);
      }
      handleCloseDialog();
      loadFields();
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

  const handleDelete = async (shortName: string) => {
    if (!confirm('Are you sure you want to delete this field definition?')) {
      return;
    }

    try {
      setError(null);
      await metadataApi.deleteField(shortName);
      loadFields();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to delete field definition');
      }
    }
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Field Definitions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Field
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Short Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Datatype</TableCell>
              <TableCell>Mandatory</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No field definitions found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field) => (
                <TableRow key={field.shortName}>
                  <TableCell>{field.shortName}</TableCell>
                  <TableCell>{field.displayName}</TableCell>
                  <TableCell>{field.datatype}</TableCell>
                  <TableCell>{field.mandatory ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{field.description}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(field)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(field.shortName)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingField ? 'Edit Field Definition' : 'Create Field Definition'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Short Name"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              disabled={!!editingField}
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
            <TextField
              select
              label="Mandatory"
              value={formData.mandatory ? 'true' : 'false'}
              onChange={(e) =>
                setFormData({ ...formData, mandatory: e.target.value === 'true' })
              }
            >
              <MenuItem value="false">No</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
            </TextField>

            {(formData.datatype === 'single_select' || formData.datatype === 'multi_select') && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Options</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddOption}
                  >
                    Add Option
                  </Button>
                </Box>

                {formData.options.length === 0 ? (
                  <Alert severity="info">
                    No options added yet. Click "Add Option" to add selectable values.
                  </Alert>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingField ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
