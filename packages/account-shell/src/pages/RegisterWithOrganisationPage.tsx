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
import { PoweredBy } from '../components/PoweredBy';
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
      /*
       * Re-resolve before leaving. The shell still holds `not-connected` for
       * this club, and the destination is keyed on the same `orgCode`, so
       * navigating first would land on the not-connected screen rather than the
       * club's home page.
       *
       * Its own try: the member is already joined by this point, and a failure
       * to re-read the shell's state is not a failure to join. Reporting it as
       * one would tell them it had not worked when it had.
       */
      try {
        await refresh();
      } catch {
        // Nothing to do — the destination resolves the organisation itself.
      }

      /*
       * Then go, rather than offering a "Continue" button.
       *
       * The button could not survive the refresh it depends on: re-resolving
       * puts the shell briefly into `loading`, `OrganisationRoute` swaps this
       * screen for a spinner, and the page remounts afterwards with its
       * `outcome` reset — dropping the member back on the join form with no
       * sign that anything had happened. Landing on the club's own home page is
       * both the confirmation and the thing they were trying to reach.
       *
       * `replace`, so Back returns to wherever they came from rather than to a
       * join form for a club they have already joined.
       */
      navigate(result.outcome === 'active' ? `/${orgCode}` : `/${orgCode}/pending`, {
        replace: true,
      });
    } catch {
      setFailed(t('register.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [executeRegister, navigate, orgCode, refresh, t]);

  const name = organisation?.displayName || orgCode || '';

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h1" gutterBottom>
          {t('register.title', { organisation: name })}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('register.body', { organisation: name })}
        </Typography>

        {/*
          Said plainly, and on its own line rather than buried in the paragraph
          above: a member who reads connecting as having joined and paid finds
          out otherwise at the gate, which is the worst possible moment.
        */}
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('register.notAMembership')}
        </Alert>

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

      {/*
        Outside the Paper, under it — the same placement as the login pages, so
        a member who arrives here from one does not see the attribution move.

        The year is read at render rather than written into the translations:
        a hard-coded one is correct until the 1st of January and then quietly
        wrong on every page of the product until somebody notices.
      */}
      <PoweredBy />
    </Container>
  );
};

export default RegisterWithOrganisationPage;
