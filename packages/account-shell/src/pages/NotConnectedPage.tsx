import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Container, Paper, Stack, Typography } from '@mui/material';
import { useAuthContext } from '../context/AuthContext';

/**
 * A6 — Not connected to this organisation.
 *
 * Authentication succeeded but no `organization_users` row exists for this club.
 * This is the "otherwise they should be redirected to a registration page"
 * branch of the brief, and the offer is to request a connection rather than to
 * sign in again — signing in again as *this* member would land in exactly the
 * same place.
 *
 * Signing in as a **different** member would not, and that route has to exist
 * here. This screen renders outside `AppShell`, so it carries no navigation and
 * no sign-out; a member who opened a club they do not belong to had no way to
 * become anybody else, and Keycloak's realm session meant an ordinary sign-in
 * returned them here as themselves. The portal looked stuck on an identity they
 * had already left.
 */
export const NotConnectedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useParams<{ orgCode: string }>();
  const { signInAsSomeoneElse, logout } = useAuthContext();

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h1" gutterBottom>
          {t('notConnected.title', { organisation: orgCode })}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('notConnected.body')}
        </Typography>

        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate(`/${orgCode}/register`)}
          >
            {t('notConnected.register')}
          </Button>
          <Button onClick={() => navigate('/switch')}>{t('notConnected.switch')}</Button>
          <Button onClick={() => signInAsSomeoneElse(orgCode)}>
            {t('common.signInAsSomeoneElse')}
          </Button>
          {/* Specified by wireframe A6 and never implemented. */}
          <Button onClick={logout}>{t('common.signOut')}</Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default NotConnectedPage;
