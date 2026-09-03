/**
 * Ticket Details Dialog
 * 
 * Displays full ticket information including QR code, event details, and scan history
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ScannedIcon,
  RadioButtonUnchecked as NotScannedIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from '@itsplainsailing/orgadmin-shell';
import { useApi, SortableTableCell, useTableSort } from '@itsplainsailing/orgadmin-core';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { renderTicketHTML } from '@itsplainsailing/components';
import type { ElectronicTicket, TicketScanHistory } from '../types/ticketing.types';

interface TicketDetailsDialogProps {
  open: boolean;
  ticket: ElectronicTicket;
  /**
   * The event this ticket is for, from the screen that opened the dialog.
   *
   * The API returns `electronic_tickets` rows unjoined, and `ticket_data` is
   * written as `{}` — so the ticket itself does not know its event's name, and
   * a printed ticket headed by nothing is not a ticket. The event list page has
   * the name; the dashboard does not, and falls back to whatever `ticketData`
   * holds.
   */
  eventName?: string;
  onClose: () => void;
  onUpdate: () => void;
}


const TicketDetailsDialog: React.FC<TicketDetailsDialogProps> = ({
  open,
  ticket,
  eventName,
  onClose,
  onUpdate,
}) => {
  const { execute } = useApi();
  const { t, i18n } = useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<TicketScanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  /** What went wrong, said on the dialog rather than in the console. */
  const [error, setError] = useState<string | null>(null);
  /**
   * The club's ticket design, joined to this ticket's event and activity.
   *
   * Read once when the dialog opens, so the **ticket itself** can be shown —
   * the thing a member is holding at the gate — rather than only the facts the
   * database keeps about it. Everything the printer uses comes from here too,
   * so what is on screen and what comes out of the printer cannot differ.
   */
  const [design, setDesign] = useState<Record<string, any> | null>(null);
  const [tab, setTab] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && ticket) {
      generateQRCode();
      loadScanHistory();
      loadDesign();
      // Reopened on a different ticket, so the ticket is what shows first.
      setTab(0);
    }
  }, [open, ticket]);

  const generateQRCode = async () => {
    try {
      /*
       * From `qrToken` — the signed token printed on the ticket — falling back
       * to the identifier for a ticket issued before signing, whose emailed QR
       * holds exactly that. The two must match or the screen and the paper
       * would scan differently.
       */
      const dataUrl = await QRCode.toDataURL(ticket.qrToken ?? ticket.qrCode, {
        width: 360,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  /*
   * Quiet on failure. The scan details below still work without it, and a gate
   * that cannot read a design must still be able to admit somebody.
   */
  const loadDesign = async () => {
    try {
      setDesign(await execute({ method: 'GET', url: `/api/orgadmin/tickets/${ticket.id}/render` }));
    } catch (failure) {
      console.error('Could not read the ticket design:', failure);
      setDesign(null);
    }
  };

  const loadScanHistory = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/tickets/${ticket.id}/scan-history`,
      });
      /*
       * Checked, not trusted. `useApi.execute` answers `null` on an error and
       * the endpoint's shape is not guaranteed, so `response || []` could put
       * an object into a state typed as an array — which read as an empty
       * history until something tried to iterate it.
       */
      setScanHistory(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    }
  };

  /**
   * Admit a ticket at the gate, or take that back.
   *
   * `PUT …/scan-status`, which is the endpoint that exists. This asked for
   * `POST …/mark-scanned` and `POST …/mark-not-scanned`, which never have —
   * so both buttons 404'd, and because `execute` answers `null` on an error
   * rather than throwing, the dialog treated the refusal as success: it called
   * `onUpdate()`, closed itself, and left the ticket exactly as it was. A
   * gateman marking somebody in saw the dialog shut and nothing change.
   *
   * `throwOnError` is what makes a refusal reach the `catch` at all, and the
   * message now stays on screen instead of going to the console.
   */
  const setScanStatus = async (scanStatus: 'scanned' | 'not_scanned') => {
    try {
      setLoading(true);
      setError(null);
      await execute({
        method: 'PUT',
        url: `/api/orgadmin/tickets/${ticket.id}/scan-status`,
        data: {
          scanStatus,
          // Where it was admitted. The gate is where this screen is used; a
          // club scanning at two rings can still say so on the ticket itself.
          scanLocation: scanStatus === 'scanned' ? t('ticketing.details.markedByAdmin') : undefined,
        },
        throwOnError: true,
      });
      onUpdate();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : t('ticketing.errors.scanStatusFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMarkScanned = () => setScanStatus('scanned');
  const handleMarkNotScanned = () => setScanStatus('not_scanned');

  /**
   * The ticket itself, ready to print or save as a PDF.
   *
   * Built here rather than fetched: there is no `download-pdf` endpoint and
   * never was, so this called one that answered 404 and then logged "PDF
   * download initiated" — the button did nothing at all, quietly.
   *
   * `generateTicketPDFHTML` is the same template the rest of the product uses
   * for a ticket, from the shared library, so what prints is the ticket a
   * member receives rather than a second design that drifts from it. The
   * browser's own print dialog is what turns it into a PDF; a real
   * server-rendered file would mean a PDF engine in the backend, which is a
   * larger thing to carry for one button.
   */
  /**
   * The ticket itself, as HTML.
   *
   * One description, rendered on screen and handed to the printer — so what an
   * administrator is looking at is what comes out, and what a member holds at
   * the gate. Built from the club's design where it could be read, and from
   * what the ticket row itself knows where it could not.
   */
  const ticketHtml = useMemo(
    () =>
      renderTicketHTML({
        ticketReference: ticket.ticketReference,
        qrCodeDataURL: qrCodeDataUrl,
        eventName: design?.eventName || eventName || ticket.ticketData?.eventName || '',
        eventDescription: design?.eventDescription,
        activityName: design?.activityName ?? ticket.ticketData?.activityName,
        activityDescription: design?.activityDescription,
        startDate: design?.startDate ?? ticket.validFrom ?? ticket.validUntil,
        endDate: design?.endDate ?? ticket.validFrom ?? ticket.validUntil,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        headerText: design?.headerText,
        instructions: design?.instructions,
        footerText: design?.footerText,
        imageUrl: design?.imageUrl,
        imagePlacement: design?.imagePlacement,
        layout: design?.layout,
        backgroundColour: design?.backgroundColour,
        locale: i18n.language,
        labels: {
          ticketReference: t('ticketing.details.ticketReference'),
          ticketHolder: t('ticketing.details.customerInformation'),
          date: t('ticketing.details.eventDetails'),
          instructions: t('ticketing.settings.fields.ticketInstructions'),
        },
      }),
    [design, eventName, qrCodeDataUrl, ticket, i18n.language, t]
  );

  const handlePrintTicket = () => {
    setError(null);
    const html = ticketHtml;

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const printable = frame.contentWindow;
    if (!printable) {
      document.body.removeChild(frame);
      setError(t('ticketing.errors.printFailed'));
      return;
    }

    printable.document.open();
    printable.document.write(html);
    printable.document.close();

    // The QR code is a data URL and the styles are inline, so there is nothing
    // to wait for the network on; one frame is enough for layout to settle.
    printable.focus();
    setTimeout(() => {
      printable.print();
      setTimeout(() => frame.remove(), 1000);
    }, 100);
  };

  /*
   * The history arrives newest first, which is the right default for a gate —
   * "what just happened" is the question. Sorting is offered on top of it.
   */
  const scanSort = useTableSort(scanHistory, {
    accessors: { result: (scan) => scan.refusalReason ?? scan.scanResult },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6">{t('ticketing.details.title')}</Typography>
            {/*
              Whose ticket, and which one — in the header rather than on a tab.
              
              With the details behind tabs, an administrator who switches to the
              scan history would otherwise lose sight of which of forty tickets
              they are looking at. This is the one line that has to be true
              wherever they are in the dialog.
            */}
            <Typography variant="body2" color="textSecondary">
              {ticket.customerName} · {ticket.ticketReference}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/*
        Two tabs rather than one long scroll.
        
        The ticket is a tall thing — a photograph, a code, two descriptions —
        and the scan history is a table that grows with every gate. Stacked,
        the details a club opens this dialog to check would sit below a screen
        and a half of ticket. The ticket leads, because "what is this person
        holding" is the question the reference in the list does not answer.
      */}
      <Tabs
        value={tab}
        onChange={(_event, next) => setTab(next)}
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label={t('ticketing.details.tabs.ticket')} />
        <Tab label={t('ticketing.details.tabs.scanning')} />
      </Tabs>

      <DialogContent dividers>
        {tab === 0 && (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {t('ticketing.details.tabs.ticketHint')}
            </Typography>
            {/*
              An iframe, so the ticket's own styles are its own: rendered inline
              it would inherit the org-admin's theme and stop being the ticket.
            */}
            <Box
              component="iframe"
              title={t('ticketing.details.tabs.ticket')}
              srcDoc={ticketHtml}
              sx={{
                width: '100%',
                height: 620,
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 1,
              }}
            />
          </Box>
        )}

        {tab === 1 && (
        <Grid container spacing={3}>
          {/* QR Code Section */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('ticketing.details.qrCode')}
              </Typography>
              {qrCodeDataUrl && (
                <Box sx={{ mt: 2 }}>
                  <img
                    src={qrCodeDataUrl}
                    alt={t('ticketing.details.qrCode')}
                    style={{ width: '100%', maxWidth: 300 }}
                  />
                </Box>
              )}
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                {ticket.ticketReference}
              </Typography>
            </Paper>
          </Grid>

          {/* Ticket Information */}
          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              Ticket Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Ticket Reference
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {ticket.ticketReference}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Status
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {ticket.status}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Issue Date
                </Typography>
                <Typography variant="body1">
                  {format(new Date(ticket.issueDate), 'MMM dd, yyyy HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Valid Until
                </Typography>
                <Typography variant="body1">
                  {format(new Date(ticket.validUntil), 'MMM dd, yyyy HH:mm')}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Event Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  Event Name
                </Typography>
                <Typography variant="body1">
                  {ticket.ticketData?.eventName || 'N/A'}
                </Typography>
              </Grid>
              {ticket.ticketData?.activityName && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Event Activity
                  </Typography>
                  <Typography variant="body1">
                    {ticket.ticketData.activityName}
                  </Typography>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Customer Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  Name
                </Typography>
                <Typography variant="body1">
                  {ticket.customerName}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  Email
                </Typography>
                <Typography variant="body1">
                  {ticket.customerEmail}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Scan Status
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {ticket.scanStatus === 'scanned' ? (
                    <>
                      <ScannedIcon color="success" />
                      <Typography variant="body1" color="success.main">
                        Scanned
                      </Typography>
                    </>
                  ) : (
                    <>
                      <NotScannedIcon />
                      <Typography variant="body1">
                        Not Scanned
                      </Typography>
                    </>
                  )}
                </Box>
              </Grid>
              {ticket.scanDate && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">
                    Scan Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(ticket.scanDate), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                </Grid>
              )}
              {ticket.scanLocation && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Scan Location
                  </Typography>
                  <Typography variant="body1">
                    {ticket.scanLocation}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Scan Count
                </Typography>
                <Typography variant="body1">
                  {ticket.scanCount}
                </Typography>
              </Grid>
            </Grid>
          </Grid>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Scan History
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableTableCell sort={scanSort} field="scanDate">
                        Scan Date
                      </SortableTableCell>
                      <SortableTableCell sort={scanSort} field="result">
                        Result
                      </SortableTableCell>
                      <SortableTableCell sort={scanSort} field="scannedByName">
                        {t('ticketing.scanning.scannedBy')}
                      </SortableTableCell>
                      <SortableTableCell sort={scanSort} field="scanLocation">
                        Location
                      </SortableTableCell>
                      <SortableTableCell sort={scanSort} field="notes">
                        Notes
                      </SortableTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanSort.rows.map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell>
                          {format(new Date(scan.scanDate), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {/*
                            A refusal says why. The gate writes every
                            presentation down, including the ones it turned
                            away, and "already used" is the row a club is
                            actually looking for.
                          */}
                          {scan.refusalReason
                            ? t(`ticketing.scanning.refused.${scan.refusalReason}`)
                            : scan.scanResult}
                        </TableCell>
                        <TableCell>{scan.scannedByName || '-'}</TableCell>
                        <TableCell>{scan.scanLocation || '-'}</TableCell>
                        <TableCell>{scan.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          )}
        </Grid>
        )}
      </DialogContent>

      {error && (
        <Alert severity="error" sx={{ mx: 3, mb: 1 }}>
          {error}
        </Alert>
      )}

      <DialogActions>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', px: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {ticket.scanStatus === 'not_scanned' ? (
              <Button
                variant="contained"
                color="success"
                startIcon={<ScannedIcon />}
                onClick={handleMarkScanned}
                disabled={loading}
              >
                {t('ticketing.actions.markAsScanned')}
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<NotScannedIcon />}
                onClick={handleMarkNotScanned}
                disabled={loading}
              >
                {t('ticketing.actions.markAsNotScanned')}
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/*
              "Resend email" was here and is gone. There is no endpoint behind
              it — there never has been — and it announced *"Ticket email resent
              successfully"* whatever happened, so a club that thought it had
              re-sent a ticket had not. A button that cannot work is worse than
              its absence; building the resend is a separate piece of work.
            */}
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handlePrintTicket}
              disabled={loading || !qrCodeDataUrl}
            >
              {t('ticketing.actions.printTicket')}
            </Button>
            <Button onClick={onClose}>{t('common.actions.close')}</Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default TicketDetailsDialog;
