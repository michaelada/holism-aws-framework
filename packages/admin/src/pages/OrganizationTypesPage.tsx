import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getOrganizationTypes } from '../services/organizationApi';
import type { OrganizationType } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';

export const OrganizationTypesPage: React.FC = () => {
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showError } = useNotification();

  useEffect(() => {
    loadOrganizationTypes();
  }, []);

  const loadOrganizationTypes = async () => {
    try {
      setLoading(true);
      const data = await getOrganizationTypes();
      setOrganizationTypes(data);
    } catch (error) {
      showError('Failed to load organization types');
      console.error('Error loading organization types:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Organisation Types</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/organization-types/new')}
        >
          Create Organisation Type
        </Button>
      </Box>

      <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Currency</TableCell>
                  <TableCell>Language</TableCell>
                  <TableCell>Locale</TableCell>
                  <TableCell>Organisations</TableCell>
                  <TableCell>Default Capabilities</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organizationTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No organisation types found. Create one to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  organizationTypes.map((type) => (
                    <TableRow key={type.id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {type.displayName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {type.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{type.currency}</TableCell>
                      <TableCell>{type.language}</TableCell>
                      <TableCell>{type.defaultLocale || 'en-GB'}</TableCell>
                      <TableCell>{type.organizationCount || 0}</TableCell>
                      <TableCell>{type.defaultCapabilities.length}</TableCell>
                      <TableCell>
                        <Chip
                          label={type.status}
                          color={type.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/organization-types/${type.id}`)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/organization-types/${type.id}/edit`)}
                          title="Edit"
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
