/**
 * Fields List Page
 * 
 * Displays a table of all field definitions with search and filter functionality
 * Allows administrators to create and edit field definitions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useTranslation, usePageHelp } from '@aws-web-framework/orgadmin-shell';

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
  const { t } = useTranslation();
  const { execute } = useApi();
  const navigate = useNavigate();
  
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [filteredFields, setFilteredFields] = useState<ApplicationField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<ApplicationField | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Register page for contextual help
  usePageHelp('fields');

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

  const openDeleteDialog = (field: ApplicationField) => {
    setSelectedField(field);
    setDeleteDialogOpen(true);
  };

  const handleCreateField = () => {
    navigate('/forms/fields/new');
  };

  const handleEditField = (field: ApplicationField) => {
    navigate(`/forms/fields/${field.id}/edit`);
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
        <Typography variant="h4">{t('forms.fields.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateField}
        >
          {t('forms.fields.createField')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('forms.fields.searchPlaceholder')}
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
              <InputLabel>{t('forms.fields.fieldType')}</InputLabel>
              <Select
                value={typeFilter}
                label={t('forms.fields.fieldType')}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">{t('forms.fields.allTypes')}</MenuItem>
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
              <TableCell>{t('forms.fields.table.label')}</TableCell>
              <TableCell>{t('forms.fields.table.description')}</TableCell>
              <TableCell>{t('forms.fields.table.type')}</TableCell>
              <TableCell>{t('forms.fields.table.created')}</TableCell>
              <TableCell align="right">{t('forms.fields.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {t('forms.fields.loadingFields')}
                </TableCell>
              </TableRow>
            ) : filteredFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || typeFilter !== 'all'
                    ? t('forms.fields.noMatchingFields')
                    : t('forms.fields.noFieldsFound')}
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
                      onClick={() => handleEditField(field)}
                      title={t('common.actions.edit')}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openDeleteDialog(field)}
                      title={t('common.actions.delete')}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm">
        <DialogTitle>{t('forms.fields.delete.title')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('forms.fields.delete.message', { label: selectedField?.label })}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={handleDeleteField} color="error" variant="contained" disabled={saving}>
            {saving ? t('common.messages.saving') : t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FieldsListPage;
