/**
 * Events List Page
 * 
 * Displays a table of all events with search and filter functionality
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
  Visibility as ViewIcon,
  People as EntriesIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation, useLocale } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import type { Event } from '../types/event.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async () => {
    // Mock data for development
    return [];
  },
});

const EventsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'cancelled' | 'completed'>('all');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, searchTerm, statusFilter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await execute();
      setEvents(response || []);
    } catch (error) {
      console.error(t('events.failedToLoad'), error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(event => event.status === statusFilter);
    }

    setFilteredEvents(filtered);
  };

  const handleCreateEvent = () => {
    navigate('/events/new');
  };

  const handleEditEvent = (eventId: string) => {
    navigate(`/orgadmin/events/${eventId}/edit`);
  };

  const handleViewEvent = (eventId: string) => {
    navigate(`/orgadmin/events/${eventId}`);
  };

  const handleViewEntries = (eventId: string) => {
    navigate(`/orgadmin/events/${eventId}/entries`);
  };

  const formatDateLocale = (dateString: Date | string) => {
    return formatDate(dateString, 'dd MMM yyyy', locale);
  };

  const formatDateRange = (startDate: Date | string, endDate: Date | string) => {
    const start = formatDateLocale(startDate);
    const end = formatDateLocale(endDate);
    return start === end ? start : `${start} - ${end}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'default';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('events.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateEvent}
        >
          {t('events.createEvent')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('events.searchPlaceholder')}
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
              <InputLabel>{t('events.table.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('events.table.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('common.labels.all')}</MenuItem>
                <MenuItem value="draft">{t('common.status.draft')}</MenuItem>
                <MenuItem value="published">{t('common.status.published')}</MenuItem>
                <MenuItem value="cancelled">{t('common.status.cancelled')}</MenuItem>
                <MenuItem value="completed">{t('common.status.completed')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('events.table.eventName')}</TableCell>
              <TableCell>{t('events.table.dates')}</TableCell>
              <TableCell>{t('events.table.status')}</TableCell>
              <TableCell>{t('events.table.entryLimit')}</TableCell>
              <TableCell align="right">{t('events.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('events.loadingEvents')}
                </TableCell>
              </TableRow>
            ) : filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || statusFilter !== 'all'
                    ? t('events.noMatchingEvents')
                    : t('events.noEventsFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow key={event.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {event.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatDateRange(event.startDate, event.endDate)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`common.status.${event.status}`)}
                      color={getStatusColor(event.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {event.limitEntries && event.entriesLimit
                      ? `${event.entriesLimit} ${t('common.labels.max')}`
                      : t('common.labels.unlimited')}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewEntries(event.id)}
                      title={t('events.tooltips.viewEntries')}
                    >
                      <EntriesIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleViewEvent(event.id)}
                      title={t('events.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditEvent(event.id)}
                      title={t('events.tooltips.edit')}
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

export default EventsListPage;
