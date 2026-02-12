/**
 * Order Status Update Dialog Component
 * 
 * Dialog for updating order status with optional notes and email notification.
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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import type { OrderStatus } from '../types/merchandise.types';

interface OrderStatusUpdateDialogProps {
  open: boolean;
  currentStatus: OrderStatus;
  onClose: () => void;
  onUpdate: (newStatus: OrderStatus, notes?: string, sendEmail?: boolean) => void;
}

const OrderStatusUpdateDialog: React.FC<OrderStatusUpdateDialogProps> = ({
  open,
  currentStatus,
  onClose,
  onUpdate,
}) => {
  const [newStatus, setNewStatus] = useState<OrderStatus>(currentStatus);
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const handleUpdate = () => {
    onUpdate(newStatus, notes || undefined, sendEmail);
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Order Status</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
          <InputLabel>New Status</InputLabel>
          <Select
            value={newStatus}
            label="New Status"
            onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
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
          placeholder="Add notes about this status change..."
          fullWidth
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
          }
          label="Send status update email to customer"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleUpdate} variant="contained" color="primary">
          Update Status
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderStatusUpdateDialog;
