/**
 * Ticketed Events Overview Page
 *
 * Landing page for the ticketing module displaying a table of all events
 * with ticketing activated, including ticket summary statistics per event.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation, useOnboarding, usePageHelp } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import type { TicketedEventSummary } from '../types/ticketing.types';

const TicketedEventsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t, i18n } = useTranslation();
  const { setCurrentModule, checkModuleVisit } = useOnboarding();

  // Register page for contextual help
  usePageHelp('list');

  useEffect(() => {
    setCurrentModule('ticketing');
    checkModuleVisit('ticketing');
  }, [setCurrentModule, checkModuleVisit]);

  const [events, setEvents] = useState<TicketedEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTicketedEvents = useCallback(async () => {
    if (!organisation?.id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/ticketed-events`,
      });
      setEvents(response || []);
    } catch (err) {
      console.error('Failed to load ticketed events:', err);
      setError(t('ticketing.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisation?.id]);

  useEffect(() => {
    loadTicketedEvents();
  }, [loadTicketedEvents]);

  const handleRowClick = (eventId: string) => {
    navigate(`/tickets/${eventId}`);
  };

  const handleSettingsClick = (event: React.MouseEvent, eventId: string) => {
    event.stopPropagation();
    navigate(`/tickets/${eventId}/settings`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('ticketing.overview.title')}</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadTicketedEvents}
        >
          {t('ticketing.actions.refresh')}
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={loadTicketedEvents}>
              {t('ticketing.actions.refresh')}
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : events.length === 0 && !error ? (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {t('ticketing.overview.noTicketedEvents')}
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('ticketing.overview.columns.eventName')}</TableCell>
                <TableCell>{t('ticketing.overview.columns.eventDate')}</TableCell>
                <TableCell align="right">{t('ticketing.overview.columns.totalTickets')}</TableCell>
                <TableCell align="right">{t('ticketing.overview.columns.scanned')}</TableCell>
                <TableCell align="right">{t('ticketing.overview.columns.notScanned')}</TableCell>
                <TableCell align="right">{t('ticketing.overview.columns.scanPercentage')}</TableCell>
                <TableCell>{t('ticketing.overview.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow
                  key={event.eventId}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(event.eventId)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {event.eventName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatDate(new Date(event.eventDate), 'PP', i18n.language)}
                  </TableCell>
                  <TableCell align="right">{event.totalTickets}</TableCell>
                  <TableCell align="right">{event.ticketsScanned}</TableCell>
                  <TableCell align="right">{event.ticketsNotScanned}</TableCell>
                  <TableCell align="right">
                    {event.scanPercentage.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t('ticketing.overview.tooltips.viewTickets')}>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${event.eventId}`); }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('ticketing.overview.tooltips.editSettings')}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleSettingsClick(e, event.eventId)}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TicketedEventsOverviewPage;
