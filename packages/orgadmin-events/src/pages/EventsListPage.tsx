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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  People as EntriesIcon,
  Search as SearchIcon,
  ContentCopy as CloneIcon,
  LocalOffer as DiscountIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation, useLocale, useOnboarding, usePageHelp } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import type { Event } from '../types/event.types';
import { useDiscountService } from '../hooks/useDiscountService';

interface DiscountSummary {
  id: string;
  name: string;
}


const EventsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { checkModuleVisit, setCurrentModule } = useOnboarding();
  const { organisation } = useOrganisation();
  const discountService = useDiscountService();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'cancelled' | 'completed'>('all');
  const [eventDiscounts, setEventDiscounts] = useState<Record<string, DiscountSummary[]>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  // Register page for contextual help
  usePageHelp('list');

  // Check module visit for onboarding
  useEffect(() => {
    setCurrentModule('events');
    checkModuleVisit('events');
  }, [setCurrentModule, checkModuleVisit]);

  useEffect(() => {
    if (organisation?.id) {
      loadEvents();
    }
  }, [organisation?.id]);

  useEffect(() => {
    filterEvents();
  }, [events, searchTerm, statusFilter]);

  const loadEvents = async () => {
    if (!organisation?.id) {
      console.error('Organisation ID not available');
      return;
    }

    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/events`,
      });
      console.log('Events loaded:', response);
      console.log('First event discountIds:', response?.[0]?.discountIds);
      setEvents(response || []);
      
      // Load discount information for each event
      await loadEventDiscounts(response || []);
    } catch (error) {
      console.error(t('events.failedToLoad'), error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEventDiscounts = async (eventsList: Event[]) => {
    if (!organisation?.id) {
      console.error('Organisation ID not available for loading discounts');
      return;
    }

    const discountsMap: Record<string, DiscountSummary[]> = {};
    
    console.log('Loading discounts for events:', eventsList.map(e => ({ id: e.id, name: e.name, discountIds: e.discountIds })));
    
    // Load discount details for events that have discountIds
    await Promise.all(
      eventsList.map(async (event) => {
        if (event.discountIds && event.discountIds.length > 0) {
          try {
            console.log(`Event ${event.name} has discount IDs:`, event.discountIds);
            // Fetch discount details for each discount ID
            const discountPromises = event.discountIds.map(async (id) => {
              console.log(`Fetching discount with ID: ${id} for organisation: ${organisation.id}`);
              try {
                const discount = await discountService.getDiscountById(id, organisation.id);
                console.log(`Successfully fetched discount:`, discount);
                return discount;
              } catch (err) {
                console.error(`Failed to fetch discount ${id}:`, err);
                throw err;
              }
            });
            const discounts = await Promise.all(discountPromises);
            discountsMap[event.id] = discounts.map(d => ({
              id: d.id,
              name: d.name
            }));
            console.log(`Loaded discounts for event ${event.name}:`, discountsMap[event.id]);
          } catch (error) {
            console.error(`Failed to load discounts for event ${event.id}:`, error);
            discountsMap[event.id] = [];
          }
        } else {
          console.log(`Event ${event.name} has no discount IDs`);
          discountsMap[event.id] = [];
        }
      })
    );
    
    console.log('Final discounts map:', discountsMap);
    setEventDiscounts(discountsMap);
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
    navigate(`/events/${eventId}/edit`);
  };

  const handleViewEvent = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  const handleViewEntries = (eventId: string) => {
    navigate(`/events/${eventId}/entries`);
  };

  const handleCloneEvent = async (eventId: string) => {
    try {
      setLoading(true);
      const clonedEvent = await execute({
        method: 'POST',
        url: `/api/orgadmin/events/${eventId}/clone`,
      });
      
      // Navigate to edit page of the cloned event
      navigate(`/events/${clonedEvent.id}/edit`);
    } catch (error) {
      console.error('Failed to clone event:', error);
      setLoading(false);
    }
  };

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;

    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/events/${eventToDelete.id}`,
      });
      
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      
      // Reload events list
      await loadEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setEventToDelete(null);
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
              <TableCell align="center">{t('events.table.hasDiscounts')}</TableCell>
              <TableCell align="right">{t('events.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {t('events.loadingEvents')}
                </TableCell>
              </TableRow>
            ) : filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
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
                  <TableCell align="center">
                    {eventDiscounts[event.id] && eventDiscounts[event.id].length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {eventDiscounts[event.id].map((discount) => (
                          <Chip
                            key={discount.id}
                            icon={<DiscountIcon />}
                            label={discount.name}
                            color="secondary"
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
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
                    <IconButton
                      size="small"
                      onClick={() => handleCloneEvent(event.id)}
                      title="Clone Event"
                    >
                      <CloneIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(event)}
                      title={t('events.tooltips.delete')}
                      color="error"
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

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {t('events.deleteDialog.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('events.deleteDialog.message', { eventName: eventToDelete?.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            {t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsListPage;
