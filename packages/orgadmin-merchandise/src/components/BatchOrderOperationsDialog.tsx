/**
 * Batch Order Operations Dialog Component
 * 
 * Dialog for performing batch operations on multiple orders.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  LinearProgress,
  Box,
} from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { OrderStatus } from '../types/merchandise.types';

interface BatchOrderOperationsDialogProps {
  open: boolean;
  selectedOrderIds: string[];
  onClose: () => void;
  onUpdate: (orderIds: string[], newStatus: OrderStatus, notes?: string) => Promise<void>;
}

const BatchOrderOperationsDialog: React.FC<BatchOrderOperationsDialogProps> = ({
  open,
  selectedOrderIds,
  onClose,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [newStatus, setNewStatus] = useState<OrderStatus>('processing');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpdate = async () => {
    setProcessing(true);
    setProgress(0);
    
    try {
      await onUpdate(selectedOrderIds, newStatus, notes || undefined);
      setProgress(100);
      setTimeout(() => {
        setNotes('');
        setProcessing(false);
        setProgress(0);
        onClose();
      }, 500);
    } catch (error) {
      console.error('Batch update failed:', error);
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('merchandise.batchOperations.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('merchandise.batchOperations.updatingCount', { 
            count: selectedOrderIds.length,
            plural: selectedOrderIds.length !== 1 ? 's' : ''
          })}
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>{t('merchandise.batchOperations.newStatus')}</InputLabel>
          <Select
            value={newStatus}
            label={t('merchandise.batchOperations.newStatus')}
            onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
            disabled={processing}
          >
            <MenuItem value="pending">{t('merchandise.orderStatusOptions.pending')}</MenuItem>
            <MenuItem value="processing">{t('merchandise.orderStatusOptions.processing')}</MenuItem>
            <MenuItem value="shipped">{t('merchandise.orderStatusOptions.shipped')}</MenuItem>
            <MenuItem value="delivered">{t('merchandise.orderStatusOptions.delivered')}</MenuItem>
            <MenuItem value="cancelled">{t('merchandise.orderStatusOptions.cancelled')}</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label={t('merchandise.batchOperations.notes')}
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('merchandise.batchOperations.notesPlaceholder')}
          fullWidth
          disabled={processing}
        />

        {processing && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {t('merchandise.batchOperations.processing')}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          color="primary"
          disabled={processing}
        >
          {t('merchandise.batchOperations.updateButton', { 
            count: selectedOrderIds.length,
            plural: selectedOrderIds.length !== 1 ? 's' : ''
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOrderOperationsDialog;
