/**
 * Event Entries Page
 * 
 * Displays a tabular view of all entries for an event with filtering and export
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import type { EventEntry, EventActivity } from '../types/event.types';
import EventEntryDetailsDialog from '../components/EventEntryDetailsDialog';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async () => {
    return [];
  },
});

const EventEntriesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<EventEntry | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadActivities(id);
      loadEntries(id);
    }
  }, [id]);

  useEffect(() => {
    filterEntries();
  }, [entries, searchName, activityFilter]);

  const loadActivities = async (_eventId: string) => {
    try {
      const response = await execute();
      setActivities(response || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
      setActivities([]);
    }
  };

  const loadEntries = async (_eventId: string) => {
    try {
      setLoading(true);
      const response = await execute();
      setEntries(response || []);
    } catch (error) {
      console.error('Failed to load entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    // Apply activity filter
    if (activityFilter !== 'all') {
      filtered = filtered.filter(entry => entry.eventActivityId === activityFilter);
    }

    // Apply name search
    if (searchName) {
      const searchLower = searchName.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.firstName.toLowerCase().includes(searchLower) ||
        entry.lastName.toLowerCase().includes(searchLower)
      );
    }

    setFilteredEntries(filtered);
  };

  const handleExportEntries = async () => {
    try {
      // This will trigger a download of Excel file
      window.open(`/api/orgadmin/events/${id}/entries/export`, '_blank');
    } catch (error) {
      console.error('Failed to export entries:', error);
    }
  };

  const handleViewEntry = (entry: EventEntry) => {
    setSelectedEntry(entry);
    setDetailsDialogOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedEntry(null);
  };

  const formatDateTime = (dateString: Date | string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityName = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.name || 'Unknown Activity';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Event Entries</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={handleExportEntries}
          disabled={entries.length === 0}
        >
          Download All Entries
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Event Activity</InputLabel>
              <Select
                value={activityFilter}
                label="Event Activity"
                onChange={(e) => setActivityFilter(e.target.value)}
              >
                <MenuItem value="all">All Activities</MenuItem>
                {activities.map((activity) => (
                  <MenuItem key={activity.id} value={activity.id}>
                    {activity.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              placeholder="Search by name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Event Activity</TableCell>
              <TableCell>First Name</TableCell>
              <TableCell>Last Name</TableCell>
              <TableCell>Entry Date/Time</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Loading entries...
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchName || activityFilter !== 'all'
                    ? 'No entries match your filters'
                    : 'No entries yet for this event'}
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>{getActivityName(entry.eventActivityId)}</TableCell>
                  <TableCell>{entry.firstName}</TableCell>
                  <TableCell>{entry.lastName}</TableCell>
                  <TableCell>{formatDateTime(entry.entryDate)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewEntry(entry)}
                      title="View Details"
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedEntry && (
        <EventEntryDetailsDialog
          entry={selectedEntry}
          open={detailsDialogOpen}
          onClose={handleCloseDetails}
        />
      )}
    </Box>
  );
};

export default EventEntriesPage;
