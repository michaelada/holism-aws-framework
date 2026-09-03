import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import { CalendarIcon, EventDateTile, formatCurrency } from '@itsplainsailing/components';
import WhatsOnStatus from './WhatsOnStatus';
import { DashboardWhatsOn } from '../types/account';

/**
 * One teaser on the home screen, for anything a club is offering.
 *
 * Extracted from `HomePage` when bookings moved into their own row: the same
 * card serves both sections, and two copies would have drifted the moment one
 * of them changed.
 *
 * **What leads the card depends on what the thing is.** A dated thing leads
 * with its date, because a row of events is scanned for *when*. A calendar
 * leads with its icon in its own colour, because a row of them is scanned for
 * *which* — a court, an arena and a clubhouse are not interchangeable, and
 * colour alone does not carry that. A product leads with a thumbnail of itself,
 * which is the thing a shopper recognises before any word on the card.
 * Everything else leads with its name.
 */
export const WhatsOnCard: React.FC<{
  item: DashboardWhatsOn;
  currency: string;
  locale: string;
  onOpen: () => void;
  /**
   * Whether to caption the card with what kind of thing it is.
   *
   * Off in a row that already says so — "Shop" above a grid of cards each
   * captioned "Shop" is the same word twice, and the caption is the one that
   * can go.
   */
  showKind?: boolean;
}> = ({ item, currency, locale, onOpen, showKind = true }) => {
  const { t } = useTranslation();

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={onOpen} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent>
          <Stack direction="row" spacing={1.5}>
            {item.startDate && (
              <EventDateTile
                date={item.startDate}
                endDate={item.endDate}
                locale={locale}
                size="small"
              />
            )}

            {item.kind === 'merchandise' && item.imageUrl && (
              <Box
                component="img"
                src={item.imageUrl}
                alt=""
                sx={{
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  borderRadius: 1.5,
                  objectFit: 'cover',
                  backgroundColor: 'action.hover',
                }}
              />
            )}

            {item.kind === 'calendar' && (
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
                  // The calendar's own colour, faintly, so the icon sits on
                  // something rather than floating against the card.
                  backgroundColor: item.colour ? `${item.colour}1f` : 'action.hover',
                }}
              >
                <CalendarIcon name={item.icon} colour={item.colour} />
              </Box>
            )}

            <Box sx={{ minWidth: 0 }}>
              {showKind && (
                <Typography variant="caption" color="text.secondary">
                  {t(`home.kind.${item.kind}`)}
                </Typography>
              )}
              <Typography variant="body2" fontWeight={600}>
                {item.title}
              </Typography>
              {item.fee !== null && (
                <Typography variant="body2" color="text.secondary">
                  {item.fee > 0
                    ? formatCurrency(item.fee / 100, currency, locale)
                    : t('home.free')}
                </Typography>
              )}
            </Box>
          </Stack>

          {/*
            Beneath the name rather than beside it: a status chip on the same
            line competes with the title for the first thing read, and wraps
            badly in the narrow column this card sits in on a phone.
          */}
          <Box sx={{ mt: 1 }}>
            <WhatsOnStatus item={item} />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default WhatsOnCard;
