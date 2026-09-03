import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import BlockIcon from '@mui/icons-material/Block';
import { useApi } from '@aws-web-framework/orgadmin-core';

/**
 * The club's side of gate scanning.
 *
 * A club creates a link, sends it to whoever is on the gate, and can see who
 * is scanning. Everything here is about **a day**, not a permanent setting:
 * the link lasts hours, the stewards are whoever turned up, and the whole
 * thing expires without anybody having to remember to take it away.
 *
 * **The PIN is shown once, here, and never again.** What the server keeps is a
 * hash. A club that loses it creates another link, which is a smaller problem
 * than a PIN that can be read back out of a screen weeks later.
 *
 * See docs/GATE_SCANNING.md.
 */

interface Steward {
  name: string;
  lastSeenAt: string | null;
  scans: number;
}

interface ScanSession {
  id: string;
  eventId: string;
  eventName: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
  stewards: Steward[];
}

interface Props {
  eventId: string;
}

/** The lifetimes worth offering: an afternoon, a day, a weekend. */
const HOUR_CHOICES = [4, 8, 12, 24, 48, 72];

export const GateScanningPanel: React.FC<Props> = ({ eventId }) => {
  const { t, i18n } = useTranslation();
  const { execute } = useApi();

  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [hours, setHours] = useState(12);
  const [issued, setIssued] = useState<{ url: string; pin: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response: any = await execute({
      method: 'GET',
      url: `/api/orgadmin/events/${eventId}/scan-sessions`,
    });
    if (response?.sessions) setSessions(response.sessions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response: any = await execute({
        method: 'POST',
        url: `/api/orgadmin/events/${eventId}/scan-sessions`,
        data: { hours },
        throwOnError: true,
      });
      /*
       * Built here rather than on the server: the server has no reliable idea
       * which host the administrator is looking at, and a link to the wrong
       * one is a link a steward cannot open.
       */
      setIssued({
        url: `${window.location.origin}/account/scan/${response.token}`,
        pin: response.pin,
      });
      await load();
    } catch (failure: any) {
      setError(failure?.response?.data?.error ?? t('ticketing.scanning.createFailed'));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, hours, load, t]);

  const revoke = useCallback(
    async (sessionId: string) => {
      await execute({ method: 'DELETE', url: `/api/orgadmin/scan-sessions/${sessionId}` });
      setIssued(null);
      await load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [load]
  );

  const when = (value: string) => new Date(value).toLocaleString(i18n.language);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <QrCodeScannerIcon color="action" />
          <Typography variant="h6">{t('ticketing.scanning.title')}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('ticketing.scanning.intro')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label={t('ticketing.scanning.lasts')}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            sx={{ minWidth: 160 }}
          >
            {HOUR_CHOICES.map((choice) => (
              <MenuItem key={choice} value={choice}>
                {t('ticketing.scanning.hours', { count: choice })}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => void create()} disabled={busy}>
            {t('ticketing.scanning.create')}
          </Button>
        </Stack>

        {issued && (
          <Alert severity="success" sx={{ mt: 2 }} icon={false}>
            <Typography variant="subtitle2" gutterBottom>
              {t('ticketing.scanning.issuedTitle')}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                fullWidth
                value={issued.url}
                InputProps={{ readOnly: true }}
                sx={{ maxWidth: 460 }}
              />
              <Tooltip title={t('ticketing.scanning.copyLink')}>
                <IconButton onClick={() => void navigator.clipboard?.writeText(issued.url)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Chip color="primary" label={t('ticketing.scanning.pin', { pin: issued.pin })} />
            </Stack>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              {t('ticketing.scanning.pinShownOnce')}
            </Typography>
          </Alert>
        )}

        {sessions.length > 0 && <Divider sx={{ my: 2 }} />}

        <Stack spacing={2}>
          {sessions.map((session) => (
            <Box key={session.id}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={session.active ? 'success' : 'default'}
                  label={
                    session.active
                      ? t('ticketing.scanning.activeUntil', { when: when(session.expiresAt) })
                      : t('ticketing.scanning.ended')
                  }
                />
                {session.active && (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<BlockIcon />}
                    onClick={() => void revoke(session.id)}
                  >
                    {t('ticketing.scanning.revoke')}
                  </Button>
                )}
              </Stack>

              {session.stewards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('ticketing.scanning.noStewardsYet')}
                </Typography>
              ) : (
                session.stewards.map((steward) => (
                  <Typography variant="body2" key={steward.name} sx={{ mt: 0.5 }}>
                    {t('ticketing.scanning.stewardLine', {
                      name: steward.name,
                      count: steward.scans,
                      when: steward.lastSeenAt ? when(steward.lastSeenAt) : '—',
                    })}
                  </Typography>
                ))
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default GateScanningPanel;
