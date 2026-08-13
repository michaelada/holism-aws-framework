import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Container,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountMembership } from '../types/account';
import { toMemberships } from '../utils/accountMemberships';

/**
 * A7 — Organisation switcher. Route `/switch`.
 *
 * Switching is a client-side context change plus a URL change, **not** a
 * re-authentication: the Keycloak token is realm-wide, so the same token serves
 * every organisation the member belongs to. Navigating changes `orgCode`, which
 * re-resolves the context, and with it the capabilities, menu, theme and locale.
 *
 * Pending and rejected memberships are listed too. Hiding them would make an
 * organisation appear to have vanished, when in fact it is waiting on the club.
 */
export const OrganisationSwitcherPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountMembership[]>();

  const [memberships, setMemberships] = useState<AccountMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    execute({ url: '/api/account/organisations' })
      .then((response) => setMemberships(toMemberships(response)))
      .catch(() => setMemberships([]))
      .finally(() => setLoading(false));
  }, [execute]);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      <Typography variant="h1" gutterBottom>
        {t('switcher.title')}
      </Typography>

      <Paper sx={{ mt: 2 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress aria-label={t('common.loading')} />
          </Stack>
        ) : memberships.length === 0 ? (
          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography>{t('switcher.empty')}</Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
              {t('switcher.findClub')}
            </Button>
          </Stack>
        ) : (
          <List>
            {memberships.map((membership) => (
              <ListItemButton
                // urlCode, not organisationId: the endpoint returns the public
                // shape, which has no ids — so organisationId was undefined and
                // every row shared the same key.
                key={membership.urlCode}
                selected={membership.urlCode === orgCode}
                onClick={() => navigate(`/${membership.urlCode}`)}
              >
                <ListItemAvatar>
                  {/* The initial remains the fallback for a club with no logo,
                      and for one whose signed URL has expired. */}
                  <Avatar
                    src={membership.branding?.logoUrl || undefined}
                    alt={membership.displayName}
                  >
                    {membership.displayName.charAt(0)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={membership.displayName}
                  secondary={t(`switcher.status.${membership.status}`, {
                    defaultValue: membership.status,
                  })}
                />
                {membership.urlCode === orgCode && (
                  <Chip size="small" label={t('switcher.current')} />
                )}
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default OrganisationSwitcherPage;
