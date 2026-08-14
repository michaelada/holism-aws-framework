import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { CalendarIcon } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CatalogueCalendar } from '../types/account';

/**
 * D11 — what the club has to book.
 *
 * A list, not a grid: a calendar is a court or a mooring, identified by its
 * name and its rules rather than by a picture, and the rules are what a member
 * needs before choosing — how much notice the club wants, how far ahead it will
 * take a booking, and whether a booking can be cancelled.
 *
 * Availability is deliberately not here. Working it out means reading a
 * calendar's whole schedule, its blocked periods and every booking on it; doing
 * that for every calendar to draw a list would make the list slower than the
 * screen it leads to.
 */
export const BookPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<CatalogueCalendar[]>();

  const [calendars, setCalendars] = useState<CatalogueCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setCalendars((await execute({ url: `/api/account/${orgCode}/catalogue/calendars` })) ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('book.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('book.subtitle')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('book.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : calendars.length === 0 && !failed ? (
        <Alert severity="info">{t('book.empty')}</Alert>
      ) : (
        <Stack spacing={2}>
          {calendars.map((calendar) => (
            <Card key={calendar.id}>
              <CardActionArea
                onClick={() => navigate(`/${orgCode}/book/${calendar.id}`)}
                disabled={!calendar.available}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {/*
                        The club's own icon and colour for this resource,
                        carried across from the org-admin calendar so the two
                        read as the same thing.

                        An icon rather than a bare colour swatch: a column of
                        coloured bars asks the member to remember which colour
                        means the arena, where a racket or a stable says it
                        outright. Calendars with no icon chosen still get the
                        generic calendar mark, so the column stays even.
                      */}
                      <Box
                        aria-hidden
                        sx={{
                          width: 44,
                          height: 44,
                          flexShrink: 0,
                          borderRadius: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: calendar.displayColour
                            ? `${calendar.displayColour}1f`
                            : 'action.hover',
                        }}
                      >
                        <CalendarIcon
                          name={calendar.displayIcon}
                          colour={calendar.displayColour}
                        />
                      </Box>
                      <Box>
                        <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                          {calendar.name}
                        </Typography>
                        {calendar.description && (
                          <Typography variant="body2" color="text.secondary">
                            {calendar.description}
                          </Typography>
                        )}
                      </Box>
                    </Stack>

                    {!calendar.available && <Chip size="small" label={t('book.notBookable')} />}
                  </Stack>

                  {calendar.available && (
                    <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap">
                      {calendar.minDaysInAdvance > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {t('book.noticeRequired', { count: calendar.minDaysInAdvance })}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {t('book.bookableAhead', { count: calendar.maxDaysInAdvance })}
                      </Typography>
                      {calendar.allowCancellations && (
                        <Typography variant="caption" color="text.secondary">
                          {calendar.cancelDaysInAdvance
                            ? t('book.cancellableUntil', { count: calendar.cancelDaysInAdvance })
                            : t('book.cancellable')}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
};

export default BookPage;
