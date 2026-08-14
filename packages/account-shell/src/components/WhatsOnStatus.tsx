import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, Stack, Typography } from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import GroupIcon from '@mui/icons-material/Group';
import { formatOrdinalDateTime } from '@aws-web-framework/components';
import { capacityFor, entryWindowFor } from '../utils/entryWindow';
import { DashboardWhatsOn } from '../types/account';

/** The one thing a member needs to know at a glance about entering. */
export type WhatsOnState = 'open' | 'opening-soon' | 'closing-soon' | 'closed' | 'full';

/**
 * Where a teaser sits, as a single state.
 *
 * `full` outranks the window, because a full event is not enterable however
 * open it is — but only while the window is still running. Once entries close,
 * "closed" is the honest answer and "full" would be a detail about a door that
 * is shut anyway.
 */
export function whatsOnStateFor(item: DashboardWhatsOn, now?: Date): WhatsOnState | null {
  /*
   * Nothing to say about a thing with no window and no cap — a polo shirt is
   * not "open". Loose equality on purpose: an older payload omits these fields
   * rather than sending null, and a strict check would let every shirt through
   * to be labelled open.
   */
  if (!item.entriesOpenDate && !item.entriesClosingDate && item.placesRemaining == null) {
    return null;
  }

  const window = entryWindowFor(item, now);

  if (window.state === 'closed') return 'closed';
  if (window.state === 'not-open') return 'opening-soon';

  const capacity = capacityFor(item);
  if (capacity.state === 'full') return 'full';

  if (window.state === 'opening-soon') return 'opening-soon';
  if (window.state === 'closing-soon') return 'closing-soon';
  return 'open';
}

const APPEARANCE: Record<
  WhatsOnState,
  { colour: 'success' | 'info' | 'warning' | 'default' | 'error'; icon: React.ReactElement }
> = {
  open: { colour: 'success', icon: <EventAvailableIcon /> },
  'opening-soon': { colour: 'info', icon: <HourglassTopIcon /> },
  // Warning, not error: entries are open, and this is urgency rather than a refusal.
  'closing-soon': { colour: 'warning', icon: <HourglassTopIcon /> },
  closed: { colour: 'default', icon: <EventBusyIcon /> },
  full: { colour: 'error', icon: <GroupIcon /> },
};

/**
 * The entry state of a what's-on teaser: one chip, and the moment it turns on.
 *
 * Deliberately smaller than `EntryStatus`, which the browse page uses: that one
 * also weighs capacity — "12 of 50 places left" — because a member choosing
 * between events is judging their chances. Here they are glancing at a card
 * whose job is to get them to the listing, so it answers only *what state* and
 * *by when*, and a row of four cards stays readable.
 *
 * The states themselves come from `entryWindowFor`, the same rules the browse
 * page phrases at length, so the two screens can never disagree about whether
 * an event is open.
 */
export const WhatsOnStatus: React.FC<{ item: DashboardWhatsOn; now?: Date }> = ({
  item,
  now,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const state = whatsOnStateFor(item, now);

  if (!state) return null;

  const { colour, icon } = APPEARANCE[state];

  /*
   * The moment itself, beneath the chip.
   *
   * A chip compresses: "Closing soon" is the right thing to notice first, but a
   * member planning around a deadline needs to know *when*. Times are shown and
   * not just dates, because a closing at 09:00 is a different thing to plan
   * around than one at 23:59 — "closes 20 August" for a deadline that passes
   * before breakfast is the kind of omission you only notice once you have
   * missed it.
   *
   * Which moment depends on the state. Before entries open, both matter: when
   * can I enter, and how long will I have. Once open, the opening date is
   * history and only the deadline earns the line.
   */
  const details: string[] = [];

  if (state === 'opening-soon' && item.entriesOpenDate) {
    details.push(
      t('browse.entries.opensDetail', {
        date: formatOrdinalDateTime(item.entriesOpenDate, locale),
      })
    );
  }

  if (item.entriesClosingDate) {
    details.push(
      state === 'closed'
        ? t('browse.entries.closed', {
            date: formatOrdinalDateTime(item.entriesClosingDate, locale),
          })
        : t('browse.entries.closesDetail', {
            date: formatOrdinalDateTime(item.entriesClosingDate, locale),
          })
    );
  }

  return (
    <Stack spacing={0.5}>
      <Box>
        <Chip
          size="small"
          icon={icon}
          color={colour}
          variant={state === 'closed' ? 'filled' : 'outlined'}
          label={t(`home.status.${state}`)}
        />
      </Box>

      {details.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {details.map((detail) => (
            <Typography key={detail} variant="caption" color="text.secondary">
              {detail}
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default WhatsOnStatus;
