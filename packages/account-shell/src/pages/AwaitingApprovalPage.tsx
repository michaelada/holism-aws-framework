import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PoweredBy } from '../components/PoweredBy';
import { SignedInAs } from '../components/SignedInAs';
import { useAuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountMembership } from '../types/account';
import { toMemberships } from '../utils/accountMemberships';

/**
 * A8 — Awaiting approval, and its rejected / inactive variants.
 *
 * Reached when authentication succeeded but the member has no usable
 * `organization_users` row for this club. All three states are terminal for the
 * user in this organisation, so they share a screen and differ only in wording
 * and in whether re-checking is worth offering.
 *
 * The "other organisations" strip exists to prevent a dead end: a multi-org
 * member stuck behind one club's approval queue would otherwise have no way
 * through to a club they already belong to. It is omitted when there are none.
 */
export const AwaitingApprovalPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useParams<{ orgCode: string }>();
  const { signInAsSomeoneElse, logout } = useAuthContext();
  const { state, refresh } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountMembership[]>();

  const [others, setOthers] = useState<AccountMembership[]>([]);
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  useEffect(() => {
    execute({ url: '/api/account/organisations' })
      .then((response) =>
        setOthers(
          toMemberships(response).filter(
            (m) => m.urlCode !== orgCode && m.status === 'active'
          )
        )
      )
      .catch(() => setOthers([]));
  }, [execute, orgCode]);

  /**
   * Re-resolves rather than reloading the page, so an approval granted a minute
   * ago is picked up without a sign-out/sign-in cycle.
   *
   * The notice is driven by what `refresh` returns, not by reading `state`
   * afterwards — `state` in this closure is the previous render's value.
   */
  const checkAgain = useCallback(async () => {
    setChecking(true);
    setStillPending(false);
    const resolved = await refresh();
    setChecking(false);
    setStillPending(resolved === 'pending');
  }, [refresh]);

  const isRejected = state === 'rejected';
  const isInactive = state === 'inactive';
  const titleKey = isRejected ? 'rejected.title' : isInactive ? 'inactive.title' : 'pending.title';
  const bodyKey = isRejected ? 'rejected.body' : isInactive ? 'inactive.body' : 'pending.body';

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h1" gutterBottom>
          {t(titleKey)}
        </Typography>

        {/*
          Who is waiting, named. A person can reach this screen as an identity
          the realm session chose for them rather than one they typed, and
          "awaiting approval" reads as the club being slow when it is really the
          wrong account in the queue. See `SignedInAs`.
        */}
        <SignedInAs />

        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t(bodyKey, { organisation: orgCode })}
        </Typography>

        {/*
          The two-line status block makes both gates visible. It matters when a
          member has verified their email and cannot understand why they are
          still locked out — without it, the second gate is invisible.
        */}
        {!isRejected && !isInactive && (
          <>
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2">{t('pending.statusEmail')}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <HourglassEmptyIcon color="warning" fontSize="small" />
                <Typography variant="body2">{t('pending.statusApproval')}</Typography>
              </Stack>
            </Stack>

            {stillPending && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('pending.stillPending')}
              </Alert>
            )}

            <Button variant="contained" onClick={checkAgain} disabled={checking}>
              {checking ? t('pending.checking') : t('pending.checkAgain')}
            </Button>
          </>
        )}

        {/*
          * Rendered outside `AppShell`, so this screen has no navigation and no
          * sign-out of its own. Without this a member waiting on one club's
          * approval could not become anybody else — and because Keycloak's
          * session is realm-wide, signing in again returned them here
          * unchanged.
          */}
        <Box sx={{ mt: 3 }}>
          <Button onClick={() => signInAsSomeoneElse(orgCode)}>
            {t('common.signInAsSomeoneElse')}
          </Button>
          {/* Specified by wireframe A8 and never implemented. */}
          <Button onClick={logout}>{t('common.signOut')}</Button>
        </Box>

        {others.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('pending.otherOrganisations')}
            </Typography>
            <List dense>
              {others.map((membership) => (
                <ListItemButton
                  key={membership.organisationId}
                  onClick={() => navigate(`/${membership.urlCode}`)}
                >
                  <ListItemText primary={membership.displayName} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}
      </Paper>

      <PoweredBy />
    </Container>
  );
};

export default AwaitingApprovalPage;
