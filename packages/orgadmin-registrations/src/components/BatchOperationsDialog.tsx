/**
 * Batch Operations Dialog
 * 
 * Dialog for performing batch operations on selected registrations
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  SelectChangeEvent,
  LinearProgress,
  Alert,
} from '@mui/material';

interface BatchOperationsDialogProps {
  open: boolean;
  onClose: () => void;
  operation: 'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels';
  selectedIds: string[];
  onComplete: () => void;
}

const BatchOperationsDialog: React.FC<BatchOperationsDialogProps> = ({
  open,
  onClose,
  operation,
  selectedIds,
  onComplete,
}) => {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data - would be loaded from API
  const availableLabels = ['VIP', 'Verified', 'Renewal', 'New'];

  const handleLabelsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedLabels(typeof value === 'string' ? value.split(',') : value);
  };

  const getOperationTitle = () => {
    switch (operation) {
      case 'mark_processed':
        return 'Mark as Processed';
      case 'mark_unprocessed':
        return 'Mark as Unprocessed';
      case 'add_labels':
        return 'Add Labels';
      case 'remove_labels':
        return 'Remove Labels';
      default:
        return 'Batch Operation';
    }
  };

  const getOperationDescription = () => {
    const count = selectedIds.length;
    switch (operation) {
      case 'mark_processed':
        return `Mark ${count} registration${count !== 1 ? 's' : ''} as processed?`;
      case 'mark_unprocessed':
        return `Mark ${count} registration${count !== 1 ? 's' : ''} as unprocessed?`;
      case 'add_labels':
        return `Add selected labels to ${count} registration${count !== 1 ? 's' : ''}?`;
      case 'remove_labels':
        return `Remove selected labels from ${count} registration${count !== 1 ? 's' : ''}?`;
      default:
        return '';
    }
  };

  const handleExecute = async () => {
    setError(null);
    setProcessing(true);

    try {
      // Mock API call - would be replaced with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate API call
      console.log('Batch operation:', {
        operation,
        registrationIds: selectedIds,
        labels: selectedLabels,
      });

      onComplete();
      handleClose();
    } catch (err) {
      setError('Failed to perform batch operation. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setSelectedLabels([]);
      setError(null);
      onClose();
    }
  };

  const isLabelOperation = operation === 'add_labels' || operation === 'remove_labels';
  const canExecute = !isLabelOperation || selectedLabels.length > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getOperationTitle()}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" gutterBottom>
          {getOperationDescription()}
        </Typography>

        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selected registrations: {selectedIds.length}
          </Typography>
        </Box>

        {isLabelOperation && (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Labels</InputLabel>
            <Select
              multiple
              value={selectedLabels}
              onChange={handleLabelsChange}
              input={<OutlinedInput label="Labels" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableLabels.map((label) => (
                <MenuItem key={label} value={label}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {processing && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Processing...
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={!canExecute || processing}
        >
          {processing ? 'Processing...' : 'Execute'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOperationsDialog;
