/**
 * Event Entries Page
 * 
 * Displays all entries for a specific event with filtering and export capabilities
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';

interface EventEntry {
  id: string;
  eventId: string;
  eventActivityId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: Date;
}

const EventEntriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    if (id) {
      loadEvent(id);
      loadEntries(id);
    }
  }, [id]);

  useEffect(() => {
    filterEntries();
  }, [entries, searchTerm]);

  const loadEvent = async (eventId: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${eventId}`,
      });
      setEventName(response?.name || '');
    } catch (error) {
      console.error('Failed to load event:', error);
    }
  };

  const loadEntries = async (eventId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${eventId}/entries`,
      });
      setEntries(response || []);
    } catch (error) {
      console.error('Failed to load entries:', error);
      setError('Failed to load event entries');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEntries(filtered);
  };

  const handleExport = async () => {
    if (!id) return;

    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${id}/entries/export`,
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${eventName.replace(/[^a-z0-9]/gi, '_')}_entries.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export entries:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Event Entries</Typography>
          {eventName && (
            <Typography variant="subtitle1" color="textSecondary">
              {eventName}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={entries.length === 0}
          >
            Export to Excel
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder="Search by name or email..."
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
              <TableCell>First Name</TableCell>
              <TableCell>Last Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm
                    ? 'No matching entries found'
                    : 'No entries yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>{entry.firstName}</TableCell>
                  <TableCell>{entry.lastName}</TableCell>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.status}</TableCell>
                  <TableCell>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        variant="outlined"
        startIcon={<BackIcon />}
        onClick={() => navigate('/events')}
        sx={{ mt: 3 }}
      >
        {t('common.actions.back')}
      </Button>
    </Box>
  );
};

export default EventEntriesPage;
