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
import {
  useApi,
  useOrganisation,
  ConfirmDialog,
  ResponsiveTable,
  SortableTableCell,
  useTableSort,
} from '@aws-web-framework/orgadmin-core';

interface Venue {
  id: string;
  name: string;
  address: string;
  region?: string;
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
  const sort = useTableSort(filteredVenues, {
    // North to south. The cell reads "53.512345, -6.541234"; sorted as that
    // text, a negative longitude decides the order before the latitude does.
    accessors: { coordinates: (venue) => venue.latitude },
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  /*
   * Deletion used to call the browser's own `confirm()`: OS chrome, no styling,
   * and — decisively — no i18n, so a German administrator was asked in English
   * by a dialog that did not look like the product.
   */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    region: '',
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
    setFormData({ name: '', address: '', region: '', latitude: '', longitude: '' });
    setDialogOpen(true);
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name,
      address: venue.address,
      region: venue.region ?? '',
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
        region: formData.region,
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

  const handleDelete = (id: string) => setPendingDelete(id);

  const confirmDelete = async () => {
    const id = pendingDelete;
    if (!id) return;
    setPendingDelete(null);
    
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/venues/${id}`,
      });
      loadVenues();
    } catch (error) {
      console.error('Failed to delete venue:', error);
      setError(t('venues.deleteFailed'));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('venues.deleteTitle')}
        body={t('venues.deleteBody')}
        confirmLabel={t('venues.deleteConfirm')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('events.venues.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          {t('events.venues.create')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder={t('events.venues.searchPlaceholder')}
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

      <ResponsiveTable identityColumn={t('events.venues.name')} component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <SortableTableCell sort={sort} field="name">
                {t('events.venues.name')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="address">
                {t('events.venues.address')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="coordinates">
                {t('events.venues.coordinates')}
              </SortableTableCell>
              <TableCell align="right">{t('events.venues.actions')}</TableCell>
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
                  {searchTerm ? t('events.venues.noMatches') : t('events.venues.noneYet')}
                </TableCell>
              </TableRow>
            ) : (
              sort.rows.map((venue) => (
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
                      title={t('events.venues.edit')}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(venue.id)}
                      title={t('events.venues.delete')}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>

      {/*
        On the page, not only inside the create/edit dialog.
        `confirmDelete` sets the same `error`, and the dialog it used to live in
        is closed by then — so a delete the server refused (a venue or type an
        event still references) failed silently, leaving the row on screen with
        no explanation.
      */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
            label={t('events.venues.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            required
            multiline
            rows={2}
            label={t('events.venues.address')}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            sx={{ mb: 2 }}
          />
          {/*
            The one field the public listings need that prose cannot give them.
            The hint says why, because an administrator filling in a venue form
            has no other way to know this feeds a filter somewhere else.
          */}
          <TextField
            fullWidth
            label={t('events.venues.region')}
            helperText={t('events.venues.regionHint')}
            value={formData.region ?? ''}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={t('events.venues.latitude')}
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                inputProps={{ step: 'any' }}
                helperText={t('events.venues.latitudeHint')}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={t('events.venues.longitude')}
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                inputProps={{ step: 'any' }}
                helperText={t('events.venues.longitudeHint')}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('events.venues.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.name.trim() || !formData.address.trim()}
          >
            {editingVenue ? t('events.venues.update') : t('events.venues.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VenuesListPage;
