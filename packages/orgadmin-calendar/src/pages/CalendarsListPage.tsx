/**
 * Calendars List Page
 * 
 * Displays a table of all calendars with search and filter functionality.
 * Shows status badges (Open/Closed) and colour indicators for each calendar.
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
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { Calendar, CalendarStatus } from '../types/calendar.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    // Mock data for development
    return [];
  },
});

const CalendarsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [filteredCalendars, setFilteredCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CalendarStatus>('all');

  useEffect(() => {
    loadCalendars();
  }, []);

  useEffect(() => {
    filterCalendars();
  }, [calendars, searchTerm, statusFilter]);

  const loadCalendars = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/calendars',
      });
      setCalendars(response || []);
    } catch (error) {
      console.error('Failed to load calendars:', error);
      setCalendars([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCalendars = () => {
    let filtered = [...calendars];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(calendar =>
        calendar.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        calendar.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(calendar => calendar.status === statusFilter);
    }

    setFilteredCalendars(filtered);
  };

  const handleCreateCalendar = () => {
    navigate('/calendar/new');
  };

  const handleEditCalendar = (calendarId: string) => {
    navigate(`/orgadmin/calendar/${calendarId}/edit`);
  };

  const handleViewCalendar = (calendarId: string) => {
    navigate(`/orgadmin/calendar/${calendarId}`);
  };

  const handleToggleStatus = async (calendar: Calendar) => {
    try {
      const newStatus: CalendarStatus = calendar.status === 'open' ? 'closed' : 'open';
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/calendars/${calendar.id}/status`,
      });
      
      // Update local state
      setCalendars(prev =>
        prev.map(c =>
          c.id === calendar.id ? { ...c, status: newStatus } : c
        )
      );
    } catch (error) {
      console.error('Failed to toggle calendar status:', error);
    }
  };

  const getStatusColor = (status: CalendarStatus) => {
    switch (status) {
      case 'open':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('calendar.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateCalendar}
        >
          {t('calendar.createCalendar')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('calendar.searchCalendarsPlaceholder')}
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
              <InputLabel>{t('calendar.filters.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('calendar.filters.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('calendar.statusOptions.all')}</MenuItem>
                <MenuItem value="open">{t('calendar.statusOptions.open')}</MenuItem>
                <MenuItem value="closed">{t('calendar.statusOptions.closed')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={60}></TableCell>
              <TableCell>{t('calendar.table.name')}</TableCell>
              <TableCell>{t('calendar.table.description')}</TableCell>
              <TableCell>{t('calendar.table.status')}</TableCell>
              <TableCell align="right">{t('calendar.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('calendar.loadingCalendars')}
                </TableCell>
              </TableRow>
            ) : filteredCalendars.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || statusFilter !== 'all'
                    ? t('calendar.noMatchingCalendars')
                    : t('calendar.noCalendarsFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredCalendars.map((calendar) => (
                <TableRow key={calendar.id} hover>
                  <TableCell>
                    <Avatar
                      sx={{
                        bgcolor: calendar.displayColour,
                        width: 32,
                        height: 32,
                      }}
                    >
                      {' '}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {calendar.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 400 }}>
                      {calendar.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`calendar.statusOptions.${calendar.status}`)}
                      color={getStatusColor(calendar.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewCalendar(calendar.id)}
                      title={t('calendar.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditCalendar(calendar.id)}
                      title={t('calendar.tooltips.edit')}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleStatus(calendar)}
                      title={calendar.status === 'open' ? t('calendar.tooltips.closeCalendar') : t('calendar.tooltips.openCalendar')}
                      color={calendar.status === 'open' ? 'success' : 'default'}
                    >
                      {calendar.status === 'open' ? <ToggleOnIcon /> : <ToggleOffIcon />}
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

export default CalendarsListPage;
