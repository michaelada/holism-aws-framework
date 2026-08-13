import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Chip, IconButton } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloseIcon from '@mui/icons-material/Close';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * H1 — the member has no connection.
 *
 * **Persistent, and dismissible only to a chip.** Everything below it is the
 * last thing the server said, which may be hours old; a member who dismissed
 * that fact outright would read stale prices and closed events as current. The
 * chip keeps the claim on screen at a size that stops it dominating a ticket.
 *
 * **Its own colour.** Not an error — nothing has failed, and the app still
 * works for everything already fetched — and not a success. `warning` sits
 * where the design puts it: distinct from both.
 *
 * It re-expands when the connection drops again, because that is new
 * information rather than the same notice repeated.
 */
export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // A fresh disconnection is worth the full banner again.
    if (!online) setCollapsed(false);
  }, [online]);

  if (online) return null;

  if (collapsed) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 1 }}>
        <Chip
          icon={<CloudOffIcon />}
          color="warning"
          variant="outlined"
          size="small"
          label={t('offline.chip')}
          onClick={() => setCollapsed(false)}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 1 }}>
      <Alert
        severity="warning"
        icon={<CloudOffIcon />}
        action={
          <IconButton
            size="small"
            aria-label={t('offline.collapse')}
            onClick={() => setCollapsed(true)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {t('offline.banner')}
      </Alert>
    </Box>
  );
};

export default OfflineBanner;
