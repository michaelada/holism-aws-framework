import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  formatDisplayDate,
  formatDisplayDateTime,
  generateQRCodeDataURL,
} from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { AccountTicketDetail } from '../types/account';

/**
 * C10 — a single ticket. Route `/:orgCode/tickets/:ticketId`.
 *
 * The layout is the frame; the content is the organisation's configuration —
 * header text, instructions, footer and background colour all come from
 * `event_ticketing_config`, so a club's ticket looks like the club's ticket.
 *
 * A used or expired ticket renders the **same** frame with the QR dimmed and a
 * banner saying why. Hiding it would be worse: a member who scanned in and out
 * needs to see that it will not scan again, and at a gate an empty screen is
 * indistinguishable from a broken app.
 */
export const TicketPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountTicketDetail>();

  const [ticket, setTicket] = useState<AccountTicketDetail | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode || !ticketId) return;
    setLoading(true);
    setFailed(false);
    try {
      setTicket(await execute({ url: `/api/account/${orgCode}/tickets/${ticketId}` }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, ticketId, execute]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * The QR is rendered on the device from the payload, not fetched as an image.
   * That is what lets this screen work at a gate with no signal once the
   * response is cached — an <img src="/api/…/qr.png"> would need the network at
   * exactly the wrong moment.
   */
  useEffect(() => {
    let cancelled = false;
    if (!ticket?.qrCode) return;

    /*
     * 320, not 260. The code is a signed token now rather than a UUID, so the
     * grid is denser; at the old width the modules were small enough that a
     * steward's camera hunted for them in low light. This is the one QR in the
     * product read off a **screen**, at whatever brightness the holder's phone
     * happens to be on.
     */
    generateQRCodeDataURL(ticket.qrCode, { width: 320, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [ticket?.qrCode]);

  /*
   * Keep the screen awake while a ticket is open, and release on exit.
   *
   * The design asks for the screen to be *brightened*, because gate scanners
   * fail on dim phones. No browser exposes brightness — it is a native-shell
   * capability — so this does the part the web can actually do rather than
   * pretending. A phone that dims to sleep in a queue is the more common
   * failure anyway. Brightness needs revisiting if this app is ever wrapped
   * natively.
   */
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    }).wakeLock;

    // Absent on desktop Safari and older browsers; a missing wake lock is not
    // an error, it just means the screen behaves normally.
    wakeLock
      ?.request('screen')
      .then((lock) => {
        if (cancelled) {
          lock.release().catch(() => undefined);
        } else {
          sentinel = lock;
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      sentinel?.release().catch(() => undefined);
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (failed || !ticket) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Alert severity="error">{t('tickets.notFound')}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/${orgCode}/tickets`)}
          sx={{ mt: 2 }}
        >
          {t('tickets.backToTickets')}
        </Button>
      </Container>
    );
  }

  const unusable = ticket.state === 'used' || ticket.state === 'expired';

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/${orgCode}/tickets`)}
        sx={{ mb: 2 }}
      >
        {t('tickets.backToTickets')}
      </Button>

      {ticket.state === 'used' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('tickets.usedBanner', {
            when: ticket.scannedAt ? formatDisplayDateTime(ticket.scannedAt, locale) : '',
          })}
        </Alert>
      )}
      {ticket.state === 'expired' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('tickets.expiredBanner', {
            when: formatDisplayDate(ticket.validUntil, locale),
          })}
        </Alert>
      )}
      {ticket.state === 'awaiting-payment' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('tickets.awaitingPaymentBanner')}
        </Alert>
      )}

      <Paper
        sx={{
          p: 3,
          textAlign: 'center',
          backgroundColor: ticket.config.backgroundColour || undefined,
        }}
      >
        <Typography variant="overline" color="text.secondary">
          {ticket.organisationName}
        </Typography>

        {ticket.config.headerText && (
          <Typography variant="h6" gutterBottom>
            {ticket.config.headerText}
          </Typography>
        )}

        <Typography variant="h5" fontWeight={600}>
          {ticket.eventName}
        </Typography>
        {ticket.activityName && (
          <Typography color="text.secondary">{ticket.activityName}</Typography>
        )}
        <Typography color="text.secondary" gutterBottom>
          {formatDisplayDate(ticket.eventStartDate, locale)}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ my: 2, opacity: unusable ? 0.25 : 1 }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={t('tickets.qrAlt', { reference: ticket.ticketReference })}
              style={{ maxWidth: '100%' }}
            />
          ) : (
            <CircularProgress size={32} />
          )}
        </Box>

        <Typography variant="h6" letterSpacing={1}>
          {ticket.ticketReference}
        </Typography>

        <Stack spacing={0.5} sx={{ mt: 2 }}>
          <Typography fontWeight={600}>{ticket.entrantName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {ticket.entrantEmail}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('tickets.validUntil', {
              when: formatDisplayDate(ticket.validUntil, locale),
            })}
          </Typography>
        </Stack>

        {ticket.config.instructions && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {ticket.config.instructions}
            </Typography>
          </>
        )}

        {ticket.config.footerText && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            {ticket.config.footerText}
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default TicketPage;
