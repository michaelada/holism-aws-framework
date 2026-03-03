/**
 * Event Types List Page
 * 
 * Manage event types (categories) for organizing events
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';

interface EventType {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

const EventTypesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [filteredEventTypes, setFilteredEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventType | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organisation?.id) {
      loadEventTypes();
    }
  }, [organisation?.id]);

  useEffect(() => {
    filterEventTypes();
  }, [eventTypes, searchTerm]);

  const loadEventTypes = async () => {
    if (!organisation?.id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/event-types`,
      });
      setEventTypes(response || []);
    } catch (error) {
      console.error('Failed to load event types:', error);
      setEventTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterEventTypes = () => {
    let filtered = [...eventTypes];

    if (searchTerm) {
      filtered = filtered.filter(type =>
        type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEventTypes(filtered);
  };

  const handleCreate = () => {
    setEditingType(null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
  };

  const handleEdit = (eventType: EventType) => {
    setEditingType(eventType);
    setFormData({ name: eventType.name, description: eventType.description });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!organisation?.id) return;
    
    try {
      setError(null);
      
      if (editingType) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/event-types/${editingType.id}`,
          data: formData,
        });
      } else {
        await execute({
          method: 'POST',
          url: `/api/orgadmin/organisations/${organisation.id}/event-types`,
          data: formData,
        });
      }
      
      setDialogOpen(false);
      loadEventTypes();
    } catch (error) {
      console.error('Failed to save event type:', error);
      setError('Failed to save event type');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event type?')) return;
    
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/event-types/${id}`,
      });
      loadEventTypes();
    } catch (error) {
      console.error('Failed to delete event type:', error);
      alert('Failed to delete event type. It may be in use by existing events.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Event Types</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Event Type
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder="Search event types..."
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
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredEventTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  {searchTerm ? 'No matching event types found' : 'No event types yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredEventTypes.map((eventType) => (
                <TableRow key={eventType.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {eventType.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{eventType.description}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(eventType)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(eventType.id)}
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
        <DialogTitle>{editingType ? 'Edit Event Type' : 'Create Event Type'}</DialogTitle>
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
            rows={3}
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.name.trim() || !formData.description.trim()}
          >
            {editingType ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventTypesListPage;
