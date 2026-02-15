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
import { useTranslation } from 'react-i18next';
import type { BatchTicketOperationResult } from '../types/ticketing.types';

interface BatchTicketOperationsDialogProps {
  open: boolean;
  ticketIds: string[];
  operation: 'mark_scanned' | 'mark_not_scanned';
  onClose: () => void;
  onComplete: () => void;
}

// Mock API hook
const useApi = () => ({
  execute: async ({ method, url, data }: { method: string; url: string; data?: any }) => {
    // Simulate API call
    return {
      success: true,
      processedCount: data?.ticketIds?.length || 0,
      failedCount: 0,
      errors: [],
    };
  },
});

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

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await execute({
        method: 'POST',
        url: '/api/orgadmin/tickets/batch-operation',
        data: {
          ticketIds,
          operation,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);
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
