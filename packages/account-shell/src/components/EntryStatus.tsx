import React from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, Stack, Tooltip, Typography } from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import GroupIcon from '@mui/icons-material/Group';
import { formatOrdinalDateTime } from '@aws-web-framework/components';
import { capacityFor, entryWindowFor } from '../utils/entryWindow';
import { CatalogueActivity, CatalogueEvent } from '../types/account';

/**
 * The entry window and remaining places for an event, as chips.
 *
 * Two questions a member asks of a listing — *can I enter?* and *should I enter
 * now?* — and the answers come from different places. Whether entries are open
 * is the server's decision (`unavailableReason`); how much time or how many
 * places are left is arithmetic on dates and counts, done here.
 *
 * Times are shown, not just dates: `open_date_entries` and
 * `entries_closing_date` are timestamps, and a closing at 09:00 is a different
 * thing to plan around than one at 23:59. Showing "closes 20 August" for a
 * deadline that passes before breakfast is the kind of omission a member only
 * notices once they have missed it.
 *
 * Both are shown together so they cannot contradict each other on screen: an
 * event that is closed shows only that it is closed, never "closed" beside
 * "3 places left", which would read as an invitation to try anyway.
 */
export const EntryStatus: React.FC<{
  event: CatalogueEvent;
  /** Narrows capacity to one activity; omitted at event level. */
  activity?: CatalogueActivity | null;
  size?: 'small' | 'medium';
  now?: Date;
}> = ({ event, activity, size = 'small', now }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const window = entryWindowFor(event, now);
  const capacity = capacityFor(event, activity);

  const chips: React.ReactNode[] = [];

  switch (window.state) {
    case 'not-open':
      chips.push(
        <Chip
          key="window"
          size={size}
          icon={<EventBusyIcon />}
          color="default"
          variant="outlined"
          label={t('browse.entries.notOpen', {
            date: formatOrdinalDateTime(window.date, locale),
          })}
        />
      );
      break;

    case 'opening-soon':
      chips.push(
        <Chip
          key="window"
          size={size}
          icon={<HourglassTopIcon />}
          color="info"
          variant="outlined"
          label={
            window.days === 0
              ? t('browse.entries.openingToday')
              : t('browse.entries.openingSoon', {
                  count: window.days ?? 0,
                  date: formatOrdinalDateTime(window.date, locale),
                })
          }
        />
      );
      break;

    case 'closing-soon':
      chips.push(
        <Chip
          key="window"
          size={size}
          icon={<HourglassTopIcon />}
          // Warning, not error: entries are open, and this is urgency rather
          // than a refusal.
          color="warning"
          label={
            window.days === 0
              ? t('browse.entries.closingToday')
              : t('browse.entries.closingSoon', {
                  count: window.days ?? 0,
                  date: formatOrdinalDateTime(window.date, locale),
                })
          }
        />
      );
      break;

    case 'closed':
      chips.push(
        <Chip
          key="window"
          size={size}
          icon={<EventBusyIcon />}
          color="default"
          label={t('browse.entries.closed', {
            date: formatOrdinalDateTime(window.date, locale),
          })}
        />
      );
      break;

    case 'open':
    default:
      if (window.date) {
        chips.push(
          <Chip
            key="window"
            size={size}
            icon={<EventAvailableIcon />}
            color="success"
            variant="outlined"
            label={t('browse.entries.open', {
              date: formatOrdinalDateTime(window.date, locale),
            })}
          />
        );
      }
      break;
  }

  /*
   * How capacity reads depends on the window.
   *
   *  - **Before entries open** it is the size of the field, not an inventory
   *    count: "20 places left" implies a race that has not started, and the
   *    number will have moved by the time it does. "Limit: 20 places" says the
   *    same fact without the false urgency.
   *  - **While open** the remainder is what matters, and it is live.
   *  - **Once closed** neither is shown: "entries closed" beside "2 places
   *    left" invites a member to keep trying at something they cannot have.
   */
  const notYetOpen = window.state === 'not-open' || window.state === 'opening-soon';
  const windowShut = window.state === 'closed';

  if (notYetOpen && capacity.state !== 'uncapped') {
    const limit = capacity.limit ?? capacity.remaining ?? 0;
    chips.push(
      <Chip
        key="capacity"
        size={size}
        icon={<GroupIcon />}
        color="default"
        variant="outlined"
        label={t('browse.entries.limit', { count: limit })}
      />
    );
  } else if (!windowShut && capacity.state === 'full') {
    chips.push(
      <Chip key="capacity" size={size} icon={<GroupIcon />} color="error" label={t('browse.entries.full')} />
    );
  } else if (!windowShut && capacity.state === 'available') {
    const label =
      capacity.limit !== null
        ? t('browse.entries.placesOfLimit', {
            remaining: capacity.remaining,
            limit: capacity.limit,
          })
        : t('browse.entries.placesLeft', { count: capacity.remaining ?? 0 });

    chips.push(
      <Tooltip key="capacity" title={t('browse.entries.placesTooltip')}>
        <Chip
          size={size}
          icon={<GroupIcon />}
          // Amber only when it is genuinely tight; a cap of 200 with 150 left
          // is not news, and colouring it would devalue the warning elsewhere.
          color={(capacity.remaining ?? 0) <= 5 ? 'warning' : 'default'}
          variant={(capacity.remaining ?? 0) <= 5 ? 'filled' : 'outlined'}
          label={label}
        />
      </Tooltip>
    );
  }

  /*
   * The dates themselves, spelled out beneath the chips.
   *
   * A chip compresses — "Closes in 2 days" is the right thing to notice first,
   * but it does not say *when*, and a member planning around a deadline needs
   * the actual moment. Both are shown: the chip for the glance, this for the
   * decision.
   *
   * Which dates depends on where the window is. Before it opens, both matter —
   * when can I enter, and how long will I have. Once open, the opening date is
   * history and only the deadline is worth the line.
   */
  const details: string[] = [];
  const windowNotYetOpen = window.state === 'not-open' || window.state === 'opening-soon';

  if (windowNotYetOpen && event.entriesOpenDate) {
    details.push(
      t('browse.entries.opensDetail', {
        date: formatOrdinalDateTime(event.entriesOpenDate, locale),
      })
    );
  }

  if (event.entriesClosingDate && window.state !== 'closed') {
    details.push(
      t('browse.entries.closesDetail', {
        date: formatOrdinalDateTime(event.entriesClosingDate, locale),
      })
    );
  }

  if (chips.length === 0 && details.length === 0) return null;

  return (
    <Stack spacing={0.5}>
      {chips.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {chips}
        </Stack>
      )}

      {details.length > 0 && (
        <Stack
          direction="row"
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ pl: 0.25 }}
        >
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

export default EntryStatus;
