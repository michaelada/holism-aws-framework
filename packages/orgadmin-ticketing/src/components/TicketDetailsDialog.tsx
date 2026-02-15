/**
 * Ticket Details Dialog
 * 
 * Displays full ticket information including QR code, event details, and scan history
 */

import React, { useState, useEffect, useRef } from 'react';
import {
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
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ScannedIcon,
  RadioButtonUnchecked as NotScannedIcon,
  Email as EmailIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@orgadmin/shell/utils/dateFormatting';
import QRCode from 'qrcode';
import type { ElectronicTicket, TicketScanHistory } from '../types/ticketing.types';

interface TicketDetailsDialogProps {
  open: boolean;
  ticket: ElectronicTicket;
  onClose: () => void;
  onUpdate: () => void;
}

// Mock API hook
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    return [];
  },
});

const TicketDetailsDialog: React.FC<TicketDetailsDialogProps> = ({
  open,
  ticket,
  onClose,
  onUpdate,
}) => {
  const { execute } = useApi();
  const { t, i18n } = useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<TicketScanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && ticket) {
      generateQRCode();
      loadScanHistory();
    }
  }, [open, ticket]);

  const generateQRCode = async () => {
    try {
      // Generate QR code from ticket's qrCode UUID
      const dataUrl = await QRCode.toDataURL(ticket.qrCode, {
        width: 300,
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

  const loadScanHistory = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/tickets/${ticket.id}/scan-history`,
      });
      setScanHistory(response || []);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    }
  };

  const handleMarkScanned = async () => {
    try {
      setLoading(true);
      await execute({
        method: 'POST',
        url: `/api/orgadmin/tickets/${ticket.id}/mark-scanned`,
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to mark ticket as scanned:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNotScanned = async () => {
    try {
      setLoading(true);
      await execute({
        method: 'POST',
        url: `/api/orgadmin/tickets/${ticket.id}/mark-not-scanned`,
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to mark ticket as not scanned:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      setLoading(true);
      await execute({
        method: 'POST',
        url: `/api/orgadmin/tickets/${ticket.id}/resend-email`,
      });
      alert('Ticket email resent successfully');
    } catch (error) {
      console.error('Failed to resend ticket email:', error);
      alert('Failed to resend ticket email');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      // Download ticket PDF
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/tickets/${ticket.id}/download-pdf`,
      });
      // Handle PDF download
      console.log('PDF download initiated');
    } catch (error) {
      console.error('Failed to download ticket PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{t('ticketing.details.title')}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
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
                      <TableCell>Scan Date</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanHistory.map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell>
                          {format(new Date(scan.scanDate), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>{scan.scanResult}</TableCell>
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
      </DialogContent>

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
                Mark as Scanned
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<NotScannedIcon />}
                onClick={handleMarkNotScanned}
                disabled={loading}
              >
                Mark as Not Scanned
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={handleResendEmail}
              disabled={loading}
            >
              Resend Email
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPDF}
              disabled={loading}
            >
              Download PDF
            </Button>
            <Button onClick={onClose}>Close</Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default TicketDetailsDialog;
