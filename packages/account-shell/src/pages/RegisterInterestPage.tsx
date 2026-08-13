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
  Stack,
  Typography,
} from '@mui/material';
import { formatCurrency, formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CatalogueRegistrationType } from '../types/account';

/**
 * D7 — what the club will register.
 *
 * **A registration is of a thing, not of a person.** The club names the thing —
 * a horse, a boat, a dog — in `entityName`, and this screen uses that word
 * rather than a generic one: "Register a horse" is an instruction, "Register"
 * is a puzzle.
 *
 * Holding one is no bar to another, unlike a membership: a member with two
 * horses registers twice, so nothing here is hidden once used.
 */
export const RegisterInterestPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, me } = useAccountOrganisation();
  const { execute } = useAccountApi<CatalogueRegistrationType[]>();

  const [types, setTypes] = useState<CatalogueRegistrationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setTypes(
        (await execute({ url: `/api/account/${orgCode}/catalogue/registration-types` })) ?? []
      );
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
        {t('registrations.browseTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('registrations.browseSubtitle')}
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
      ) : types.length === 0 && !failed ? (
        <Alert severity="info">{t('registrations.browseEmpty')}</Alert>
      ) : (
        <Stack spacing={2}>
          {types.map((type) => (
            <Card key={type.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                      {type.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('registrations.registers', { entity: type.entityName })}
                    </Typography>
                  </Box>
                  {!type.available && <Chip size="small" label={t('registrations.closed')} />}
                </Stack>

                {type.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {type.description}
                  </Typography>
                )}

                <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap">
                  {/*
                    How long it lasts is the question a member asks next, and it
                    is answered two different ways: a rolling scheme runs from
                    the day it is taken out, a fixed one ends on a date.
                  */}
                  <Typography variant="caption" color="text.secondary">
                    {type.isRollingRegistration && type.numberOfMonths
                      ? t('registrations.runsForMonths', { count: type.numberOfMonths })
                      : type.validUntil
                        ? t('registrations.validUntil', {
                            date: formatDisplayDate(type.validUntil, locale),
                          })
                        : t('registrations.noEndDate')}
                  </Typography>

                  {/*
                    Whether the club looks at it first. A member who pays and
                    then waits should be told before paying, not after.
                  */}
                  {!type.automaticallyApprove && (
                    <Typography variant="caption" color="text.secondary">
                      {t('registrations.needsApproval')}
                    </Typography>
                  )}
                </Stack>

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 2 }}
                >
                  <Typography variant="h6">
                    {type.fee > 0
                      ? formatCurrency(type.fee / 100, currency, locale)
                      : t('registrations.free')}
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={!type.available}
                    onClick={() => navigate(`/${orgCode}/register-interest/${type.id}`)}
                  >
                    {t('registrations.registerEntity', { entity: type.entityName })}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
};

export default RegisterInterestPage;
