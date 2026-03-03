/**
 * Venues List Page
 * 
 * Manage venues (locations) for events
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';

interface Venue {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
}

const VenuesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organisation?.id) {
      loadVenues();
    }
  }, [organisation?.id]);

  useEffect(() => {
    filterVenues();
  }, [venues, searchTerm]);

  const loadVenues = async () => {
    if (!organisation?.id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/venues`,
      });
      setVenues(response || []);
    } catch (error) {
      console.error('Failed to load venues:', error);
      setVenues([]);
    } finally {
      setLoading(false);
    }
  };

  const filterVenues = () => {
    let filtered = [...venues];

    if (searchTerm) {
      filtered = filtered.filter(venue =>
        venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        venue.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredVenues(filtered);
  };

  const handleCreate = () => {
    setEditingVenue(null);
    setFormData({ name: '', address: '', latitude: '', longitude: '' });
    setDialogOpen(true);
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name,
      address: venue.address,
      latitude: venue.latitude?.toString() || '',
      longitude: venue.longitude?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!organisation?.id) return;
    
    try {
      setError(null);
      
      const data = {
        name: formData.name,
        address: formData.address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      };
      
      if (editingVenue) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/venues/${editingVenue.id}`,
          data,
        });
      } else {
        await execute({
          method: 'POST',
          url: `/api/orgadmin/organisations/${organisation.id}/venues`,
          data,
        });
      }
      
      setDialogOpen(false);
      loadVenues();
    } catch (error) {
      console.error('Failed to save venue:', error);
      setError('Failed to save venue');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this venue?')) return;
    
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/venues/${id}`,
      });
      loadVenues();
    } catch (error) {
      console.error('Failed to delete venue:', error);
      alert('Failed to delete venue. It may be in use by existing events.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Venues</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Venue
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder="Search venues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Coordinates</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredVenues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  {searchTerm ? 'No matching venues found' : 'No venues yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredVenues.map((venue) => (
                <TableRow key={venue.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {venue.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{venue.address}</TableCell>
                  <TableCell>
                    {venue.latitude && venue.longitude
                      ? `${venue.latitude.toFixed(6)}, ${venue.longitude.toFixed(6)}`
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(venue)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(venue.id)}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVenue ? 'Edit Venue' : 'Create Venue'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            required
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            required
            multiline
            rows={2}
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Latitude (optional)"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                inputProps={{ step: 'any' }}
                helperText="e.g., 51.5074"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Longitude (optional)"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                inputProps={{ step: 'any' }}
                helperText="e.g., -0.1278"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.name.trim() || !formData.address.trim()}
          >
            {editingVenue ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VenuesListPage;
