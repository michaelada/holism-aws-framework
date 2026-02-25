/**
 * Forms List Page
 * 
 * Displays a table of all application forms with search and filter functionality
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation, useLocale, useOnboarding, usePageHelp } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';

interface ApplicationForm {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

const FormsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { checkModuleVisit } = useOnboarding();
  
  const [forms, setForms] = useState<ApplicationForm[]>([]);
  const [filteredForms, setFilteredForms] = useState<ApplicationForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');

  // Register page for contextual help
  usePageHelp('list');

  // Check module visit for onboarding
  useEffect(() => {
    checkModuleVisit('forms');
  }, [checkModuleVisit]);

  useEffect(() => {
    if (organisation?.id) {
      loadForms();
    }
  }, [organisation?.id]);

  useEffect(() => {
    filterForms();
  }, [forms, searchTerm, statusFilter]);

  const loadForms = async () => {
    if (!organisation?.id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/application-forms`,
      });
      setForms(response || []);
    } catch (error) {
      console.error('Failed to load forms:', error);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  const filterForms = () => {
    let filtered = [...forms];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(form =>
        form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        form.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(form => form.status === statusFilter);
    }

    setFilteredForms(filtered);
  };

  const handleCreateForm = () => {
    navigate('/forms/new');
  };

  const handleEditForm = (formId: string) => {
    navigate(`/forms/${formId}/edit`);
  };

  const handlePreviewForm = (formId: string) => {
    navigate(`/forms/${formId}/preview`);
  };

  const getStatusColor = (status: string) => {
    return status === 'published' ? 'success' : 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('forms.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateForm}
        >
          {t('forms.createForm')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('forms.searchPlaceholder')}
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
              <InputLabel>{t('common.status.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('common.status.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('common.labels.all')}</MenuItem>
                <MenuItem value="draft">{t('common.status.draft')}</MenuItem>
                <MenuItem value="published">{t('common.status.published')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('forms.table.name')}</TableCell>
              <TableCell>{t('forms.table.description')}</TableCell>
              <TableCell>{t('forms.table.status')}</TableCell>
              <TableCell>{t('forms.table.created')}</TableCell>
              <TableCell align="right">{t('forms.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('forms.loadingForms')}
                </TableCell>
              </TableRow>
            ) : filteredForms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || statusFilter !== 'all'
                    ? t('forms.noMatchingForms')
                    : t('forms.noFormsFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredForms.map((form) => (
                <TableRow key={form.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {form.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {form.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`common.status.${form.status}`)}
                      color={getStatusColor(form.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(new Date(form.createdAt), 'dd MMM yyyy', locale)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handlePreviewForm(form.id)}
                      title={t('forms.tooltips.preview')}
                    >
                      <PreviewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditForm(form.id)}
                      title={t('forms.tooltips.edit')}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default FormsListPage;
