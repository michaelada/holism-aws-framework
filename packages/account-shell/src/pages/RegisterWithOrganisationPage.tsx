import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { PublicOrganisationDetail } from '../types/account';

/** What `POST /api/account/:orgCode/register` returns. */
interface RegisterResult {
  outcome: 'active' | 'pending';
  organisationUserId: string;
}

/**
 * A4 — Register with organisation. Route `/:orgCode/register`.
 *
 * Identity already exists at this point — Keycloak owns that. What this creates
 * is the `organization_users` connection, which is why the copy is careful to
 * say it does not buy a membership: applying for one is a separate, paid flow.
 *
 * Whether the member lands `active` or `pending` is the club's auto-registration
 * setting, not anything the member chooses, so the outcome is read from the
 * response rather than predicted before submitting.
 */
export const RegisterWithOrganisationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useParams<{ orgCode: string }>();
  const { refresh } = useAccountOrganisation();

  const { execute: executePublic } = useAccountApi<PublicOrganisationDetail>();
  const { execute: executeRegister } = useAccountApi<RegisterResult>();

  const [organisation, setOrganisation] = useState<PublicOrganisationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<RegisterResult['outcome'] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!orgCode) return;
    executePublic({ url: `/api/public/organisations/${orgCode}`, anonymous: true })
      .then(setOrganisation)
      .catch(() => setOrganisation(null))
      .finally(() => setLoading(false));
  }, [executePublic, orgCode]);

  const submit = useCallback(async () => {
    if (!orgCode) return;
    setSubmitting(true);
    setFailed(null);
    try {
      const result = await executeRegister({
        method: 'POST',
        url: `/api/account/${orgCode}/register`,
      });
      setOutcome(result.outcome);
      // An `active` outcome means the shell can now resolve this organisation,
      // so the context is re-resolved before the member continues — otherwise
      // "Continue" would land on a screen still holding the not-connected state.
      await refresh();
    } catch {
      setFailed(t('register.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [executeRegister, orgCode, refresh, t]);

  const name = organisation?.displayName || orgCode || '';

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Container>
    );
  }

  if (outcome) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h1" gutterBottom>
            {t('register.submitted.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {outcome === 'active'
              ? t('register.submitted.bodyAuto', { organisation: name })
              : t('register.submitted.bodyApproval')}
          </Typography>
          <Button
            variant="contained"
            onClick={() =>
              navigate(outcome === 'active' ? `/${orgCode}` : `/${orgCode}/pending`)
            }
          >
            {t('register.submitted.continue')}
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h1" gutterBottom>
          {t('register.title', { organisation: name })}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('register.body', { organisation: name })}
        </Typography>

        {failed && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {failed}
          </Alert>
        )}

        <Stack spacing={2}>
          <Button variant="contained" size="large" onClick={submit} disabled={submitting}>
            {submitting ? t('register.submitting') : t('register.submit')}
          </Button>
          <Button onClick={() => navigate('/')} disabled={submitting}>
            {t('common.cancel')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default RegisterWithOrganisationPage;
