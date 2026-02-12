/**
 * Batch Operations Dialog Component
 * 
 * Dialog for batch operations:
 * - Mark Processed/Unprocessed
 * - Add Labels
 * - Remove Labels
 * With confirmation and progress indicators
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import type { BatchOperationType } from '../types/membership.types';

interface BatchOperationsDialogProps {
  open: boolean;
  operation: BatchOperationType;
  selectedMembers: string[];
  onClose: () => void;
  onComplete: () => void;
}

const BatchOperationsDialog: React.FC<BatchOperationsDialogProps> = ({
  open,
  onClose,
  operation,
  selectedMembers,
  onComplete,
}) => {
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddLabel = () => {
    if (labelInput.trim() && !labels.includes(labelInput.trim())) {
      setLabels(prev => [...prev, labelInput.trim()]);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(prev => prev.filter(l => l !== label));
  };

  const handleExecute = async () => {
    setLoading(true);
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      onComplete();
    } catch (error) {
      console.error('Batch operation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLabels([]);
    setLabelInput('');
    onClose();
  };

  const getTitle = () => {
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

  const getDescription = () => {
    const count = selectedMembers.length;
    switch (operation) {
      case 'mark_processed':
        return `Mark ${count} selected member(s) as processed?`;
      case 'mark_unprocessed':
        return `Mark ${count} selected member(s) as unprocessed?`;
      case 'add_labels':
        return `Add labels to ${count} selected member(s)?`;
      case 'remove_labels':
        return `Remove labels from ${count} selected member(s)?`;
      default:
        return '';
    }
  };

  const needsLabels = operation === 'add_labels' || operation === 'remove_labels';
  const canExecute = !needsLabels || labels.length > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {getDescription()}
        </DialogContentText>

        {needsLabels && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {operation === 'add_labels' ? 'Labels to Add' : 'Labels to Remove'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', minHeight: 40 }}>
              {labels.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  onDelete={() => handleRemoveLabel(label)}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Add label"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLabel();
                  }
                }}
                sx={{ flexGrow: 1 }}
              />
              <Button onClick={handleAddLabel}>Add</Button>
            </Box>
          </Box>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Processing...
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={loading || !canExecute}
        >
          Execute
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOperationsDialog;
