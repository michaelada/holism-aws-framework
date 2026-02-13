/**
 * Fields List Page
 * 
 * Displays a table of all field definitions with search and filter functionality
 * Allows administrators to create and edit field definitions
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';

interface ApplicationField {
  id: string;
  name: string;
  label: string;
  description?: string;
  datatype: string;
  options?: string[];
  organisationId: string;
  createdAt: string;
  updatedAt: string;
}

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'phone',
  'date',
  'time',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'file',
  'image',
];

const FieldsListPage: React.FC = () => {
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [filteredFields, setFilteredFields] = useState<ApplicationField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<ApplicationField | null>(null);
  
  // Form states
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldDescription, setFieldDescription] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Helper function to generate field name from label
  const generateFieldName = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  // Check if field type requires options
  const requiresOptions = (type: string): boolean => {
    return ['select', 'multiselect', 'radio', 'checkbox'].includes(type);
  };

  // Handle adding an option
  const handleAddOption = () => {
    if (newOption.trim() && !fieldOptions.includes(newOption.trim())) {
      setFieldOptions([...fieldOptions, newOption.trim()]);
      setNewOption('');
    }
  };

  // Handle removing an option
  const handleRemoveOption = (option: string) => {
    setFieldOptions(fieldOptions.filter(o => o !== option));
  };

  useEffect(() => {
    loadFields();
  }, []);

  useEffect(() => {
    filterFields();
  }, [fields, searchTerm, typeFilter]);

  const loadFields = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/application-fields',
      });
      setFields(response || []);
    } catch (error) {
      console.error('Failed to load fields:', error);
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const filterFields = () => {
    let filtered = [...fields];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(field =>
        field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(field => field.datatype === typeFilter);
    }

    setFilteredFields(filtered);
  };

  const handleCreateField = async () => {
    if (!fieldLabel.trim()) {
      setError('Field label is required');
      return;
    }

    if (!organisation) {
      setError('Organisation context not available');
      return;
    }

    const generatedName = generateFieldName(fieldLabel);
    if (!generatedName) {
      setError('Field label must contain at least one alphanumeric character');
      return;
    }

    // Validate options for field types that require them
    if (requiresOptions(fieldType) && fieldOptions.length === 0) {
      setError(`Field type "${fieldType}" requires at least one option`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await execute({
        method: 'POST',
        url: '/api/orgadmin/application-fields',
        data: {
          organisationId: organisation.id,
          name: generatedName,
          label: fieldLabel,
          description: fieldDescription || undefined,
          datatype: fieldType,
          options: requiresOptions(fieldType) ? fieldOptions : undefined,
        },
      });

      setCreateDialogOpen(false);
      resetForm();
      loadFields();
    } catch (err) {
      setError('Failed to create field');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditField = async () => {
    if (!selectedField || !fieldLabel.trim()) {
      setError('Field label is required');
      return;
    }

    if (!organisation) {
      setError('Organisation context not available');
      return;
    }

    const generatedName = generateFieldName(fieldLabel);
    if (!generatedName) {
      setError('Field label must contain at least one alphanumeric character');
      return;
    }

    // Validate options for field types that require them
    if (requiresOptions(fieldType) && fieldOptions.length === 0) {
      setError(`Field type "${fieldType}" requires at least one option`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await execute({
        method: 'PUT',
        url: `/api/orgadmin/application-fields/${selectedField.id}`,
        data: {
          organisationId: organisation.id,
          name: generatedName,
          label: fieldLabel,
          description: fieldDescription || undefined,
          datatype: fieldType,
          options: requiresOptions(fieldType) ? fieldOptions : undefined,
        },
      });

      setEditDialogOpen(false);
      resetForm();
      loadFields();
    } catch (err) {
      setError('Failed to update field');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async () => {
    if (!selectedField) return;

    try {
      setSaving(true);
      setError(null);

      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/application-fields/${selectedField.id}`,
      });

      setDeleteDialogOpen(false);
      setSelectedField(null);
      loadFields();
    } catch (err) {
      setError('Failed to delete field');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (field: ApplicationField) => {
    setSelectedField(field);
    setFieldLabel(field.label);
    setFieldDescription(field.description || '');
    setFieldType(field.datatype);
    setFieldOptions(field.options || []);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (field: ApplicationField) => {
    setSelectedField(field);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFieldLabel('');
    setFieldDescription('');
    setFieldType('text');
    setFieldOptions([]);
    setNewOption('');
    setSelectedField(null);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Field Definitions</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Create Field
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                {FIELD_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Loading fields...
                </TableCell>
              </TableRow>
            ) : filteredFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || typeFilter !== 'all'
                    ? 'No fields match your filters'
                    : 'No fields yet. Create your first field to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredFields.map((field) => (
                <TableRow key={field.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {field.label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {field.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={field.datatype} size="small" />
                  </TableCell>
                  <TableCell>{formatDate(field.createdAt)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(field)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openDeleteDialog(field)}
                      title="Delete"
                      color="error"
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

      {/* Create Field Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Field Definition</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Field Label"
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            required
            sx={{ mt: 2, mb: 2 }}
            helperText="Display label (e.g., First Name) - field name will be auto-generated"
          />
          <TextField
            fullWidth
            label="Description"
            value={fieldDescription}
            onChange={(e) => setFieldDescription(e.target.value)}
            multiline
            rows={3}
            sx={{ mb: 2 }}
            helperText="Optional detailed explanation of what this field is for"
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Field Type</InputLabel>
            <Select
              value={fieldType}
              label="Field Type"
              onChange={(e) => {
                setFieldType(e.target.value);
                // Clear options when changing to a type that doesn't need them
                if (!requiresOptions(e.target.value)) {
                  setFieldOptions([]);
                }
              }}
            >
              {FIELD_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Options section for select, multiselect, radio, checkbox */}
          {requiresOptions(fieldType) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Options {fieldOptions.length === 0 && <span style={{ color: 'red' }}>*</span>}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Add option"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddOption}
                  disabled={!newOption.trim()}
                >
                  Add
                </Button>
              </Box>
              {fieldOptions.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {fieldOptions.map((option, index) => (
                    <Chip
                      key={index}
                      label={option}
                      onDelete={() => handleRemoveOption(option)}
                      size="small"
                    />
                  ))}
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  At least one option is required for {fieldType} fields
                </Alert>
              )}
            </Box>
          )}

          {fieldLabel && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Field name will be: <strong>{generateFieldName(fieldLabel) || '(invalid)'}</strong>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreateField} variant="contained" disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Field Definition</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Field Label"
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            required
            sx={{ mt: 2, mb: 2 }}
            helperText="Display label (e.g., First Name) - field name will be auto-generated"
          />
          <TextField
            fullWidth
            label="Description"
            value={fieldDescription}
            onChange={(e) => setFieldDescription(e.target.value)}
            multiline
            rows={3}
            sx={{ mb: 2 }}
            helperText="Optional detailed explanation of what this field is for"
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Field Type</InputLabel>
            <Select
              value={fieldType}
              label="Field Type"
              onChange={(e) => {
                setFieldType(e.target.value);
                // Clear options when changing to a type that doesn't need them
                if (!requiresOptions(e.target.value)) {
                  setFieldOptions([]);
                }
              }}
            >
              {FIELD_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Options section for select, multiselect, radio, checkbox */}
          {requiresOptions(fieldType) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Options {fieldOptions.length === 0 && <span style={{ color: 'red' }}>*</span>}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Add option"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddOption}
                  disabled={!newOption.trim()}
                >
                  Add
                </Button>
              </Box>
              {fieldOptions.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {fieldOptions.map((option, index) => (
                    <Chip
                      key={index}
                      label={option}
                      onDelete={() => handleRemoveOption(option)}
                      size="small"
                    />
                  ))}
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  At least one option is required for {fieldType} fields
                </Alert>
              )}
            </Box>
          )}

          {fieldLabel && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Field name will be: <strong>{generateFieldName(fieldLabel) || '(invalid)'}</strong>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleEditField} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm">
        <DialogTitle>Delete Field Definition</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the field "{selectedField?.label}"?
            This action cannot be undone.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleDeleteField} color="error" variant="contained" disabled={saving}>
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FieldsListPage;
