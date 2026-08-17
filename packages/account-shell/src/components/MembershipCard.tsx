import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import { formatDisplayDate } from '@aws-web-framework/components';
import { AccountDashboard } from '../types/account';

type Membership = NonNullable<AccountDashboard['memberships']>[number];

/**
 * One membership on the home screen, in the same shape as a what's-on teaser.
 *
 * **The member's name leads, the type is the subtitle.** A parent holds their
 * children's memberships, so a row headed by the type is four cards reading
 * "Junior Member" that differ only by a number nobody recognises.
 *
 * **Renewal lives on the card, not in a banner over the page.** With several
 * memberships in play a banner has to pick one to be about, and naming one
 * child while three other cards sit below it says less than a button on the
 * card that needs it. The two states are kept apart, as C4 does: `canRenew`
 * gets the button, and due-but-nothing-published gets a note instead of a
 * button that leads nowhere.
 */
export const MembershipCard: React.FC<{
  membership: Membership;
  locale: string;
  onRenew: () => void;
  onOpen: () => void;
}> = ({ membership, locale, onRenew, onOpen }) => {
  const { t } = useTranslation();
  const remaining = membership.daysRemaining;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/*
        The whole card opens My Memberships, rather than a "View memberships"
        link repeated inside every one of them. With four cards in the row that
        link appeared four times and said the same thing each time, while the
        obvious target — the card itself — did nothing.

        `CardActionArea` rather than an onClick on the Card, so it is a real
        button: reachable by keyboard, announced as one, and with the ripple and
        hover that tell a mouse user it can be pressed.
      */}
      <CardActionArea
        onClick={onOpen}
        sx={{ flexGrow: 1, alignItems: 'stretch', justifyContent: 'flex-start' }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1.5}>
          <Box
            aria-hidden
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'action.hover',
            }}
          >
            <CardMembershipIcon color="primary" />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600}>
              {membership.memberName || membership.name}
            </Typography>
            {membership.memberName && (
              <Typography variant="body2" color="text.secondary">
                {membership.name}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('home.membershipUntil', {
                date: formatDisplayDate(membership.validUntil, locale),
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('home.membershipNumber', { number: membership.membershipNumber })}
            </Typography>
          </Box>
        </Stack>

        {/*
          A countdown only when it is close enough to matter. A membership with
          eight months left does not need one, and a lapsed one needs saying
          differently — "expires in -6 days" is what a naive countdown produces.
        */}
        {remaining !== null && remaining >= 0 && remaining <= 30 && (
          <Chip
            size="small"
            color="warning"
            label={t('memberships.expiresIn', { count: remaining })}
            sx={{ mt: 1 }}
          />
        )}
        {remaining !== null && remaining < 0 && (
          <Chip
            size="small"
            color="error"
            label={t('memberships.expired', { count: Math.abs(remaining) })}
            sx={{ mt: 1 }}
          />
        )}
        </CardContent>
      </CardActionArea>

      {/*
        Renewal stays outside the action area. It is a different destination
        from the card's own, and nesting a button inside a button is invalid
        markup that browsers resolve by firing both.

        Nothing is rendered when there is neither a renewal nor a note: the row
        used to hold a "View memberships" button there, which is now the card.
      */}
      {(membership.canRenew || membership.renewalNotOpen) && (
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
          {membership.canRenew && (
            <Button size="small" variant="contained" onClick={onRenew}>
              {t('home.renew')}
            </Button>
          )}
          {membership.renewalNotOpen && (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {t('home.renewalNotOpen')}
            </Typography>
          )}
        </Stack>
      )}
    </Card>
  );
};

export default MembershipCard;
