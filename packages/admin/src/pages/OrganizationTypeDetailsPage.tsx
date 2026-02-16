import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  Grid,
  Button,
  IconButton,
  Collapse,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowBack, Edit as EditIcon, Add as AddIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { getOrganizationTypeById } from '../services/organizationApi';
import type { OrganizationType } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { useApi } from '../context/ApiContext';
import { OrganizationList } from '../components/OrganizationList';
import type { Organization } from '../types/admin.types';

const LOCALE_NAMES: Record<string, string> = {
  'en-GB': 'English (UK)',
  'fr-FR': 'Français (France)',
  'es-ES': 'Español (España)',
  'it-IT': 'Italiano (Italia)',
  'de-DE': 'Deutsch (Deutschland)',
  'pt-PT': 'Português (Portugal)',
};

export const OrganizationTypeDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const { api } = useApi();
  
  const [organizationType, setOrganizationType] = useState<OrganizationType | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
      loadOrganizations();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getOrganizationTypeById(id);
      setOrganizationType(data);
    } catch (error) {
      showError('Failed to load organisation type details');
      console.error('Error loading organisation type:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    if (!id) return;

    try {
      setOrganizationsLoading(true);
      const data = await api.getOrganizationsByType(id);
      setOrganizations(data);
    } catch (error) {
      showError('Failed to load organisations');
      console.error('Error loading organisations:', error);
    } finally {
      setOrganizationsLoading(false);
    }
  };

  const handleViewOrganization = (organization: Organization) => {
    navigate(`/organizations/${organization.id}`);
  };

  const handleEditOrganization = (organization: Organization) => {
    navigate(`/organizations/${organization.id}/edit`);
  };

  if (loading || !organizationType) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/organization-types')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">{organizationType.displayName}</Typography>
        <Chip
          label={organizationType.status}
          color={organizationType.status === 'active' ? 'success' : 'default'}
        />
        <Box sx={{ ml: 'auto' }}>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/organization-types/${id}/edit`)}
          >
            Edit
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Organisation Type Information
            </Typography>
            <IconButton
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              sx={{
                transform: detailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
          <Collapse in={detailsExpanded} timeout="auto">
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Name
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.name}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Display Name
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.displayName}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Description
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.description || 'No description provided'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Currency
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.currency}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Language
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.language}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Default Locale
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {LOCALE_NAMES[organizationType.defaultLocale] || organizationType.defaultLocale}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {organizationType.defaultLocale}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Status
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.status}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Default Capabilities
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {organizationType.defaultCapabilities.length > 0 ? (
                    organizationType.defaultCapabilities.map((cap) => (
                      <Chip key={cap} label={cap} color="primary" size="small" />
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No default capabilities configured
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Organisations Using This Type
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organizationType.organizationCount || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Created At
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {new Date(organizationType.createdAt).toLocaleString()}
                </Typography>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Organisations Using This Type
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2" color="textSecondary">
                {organizations.length} organisation{organizations.length !== 1 ? 's' : ''}
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => navigate(`/organizations/new?typeId=${id}`)}
              >
                Add Organisation
              </Button>
            </Box>
          </Box>
          <OrganizationList
            organizations={organizations}
            loading={organizationsLoading}
            onViewClick={handleViewOrganization}
            onEditClick={handleEditOrganization}
          />
        </CardContent>
      </Card>
    </Box>
  );
};
