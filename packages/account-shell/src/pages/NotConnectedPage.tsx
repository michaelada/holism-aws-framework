import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Container, Paper, Stack, Typography } from '@mui/material';

/**
 * A6 — Not connected to this organisation.
 *
 * Authentication succeeded but no `organization_users` row exists for this club.
 * This is the "otherwise they should be redirected to a registration page"
 * branch of the brief, and the offer is to request a connection rather than to
 * sign in again — signing in again would land in exactly the same place.
 */
export const NotConnectedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useParams<{ orgCode: string }>();

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
        </Stack>
      </Paper>
    </Container>
  );
};

export default NotConnectedPage;
