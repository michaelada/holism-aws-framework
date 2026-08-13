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
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountMembershipRecord } from '../types/account';

/**
 * C4 — My Memberships. Route `/:orgCode/memberships`.
 *
 * The renewal rule is the substance of this screen. A Renew button appears only
 * when the membership is active, inside its 30-day window, **and** the club has
 * a membership type open to renew into. The backend evaluates all three and
 * distinguishes the third case explicitly, so this screen can say "renewals are
 * not open yet" instead of offering a button that leads nowhere.
 */
export const MyMembershipsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountMembershipRecord[]>();

  const [memberships, setMemberships] = useState<AccountMembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setMemberships(await execute({ url: `/api/account/${orgCode}/memberships` }));
    } catch {
      setFailed(true);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('memberships.title')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('memberships.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : memberships.length === 0 ? (
        !failed && (
          <Stack spacing={1} sx={{ py: 4 }}>
            <Typography>{t('memberships.empty')}</Typography>
            <Typography color="text.secondary">{t('memberships.emptyHint')}</Typography>
          </Stack>
        )
      ) : (
        <Grid container spacing={2}>
          {memberships.map((membership) => (
            <Grid item xs={12} md={6} key={membership.id}>
              <MembershipCard
                membership={membership}
                locale={i18n.language}
                /*
                 * The membership catalogue, which now offers a renewal rather
                 * than refusing it: a type the member holds and is within 30
                 * days of losing comes back available and marked `isRenewal`.
                 * This used to point at `/join`, a route that never existed.
                 */
                onRenew={() => navigate(`/${orgCode}/browse/memberships`)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

const MembershipCard: React.FC<{
  membership: AccountMembershipRecord;
  locale: string;
  onRenew: () => void;
}> = ({ membership, locale, onRenew }) => {
  const { t } = useTranslation();
  const remaining = membership.daysRemaining;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {membership.membershipTypeName}
          </Typography>
          <Chip
            size="small"
            label={t(`switcher.status.${membership.status}`, {
              defaultValue: membership.status,
            })}
            color={membership.status === 'active' ? 'success' : 'default'}
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {t('memberships.number')}: {membership.membershipNumber}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('memberships.validUntil')}: {formatDisplayDate(membership.validUntil, locale)}
        </Typography>

        {/*
          Days remaining is shown only when it is close enough to matter. A
          membership with eight months left does not need a countdown, and one
          that has lapsed needs saying differently — "expires in -6 days" is
          nonsense a naive countdown would produce.
        */}
        {remaining !== null && remaining >= 0 && remaining <= 30 && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            {t('memberships.expiresIn', { count: remaining })}
          </Typography>
        )}
        {remaining !== null && remaining < 0 && (
          <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
            {t('memberships.expired', { count: Math.abs(remaining) })}
          </Typography>
        )}

        {(membership.canRenew || membership.renewalNotOpen) && (
          <>
            <Divider sx={{ my: 2 }} />
            {membership.canRenew ? (
              <Button variant="contained" onClick={onRenew}>
                {t('memberships.renew')}
              </Button>
            ) : (
              // Due, but nothing published to renew into. Saying so is the
              // whole point of the third condition in the rule.
              <Typography variant="body2" color="text.secondary">
                {t('memberships.renewalNotOpen')}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MyMembershipsPage;
