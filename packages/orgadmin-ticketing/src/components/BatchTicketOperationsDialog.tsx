/**
 * Batch Ticket Operations Dialog
 * 
 * Handles batch operations for multiple tickets (mark scanned/not scanned)
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
  Alert,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { BatchTicketOperationResult } from '../types/ticketing.types';

interface BatchTicketOperationsDialogProps {
  open: boolean;
  ticketIds: string[];
  operation: 'mark_scanned' | 'mark_not_scanned';
  onClose: () => void;
  onComplete: () => void;
}


const BatchTicketOperationsDialog: React.FC<BatchTicketOperationsDialogProps> = ({
  open,
  ticketIds,
  operation,
  onClose,
  onComplete,
}) => {
  const { execute } = useApi();
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BatchTicketOperationResult | null>(null);
  const [progress, setProgress] = useState(0);

  const getOperationTitle = () => {
    switch (operation) {
      case 'mark_scanned':
        return t('ticketing.batchOperations.markScannedTitle');
      case 'mark_not_scanned':
        return t('ticketing.batchOperations.markNotScannedTitle');
      default:
        return t('ticketing.batch.selectedTickets', { count: ticketIds.length });
    }
  };

  const getOperationDescription = () => {
    switch (operation) {
      case 'mark_scanned':
        return t('ticketing.batchOperations.markScannedDescription', { count: ticketIds.length });
      case 'mark_not_scanned':
        return t('ticketing.batchOperations.markNotScannedDescription', { count: ticketIds.length });
      default:
        return '';
    }
  };

  const handleConfirm = async () => {
    try {
      setProcessing(true);
      setProgress(0);

      /*
       * One request per ticket, against the endpoint that exists.
       *
       * This asked `POST /tickets/batch-operation`, which has never been a
       * route — so every batch 404'd, and because `execute` answers `null` on
       * an error the dialog read `response.success` off nothing and reported a
       * failure it could not explain. The same fault as the single Mark as
       * Scanned button, one screen along.
       *
       * A loop rather than a new endpoint: the batches are a screenful of
       * tickets, the work is a single-row update each, and a per-ticket result
       * is what this dialog already reports. A club marking forty tickets in
       * one go should be told *which* one failed, which a single call would
       * have to invent a shape to say.
       */
      const errors: Array<{ ticketId: string; error: string }> = [];
      let processed = 0;

      for (const [index, ticketId] of ticketIds.entries()) {
        try {
          await execute({
            method: 'PUT',
            url: `/api/orgadmin/tickets/${ticketId}/scan-status`,
            data: {
              scanStatus: operation === 'mark_scanned' ? 'scanned' : 'not_scanned',
            },
            throwOnError: true,
          });
          processed += 1;
        } catch (failure) {
          errors.push({
            ticketId,
            error: failure instanceof Error ? failure.message : 'Failed',
          });
        }
        // Real progress, rather than a bar that climbs to 90% on a timer.
        setProgress(Math.round(((index + 1) / ticketIds.length) * 100));
      }

      setProgress(100);
      const response = {
        success: errors.length === 0,
        processedCount: processed,
        failedCount: errors.length,
        errors,
      };
      setResult(response);

      // Auto-close and complete if successful
      if (response.success && response.failedCount === 0) {
        setTimeout(() => {
          onComplete();
          handleClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
      setResult({
        success: false,
        processedCount: 0,
        failedCount: ticketIds.length,
        errors: [{ ticketId: 'all', error: 'Operation failed' }],
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getOperationTitle()}</DialogTitle>

      <DialogContent>
        {!result ? (
          <Box>
            <Typography variant="body1" gutterBottom>
              {getOperationDescription()}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              {t('ticketing.batchOperations.updateMessage')}
            </Typography>

            {processing && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" gutterBottom>
                  {t('ticketing.batchOperations.processing')}
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {t('ticketing.batchOperations.progressComplete', { progress })}
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Box>
            {result.success && result.failedCount === 0 ? (
              <Alert severity="success" icon={<SuccessIcon />}>
                <Typography variant="body1" fontWeight="medium">
                  {t('ticketing.batchOperations.successTitle')}
                </Typography>
                <Typography variant="body2">
                  {t('ticketing.batchOperations.successMessage', { count: result.processedCount })}
                </Typography>
              </Alert>
            ) : (
              <Box>
                <Alert severity="warning" icon={<ErrorIcon />} sx={{ mb: 2 }}>
                  <Typography variant="body1" fontWeight="medium">
                    {t('ticketing.batchOperations.errorTitle')}
                  </Typography>
                  <Typography variant="body2">
                    {t('ticketing.batchOperations.errorMessage', { processed: result.processedCount, failed: result.failedCount })}
                  </Typography>
                </Alert>

                {result.errors && result.errors.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('ticketing.batchOperations.errors')}
                    </Typography>
                    <Box
                      sx={{
                        maxHeight: 200,
                        overflow: 'auto',
                        bgcolor: 'grey.100',
                        p: 1,
                        borderRadius: 1,
                      }}
                    >
                      {result.errors.map((error, index) => (
                        <Typography key={index} variant="caption" display="block">
                          {t('ticketing.batchOperations.ticketError', { ticketId: error.ticketId, error: error.error })}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={processing}>
              {t('ticketing.batchOperations.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={processing}
              startIcon={processing ? <CircularProgress size={16} /> : undefined}
            >
              {processing ? t('ticketing.batchOperations.processing') : t('ticketing.batchOperations.confirm')}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            {t('ticketing.batchOperations.close')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BatchTicketOperationsDialog;
