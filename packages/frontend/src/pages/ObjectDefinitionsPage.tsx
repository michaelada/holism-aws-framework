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
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMetadataApi } from '../context';
import { ObjectDefinition, FieldDefinition } from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

export default function ObjectDefinitionsPage() {
  const navigate = useNavigate();
  const metadataApi = useMetadataApi();
  const [objects, setObjects] = useState<ObjectDefinition[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<ObjectDefinition | null>(null);
  const [formData, setFormData] = useState({
    shortName: '',
    displayName: '',
    description: '',
    fields: [] as Array<{ fieldShortName: string; mandatory: boolean; order: number }>,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [objectsData, fieldsData] = await Promise.all([
        metadataApi.getObjects(),
        metadataApi.getFields(),
      ]);
      setObjects(objectsData);
      setFields(fieldsData);
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

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = (object?: ObjectDefinition) => {
    if (object) {
      setEditingObject(object);
      setFormData({
        shortName: object.shortName,
        displayName: object.displayName,
        description: object.description || '',
        fields: object.fields || [],
      });
    } else {
      setEditingObject(null);
      setFormData({
        shortName: '',
        displayName: '',
        description: '',
        fields: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingObject(null);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      if (editingObject) {
        await metadataApi.updateObject(editingObject.shortName, {
          ...formData,
          displayProperties: editingObject.displayProperties || {},
        });
      } else {
        await metadataApi.createObject({
          ...formData,
          displayProperties: {},
        });
      }
      handleCloseDialog();
      loadData();
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
    };
    setFormData({
      ...formData,
      fields: [...formData.fields, newField],
    });
  };

  const handleRemoveField = (index: number) => {
    const newFields = formData.fields.filter((_, i) => i !== index);
    // Reorder remaining fields
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
    // Update order
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
    // Update order
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

  const handleDelete = async (shortName: string) => {
    if (!confirm('Are you sure you want to delete this object definition?')) {
      return;
    }

    try {
      setError(null);
      await metadataApi.deleteObject(shortName);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to delete object definition');
      }
    }
  };

  const handleViewInstances = (shortName: string) => {
    navigate(`/objects/${shortName}/instances`);
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
          Object Definitions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Object
        </Button>
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Short Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {objects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No object definitions found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              objects.map((object) => (
                <TableRow key={object.shortName}>
                  <TableCell>{object.shortName}</TableCell>
                  <TableCell>{object.displayName}</TableCell>
                  <TableCell>{object.description}</TableCell>
                  <TableCell>
                    {object.fields?.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {object.fields.slice(0, 3).map((field) => (
                          <Chip
                            key={field.fieldShortName}
                            label={field.fieldShortName}
                            size="small"
                          />
                        ))}
                        {object.fields.length > 3 && (
                          <Chip label={`+${object.fields.length - 3} more`} size="small" />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No fields
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewInstances(object.shortName)}
                      title="View Instances"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(object)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(object.shortName)}
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
          {editingObject ? 'Edit Object Definition' : 'Create Object Definition'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Short Name"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              disabled={!!editingObject}
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

            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">Fields</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddField}
                  disabled={fields.length === 0 || formData.fields.length === fields.length}
                >
                  Add Field
                </Button>
              </Box>

              {formData.fields.length === 0 ? (
                <Alert severity="info">
                  No fields added yet. Click "Add Field" to add fields to this object.
                </Alert>
              ) : (
                <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                  <List dense>
                    {formData.fields.map((field, index) => {
                      const fieldDef = fields.find((f) => f.shortName === field.fieldShortName);
                      return (
                        <ListItem key={index} divider>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleMoveFieldUp(index)}
                                disabled={index === 0}
                              >
                                <ArrowUpIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleMoveFieldDown(index)}
                                disabled={index === formData.fields.length - 1}
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
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveField(index)}
                              color="error"
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingObject ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
