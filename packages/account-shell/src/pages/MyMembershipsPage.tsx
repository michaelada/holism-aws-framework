import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { formatDisplayDate, formatFormAnswer } from '@aws-web-framework/components';
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
                /*
                  Which membership is being renewed travels with them.
                  
                  A parent holds four, so the form at the end of this cannot
                  work out whose details to open with unless it is told. See
                  docs/MEMBERSHIP_RENEWAL_PREFILL.md.
                */
                onRenew={() =>
                  navigate(`/${orgCode}/browse/memberships?renew=${membership.id}`)
                }
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
        {/*
          The member's name leads, not the type.

          A parent holds their children's memberships, so a screen headed by the
          type shows three cards reading "Junior Member" that differ only by a
          number nobody recognises. Whose it is, is the thing being looked for;
          what kind it is, is the detail.
        */}
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6">
              {membership.memberName || membership.membershipTypeName}
            </Typography>
            {membership.memberName && (
              <Typography variant="body2" color="text.secondary">
                {membership.membershipTypeName}
              </Typography>
            )}
          </Box>
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

        {/*
          What the member actually filled in when they applied.

          The application form is the only record of what the club was told —
          the form itself is gone once the membership exists — so this is where
          a member checks the pony's name, the age group or the emergency
          contact they gave, and spots what needs correcting.

          Collapsed by default: it is reference material, and a card that opens
          fifteen rows of it buries the number and the expiry date that are the
          reason most people come to this screen. Nothing is rendered at all
          when the club's form asked nothing.
        */}
        {membership.formSummary?.length > 0 && (
          <Accordion
            elevation={0}
            disableGutters
            /*
              Unmounted while collapsed, rather than merely hidden. A member can
              hold several memberships and each form runs to a dozen or more
              answers, so the default would render a hundred hidden rows that
              nobody has asked to see — and leave them findable by search and by
              a screen reader walking the page.
            */
            TransitionProps={{ unmountOnExit: true }}
            sx={{ mt: 1.5, '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
              <Typography variant="body2" color="primary">
                {t('memberships.yourDetails', { count: membership.formSummary.length })}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Stack spacing={1}>
                {membership.formSummary.map((answer, index) => (
                  <Box key={`${answer.label}-${index}`}>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {answer.label}
                    </Typography>
                    {/*
                      `pre-wrap`, because a long answer to a textarea — medical
                      notes, say — was written with line breaks that mean
                      something to whoever reads it back.
                    */}
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {formatFormAnswer(answer, locale)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
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
