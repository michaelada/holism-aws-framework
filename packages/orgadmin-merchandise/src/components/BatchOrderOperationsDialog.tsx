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
      <DialogTitle>Batch Update Orders</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Updating {selectedOrderIds.length} order{selectedOrderIds.length !== 1 ? 's' : ''}
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>New Status</InputLabel>
          <Select
            value={newStatus}
            label="New Status"
            onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
            disabled={processing}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Notes (Optional)"
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this batch update..."
          fullWidth
          disabled={processing}
        />

        {processing && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Processing...
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          color="primary"
          disabled={processing}
        >
          Update {selectedOrderIds.length} Order{selectedOrderIds.length !== 1 ? 's' : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOrderOperationsDialog;
