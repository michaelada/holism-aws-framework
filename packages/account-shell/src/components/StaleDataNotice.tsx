import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useStaleData } from '../offline/StaleDataContext';

/**
 * "Some of this is saved from earlier", with the time.
 *
 * Quiet on purpose: a caption rather than an alert. It appears beneath the
 * offline banner, and while that banner is showing, this is the detail — the
 * banner says the member is offline, this says how old what they are reading
 * is. It also stands alone, because a screen can be served from cache on a
 * connection that is merely broken rather than absent.
 *
 * The time is shown, not a "3 hours ago". A member deciding whether to trust an
 * entry list wants to compare it against when they think something changed, and
 * a relative age has to be converted back before it can be used.
 */
export const StaleDataNotice: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { staleSince } = useStaleData();

  if (!staleSince) return null;

  const fetched = new Date(staleSince);
  if (Number.isNaN(fetched.getTime())) return null;

  const sameDay = fetched.toDateString() === new Date().toDateString();

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        pt: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        color: 'text.secondary',
      }}
    >
      <HistoryIcon fontSize="small" />
      <Typography variant="caption">
        {/*
          The date is dropped for today's data and kept otherwise: "saved at
          09:14" is unambiguous this morning and misleading tomorrow.
        */}
        {sameDay
          ? t('offline.savedAt', {
              time: fetched.toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          : t('offline.savedOn', {
              datetime: fetched.toLocaleString(i18n.language, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
      </Typography>
    </Box>
  );
};

export default StaleDataNotice;
