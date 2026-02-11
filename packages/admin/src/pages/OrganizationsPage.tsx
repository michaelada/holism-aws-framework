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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  getOrganizations,
  getOrganizationTypes,
  getCapabilities,
  createOrganization,
  deleteOrganization,
} from '../services/organizationApi';
import type {
  Organization,
  OrganizationType,
  Capability,
  CreateOrganizationDto,
} from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';

export const OrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterTypeId, setFilterTypeId] = useState<string>('');
  const [formData, setFormData] = useState<CreateOrganizationDto>({
    organizationTypeId: '',
    name: '',
    displayName: '',
    domain: '',
    enabledCapabilities: [],
  });
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orgsData, typesData, capsData] = await Promise.all([
        getOrganizations(),
        getOrganizationTypes(),
        getCapabilities(),
      ]);
      setOrganizations(orgsData);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
    } catch (error) {
      showError('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createOrganization(formData);
      showSuccess('Organisation created successfully');
      setCreateDialogOpen(false);
      setFormData({
        organizationTypeId: '',
        name: '',
        displayName: '',
        domain: '',
        enabledCapabilities: [],
      });
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to create organisation');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteOrganization(id);
      showSuccess('Organisation deleted successfully');
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to delete organisation');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'blocked':
        return 'error';
      default:
        return 'default';
    }
  };

  const selectedType = organizationTypes.find((t) => t.id === formData.organizationTypeId);

  // Filter organizations based on search text and type filter
  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch = searchText === '' || 
      org.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
      org.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (org.domain && org.domain.toLowerCase().includes(searchText.toLowerCase()));
    
    const matchesType = filterTypeId === '' || org.organizationTypeId === filterTypeId;
    
    return matchesSearch && matchesType;
  });

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
        <Typography variant="h4">Organisations</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Organisation
        </Button>
      </Box>

      {/* Search and Filter Controls */}
      <Box display="flex" gap={2} mb={3}>
        <TextField
          placeholder="Search organisations..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 400 }}
          helperText="Search by name, display name, or domain"
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select
            value={filterTypeId}
            label="Filter by Type"
            onChange={(e) => setFilterTypeId(e.target.value)}
          >
            <MenuItem value="">All Types</MenuItem>
            {organizationTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.displayName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {(searchText || filterTypeId) && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSearchText('');
              setFilterTypeId('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Capabilities</TableCell>
                  <TableCell>Administrator Users</TableCell>
                  <TableCell>Account Users</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="textSecondary">
                        {organizations.length === 0 
                          ? 'No organisations found. Create one to get started.'
                          : 'No organisations match your search criteria.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((org) => {
                    const orgType = organizationTypes.find((t) => t.id === org.organizationTypeId);
                    return (
                      <TableRow key={org.id} hover>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {org.displayName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {org.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{orgType?.displayName || 'Unknown'}</TableCell>
                        <TableCell>
                          <Chip
                            label={org.status}
                            color={getStatusColor(org.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{org.enabledCapabilities.length}</TableCell>
                        <TableCell>{org.adminUserCount || 0}</TableCell>
                        <TableCell>{org.accountUserCount || 0}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/organizations/${org.id}`)}
                            title="View Details"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/organizations/${org.id}/edit`)}
                            title="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(org.id, org.displayName)}
                            title="Delete"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Organisation</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Organisation Type</InputLabel>
              <Select
                value={formData.organizationTypeId}
                label="Organisation Type"
                onChange={(e) => {
                  const typeId = e.target.value;
                  const type = organizationTypes.find((t) => t.id === typeId);
                  setFormData({
                    ...formData,
                    organizationTypeId: typeId,
                    enabledCapabilities: type?.defaultCapabilities || [],
                  });
                }}
              >
                {organizationTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Name (URL-friendly)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., riverside-swim-club"
              helperText="Lowercase, no spaces, hyphens allowed"
              fullWidth
            />

            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="e.g., Riverside Swim Club"
              fullWidth
            />

            <TextField
              label="Domain (optional)"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="e.g., riverside-swim.example.com"
              fullWidth
            />

            {formData.organizationTypeId && (
              <CapabilitySelector
                capabilities={capabilities}
                selectedCapabilities={formData.enabledCapabilities}
                onChange={(selected) =>
                  setFormData({ ...formData, enabledCapabilities: selected })
                }
                defaultCapabilities={selectedType?.defaultCapabilities}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={
              !formData.organizationTypeId ||
              !formData.name ||
              !formData.displayName ||
              formData.enabledCapabilities.length === 0
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
