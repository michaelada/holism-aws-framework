import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { formatDisplayDate } from '@itsplainsailing/components';
import ActivityStatusChip from '../components/ActivityStatusChip';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountRegistration } from '../types/account';

/**
 * C6 — what the member has registered.
 *
 * **The thing is the headline**, not the scheme: a member with three horses is
 * looking for "Rocket", and "Horse registration 2026" is what Rocket is
 * registered under. The club's own word for the thing labels it, so the same
 * screen reads correctly for a boat club and a pony club.
 *
 * Two statuses again, as C8 has: the shared chip answers "have I paid?", and
 * the club's own status answers "has it been approved?" — a registration
 * awaiting review is paid for and not yet in force, which one word cannot say.
 */
export const MyRegistrationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountRegistration[]>();

  const [registrations, setRegistrations] = useState<AccountRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setRegistrations((await execute({ url: `/api/account/${orgCode}/registrations` })) ?? []);
    } catch {
      setFailed(true);
      setRegistrations([]);
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
        {t('registrations.title')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('registrations.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : registrations.length === 0 && !failed ? (
        <Card>
          <CardContent>
            <Typography gutterBottom>{t('registrations.empty')}</Typography>
            <Button
              variant="contained"
              onClick={() => navigate(`/${orgCode}/register-interest`)}
              sx={{ mt: 1 }}
            >
              {t('registrations.browseAction')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {registrations.map((registration) => (
            <Card key={registration.id}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                >
                  <Box>
                    <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                      {registration.entityName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {registration.entityLabel} · {registration.typeName}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ActivityStatusChip status={registration.status} />
                    {/*
                      Only worth a chip while it means something. "Active" beside
                      "Confirmed" is the same news twice; "Awaiting approval" is
                      news the payment chip cannot carry.
                    */}
                    {registration.registrationStatus === 'pending' && (
                      <Chip size="small" variant="outlined" label={t('registrations.pending')} />
                    )}
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    <Box component="span" color="text.secondary">
                      {t('registrations.number')}:{' '}
                    </Box>
                    {registration.registrationNumber}
                  </Typography>

                  {registration.validUntil && (
                    <Typography variant="body2">
                      <Box component="span" color="text.secondary">
                        {t('registrations.validUntilLabel')}:{' '}
                      </Box>
                      {formatDisplayDate(registration.validUntil, locale)}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
};

export default MyRegistrationsPage;
