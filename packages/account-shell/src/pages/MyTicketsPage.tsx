import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import { formatDisplayDate } from '@itsplainsailing/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountTicketSummary, TicketState } from '../types/account';

/**
 * C9 — My Tickets. Route `/:orgCode/tickets`, capability `event-ticketing`.
 *
 * Ordered by event date, soonest first, because of where this screen is used:
 * standing at a gate, the ticket you want is almost always the next event
 * rather than the most recently bought one. The server sorts it, so the order
 * cannot drift between here and the ticket screen.
 *
 * Used and expired tickets are shown rather than filtered out. A member whose
 * ticket will not scan is the person most in need of this screen, and hiding it
 * leaves them with no explanation at the one moment it matters.
 */

/** Chip colour per state — the same mapping the ticket screen uses. */
const STATE_COLOUR: Record<TicketState, 'success' | 'warning' | 'default' | 'error'> = {
  valid: 'success',
  'awaiting-payment': 'warning',
  used: 'default',
  expired: 'error',
};

export const MyTicketsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountTicketSummary[]>();

  const [tickets, setTickets] = useState<AccountTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setTickets((await execute({ url: `/api/account/${orgCode}/tickets` })) ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, execute]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Grouped by event date. A member holding tickets for several people sees one
   * row each under the same date — a parent at a gate has to hand over the
   * right one, so the entrant's name is the prominent part of the row.
   */
  const groups = useMemo(() => {
    const byDate = new Map<string, AccountTicketSummary[]>();
    tickets.forEach((ticket) => {
      const key = ticket.eventStartDate;
      byDate.set(key, [...(byDate.get(key) ?? []), ticket]);
    });
    return Array.from(byDate.entries());
  }, [tickets]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        {t('tickets.title')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('tickets.loadFailed')}
        </Alert>
      )}

      {!failed && tickets.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ConfirmationNumberIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
          <Typography color="text.secondary">{t('tickets.empty')}</Typography>
        </Paper>
      )}

      {groups.map(([date, group]) => (
        <Box key={date} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {formatDisplayDate(date, locale)}
          </Typography>
          <Paper>
            <List disablePadding>
              {group.map((ticket) => (
                <ListItemButton
                  key={ticket.id}
                  divider
                  onClick={() => navigate(`/${orgCode}/tickets/${ticket.id}`)}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography component="span" fontWeight={600}>
                          {ticket.entrantName}
                        </Typography>
                        <Chip
                          size="small"
                          color={STATE_COLOUR[ticket.state]}
                          label={t(`tickets.states.${ticket.state}`)}
                        />
                      </Stack>
                    }
                    secondary={
                      <>
                        {ticket.eventName}
                        {ticket.activityName ? ` · ${ticket.activityName}` : ''}
                        {` · ${ticket.ticketReference}`}
                      </>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
      ))}
    </Container>
  );
};

export default MyTicketsPage;
