import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAuthContext } from '../context/AuthContext';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';

/**
 * A2 — Organisation Gateway. Route `/:orgCode` for a signed-out visitor.
 *
 * This is the screen behind a club's own short link, so it is branded from the
 * organisation's public record and reached with no session. An unknown code
 * renders the not-found variant offering the directory, rather than a bare 404 —
 * a mistyped or stale club link is the most likely way to arrive here.
 *
 * A visitor who already has a session never sees this: the router resolves them
 * straight to the app.
 */
export const OrganisationGatewayPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useParams<{ orgCode: string }>();
  const { login, register } = useAuthContext();

  /**
   * The public record comes from the context, which fetches it for every
   * organisation to brand the shell. Refetching it here would double the
   * request and let the gateway and the theme disagree about the same club.
   */
  const { publicLoading, publicDetail: organisation } = useAccountOrganisation();

  /*
   * `displayName` rather than the object alone. A truthy `publicDetail` that is
   * not the club's record — a 200 from something other than the API — passes an
   * existence check and then throws on `displayName.charAt(0)`, turning a
   * mistyped-club-code screen into a blank page. The not-found variant is the
   * right answer for both: we do not have this club's details.
   */
  const notFound = !publicLoading && !organisation?.displayName;

  if (publicLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (notFound || !organisation) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
          <Typography variant="h1" gutterBottom>
            {t('gateway.notFound.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {t('gateway.notFound.body')}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')}>
            {t('gateway.notFound.action')}
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
        <Avatar
          src={organisation.branding?.logoUrl}
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 2,
            bgcolor: organisation.branding?.primaryColor || 'primary.main',
          }}
        >
          {organisation.displayName.charAt(0)}
        </Avatar>

        <Typography variant="h1" gutterBottom>
          {organisation.displayName}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('gateway.signInPrompt')}
        </Typography>

        <Stack spacing={2}>
          <Button variant="contained" size="large" onClick={() => login(orgCode)}>
            {t('gateway.signIn')}
          </Button>

          {organisation.registrationOpen ? (
            <Button variant="outlined" size="large" onClick={() => register(orgCode)}>
              {t('gateway.register')}
            </Button>
          ) : (
            // Not an error — a deliberate club setting, so it reads as
            // information rather than as something the visitor did wrong.
            <Alert severity="info">{t('gateway.registrationClosed')}</Alert>
          )}

          <Button onClick={() => navigate('/')}>{t('gateway.browseAll')}</Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default OrganisationGatewayPage;
